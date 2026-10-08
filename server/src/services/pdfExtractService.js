import { PDFParse } from 'pdf-parse';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Normalizes raw text extracted from a PDF.
 * Collapses redundant whitespace, cleans up hyphenated line breaks (e.g., 'exam-\nple' -> 'example'),
 * preserves paragraph breaks, and strips non-printable control characters.
 */
export function normalizeExtractedPdfText(rawText) {
  if (!rawText) return '';

  // Standardize carriage returns
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip non-printable ASCII control characters except newline (\n) and tab (\t)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Fix hyphenated line breaks (word-break across lines like 'exam-\nple' or 'inter-\n\nactive')
  text = text.replace(/(\b[a-zA-Z]+)-\s*\n+\s*([a-zA-Z]+\b)/g, '$1$2');

  // Collapse consecutive inline whitespace per line
  const lines = text.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim());

  // Re-join and collapse 3+ consecutive newlines into double newlines for paragraph breaks
  text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Truncates text gracefully at the nearest paragraph or sentence boundary if it exceeds maxChars.
 */
export function truncateAtParagraphBoundary(text, maxChars = env.AI_MAX_SOURCE_CHARS) {
  if (!text) {
    return {
      text: '',
      truncated: false,
      originalCharCount: 0,
      usedCharCount: 0
    };
  }

  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
      originalCharCount: text.length,
      usedCharCount: text.length
    };
  }

  const candidate = text.slice(0, maxChars);

  // Look for double newline (paragraph boundary) within the upper 30% of candidate
  let cutoff = candidate.lastIndexOf('\n\n');

  if (cutoff === -1 || cutoff < maxChars * 0.7) {
    // Try single newline
    const singleNewline = candidate.lastIndexOf('\n');
    if (singleNewline > maxChars * 0.7) {
      cutoff = singleNewline;
    }
  }

  if (cutoff === -1 || cutoff < maxChars * 0.7) {
    // Try sentence end
    const period = candidate.lastIndexOf('. ');
    if (period > maxChars * 0.7) {
      cutoff = period + 1;
    }
  }

  if (cutoff === -1 || cutoff < maxChars * 0.5) {
    cutoff = maxChars;
  }

  const truncatedText = text.slice(0, cutoff).trim();

  return {
    text: truncatedText,
    truncated: true,
    originalCharCount: text.length,
    usedCharCount: truncatedText.length
  };
}

/**
 * Extracts, normalizes, and validates text from a PDF Buffer with strict timeout,
 * page cap, encryption, corruption, and scanned-image defenses.
 */
export async function extractPdfTextFromBuffer(buffer, options = {}) {
  const { startPage, endPage, maxPages = env.AI_MAX_PDF_PAGES, timeoutMs = env.AI_PDF_EXTRACT_TIMEOUT_MS } = options;

  if (!buffer || !Buffer.isBuffer(buffer)) {
    const err = new Error('Invalid PDF buffer provided.');
    err.code = 'INVALID_FILE';
    throw err;
  }

  // Magic bytes check (%PDF-)
  const header = buffer.subarray(0, 5).toString('ascii');
  if (!header.startsWith('%PDF-')) {
    const err = new Error('The uploaded file is not a valid PDF document.');
    err.code = 'INVALID_PDF';
    throw err;
  }

  // Decompression / timeout protection
  const parser = new PDFParse({ data: buffer });

  let textResult;
  try {
    const loadPromise = async () => {
      await parser.load();
      return parser.getText();
    };

    textResult = await Promise.race([
      loadPromise(),
      new Promise((_, reject) => {
        const timer = setTimeout(() => {
          const timeoutErr = new Error('PDF extraction timed out. The file may be too complex or compressed.');
          timeoutErr.code = 'EXTRACTION_TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
        if (timer.unref) timer.unref();
      })
    ]);
  } catch (err) {
    if (err.code === 'EXTRACTION_TIMEOUT') {
      throw err;
    }

    const errName = err.name || '';
    const errMsg = err.message || '';

    if (
      errName === 'PasswordException' ||
      /password/i.test(errMsg) ||
      /encrypted/i.test(errMsg) ||
      /need a password/i.test(errMsg)
    ) {
      const passwordErr = new Error('This PDF is password-protected. Please upload an unprotected copy.');
      passwordErr.code = 'PDF_PASSWORD_PROTECTED';
      throw passwordErr;
    }

    if (
      errName === 'InvalidPDFException' ||
      errName === 'FormatError' ||
      /corrupt|invalid|structure|format|xref/i.test(errMsg)
    ) {
      const corruptErr = new Error('The uploaded PDF could not be read. Please check the file and try again.');
      corruptErr.code = 'CORRUPT_PDF';
      throw corruptErr;
    }

    logger.error('Unexpected error parsing PDF:', err);
    const genericErr = new Error('The uploaded PDF could not be read. Please check the file and try again.');
    genericErr.code = 'CORRUPT_PDF';
    throw genericErr;
  }

  const totalPages = parser.doc?.numPages || (textResult?.pages?.length || 1);

  if (totalPages > maxPages) {
    const pageErr = new Error(`PDF exceeds maximum allowed page count of ${maxPages} pages.`);
    pageErr.code = 'PAGE_LIMIT_EXCEEDED';
    throw pageErr;
  }

  // Filter pages by range if specified
  let pagesToUse = textResult.pages || [];
  if (startPage || endPage) {
    const start = startPage ? Math.max(1, parseInt(startPage, 10)) : 1;
    const end = endPage ? Math.min(totalPages, parseInt(endPage, 10)) : totalPages;
    pagesToUse = pagesToUse.filter((p) => p.num >= start && p.num <= end);
  }

  const selectedPageCount = pagesToUse.length;
  const rawCombinedText = pagesToUse.map((p) => p.text || '').join('\n\n');

  // Normalize text
  const normalizedText = normalizeExtractedPdfText(rawCombinedText);

  // Scanned / image-only detection: average characters per page < 50
  const avgCharsPerPage = selectedPageCount > 0 ? normalizedText.length / selectedPageCount : 0;
  const scannedLikely = avgCharsPerPage < 50;
  let scannedMessage = null;
  if (scannedLikely) {
    scannedMessage =
      'This PDF looks like scanned images. Text extraction may be incomplete. For best results, use a document with selectable text or consider OCR before uploading.';
  }

  // Truncate at paragraph boundary if over limit
  const truncation = truncateAtParagraphBoundary(normalizedText, env.AI_MAX_SOURCE_CHARS);

  return {
    text: truncation.text,
    pageCount: selectedPageCount,
    totalPages,
    charCount: truncation.usedCharCount,
    originalCharCount: truncation.originalCharCount,
    usedCharCount: truncation.usedCharCount,
    truncated: truncation.truncated,
    scannedLikely,
    message: scannedMessage
  };
}

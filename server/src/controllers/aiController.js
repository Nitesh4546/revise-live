import { generateQuizFromMaterial } from '../services/geminiService.js';
import { extractPdfTextFromBuffer } from '../services/pdfExtractService.js';
import { env } from '../config/env.js';

export async function generateQuiz(req, res, next) {
  try {
    const isMockExplicitlyTrue = process.env.AI_MOCK === 'true' || process.env.AI_MOCK === '1';
    if (env.NODE_ENV === 'production' && !env.GEMINI_API_KEY && !isMockExplicitlyTrue) {
      return res.status(503).json({
        error: {
          code: 'AI_UNAVAILABLE',
          message: 'AI quiz generation service is unavailable: GEMINI_API_KEY is not configured and AI_MOCK is not explicitly enabled in production.'
        }
      });
    }

    const { topic, title, sourceMaterial, notes, pdfText, questionCount, difficulty, timeLimit, language } = req.body;
    const resolvedMaterial = (sourceMaterial || notes || pdfText || '').trim();

    if (!resolvedMaterial || resolvedMaterial.length < 50) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Source material (or notes / pdfText) must be at least 50 characters'
        }
      });
    }

    const draft = await generateQuizFromMaterial({
      topic,
      title,
      sourceMaterial: resolvedMaterial,
      questionCount,
      difficulty,
      timeLimit,
      language
    });

    res.status(200).json({
      draft,
      quiz: draft // convenient alias for consumers
    });
  } catch (err) {
    if (err.status === 503 || err.code === 'AI_UNAVAILABLE') {
      return res.status(503).json({
        error: {
          code: 'AI_UNAVAILABLE',
          message: err.message
        }
      });
    }
    next(err);
  }
}

export async function extractPdf(req, res, next) {
  try {
    const file = req.file || (req.files && (req.files.pdf?.[0] || req.files.file?.[0]));
    if (!file) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE',
          message: 'No PDF file uploaded. Please upload a PDF file.'
        }
      });
    }

    const { startPage, endPage } = req.body || {};
    const result = await extractPdfTextFromBuffer(file.buffer, {
      startPage: startPage ? parseInt(startPage, 10) : undefined,
      endPage: endPage ? parseInt(endPage, 10) : undefined
    });

    res.status(200).json(result);
  } catch (err) {
    if (
      err.code === 'INVALID_FILE' ||
      err.code === 'INVALID_PDF' ||
      err.code === 'PDF_PASSWORD_PROTECTED' ||
      err.code === 'CORRUPT_PDF' ||
      err.code === 'PAGE_LIMIT_EXCEEDED'
    ) {
      return res.status(400).json({
        error: {
          code: err.code,
          message: err.message
        }
      });
    }
    if (err.code === 'EXTRACTION_TIMEOUT') {
      return res.status(408).json({
        error: {
          code: 'EXTRACTION_TIMEOUT',
          message: err.message
        }
      });
    }
    next(err);
  }
}


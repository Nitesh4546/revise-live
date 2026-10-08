import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import PDFDocument from 'pdfkit';
import { createExpressApp } from '../src/server.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import {
  normalizeExtractedPdfText,
  truncateAtParagraphBoundary,
  extractPdfTextFromBuffer
} from '../src/services/pdfExtractService.js';

function createPdfBuffer(pagesContent = ['Hello world']) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', autoFirstPage: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const content of pagesContent) {
      doc.addPage();
      doc.text(content);
    }
    doc.end();
  });
}

function createEncryptedPdfBuffer(password = 'secret123') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      userPassword: password,
      ownerPassword: 'ownerPassword',
      autoFirstPage: true
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.text('This is protected sensitive material.');
    doc.end();
  });
}

describe('F5 PDF Source Upload & Extraction Service & REST Endpoint', () => {
  let app;
  let teacherToken;

  beforeAll(async () => {
    await setupTestDB();
    app = createExpressApp();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    const res = await request(app).post('/api/auth/register').send({
      name: 'Teacher Marie',
      email: 'marie@curie.edu',
      password: 'password123'
    });
    teacherToken = res.body.token;
  });

  describe('Unit Functions: normalizeExtractedPdfText & truncateAtParagraphBoundary', () => {
    it('normalizes hyphenated line breaks, control characters, and redundant whitespace', () => {
      const raw = 'Photosyn-\nthesis is an impor-\n tant biological process.\r\n\r\n\x00It creates glucose.';
      const normalized = normalizeExtractedPdfText(raw);
      expect(normalized).toContain('Photosynthesis');
      expect(normalized).toContain('important');
      expect(normalized).not.toContain('\x00');
      expect(normalized).toContain('It creates glucose.');
    });

    it('gracefully truncates text at paragraph boundaries when exceeding max length', () => {
      const p1 = 'First paragraph of content with substantial length to test paragraph boundaries.';
      const p2 = 'Second paragraph that continues the lecture notes on cell metabolism.';
      const p3 = 'Third paragraph that should be excluded when character limit is capped.';
      const combined = `${p1}\n\n${p2}\n\n${p3}`;

      const res = truncateAtParagraphBoundary(combined, p1.length + p2.length + 5);
      expect(res.truncated).toBe(true);
      expect(res.text).toContain(p1);
      expect(res.text).toContain(p2);
      expect(res.text).not.toContain(p3);
      expect(res.usedCharCount).toBe(res.text.length);
    });

    it('returns untruncated result if text is within limit', () => {
      const text = 'Short text within limit.';
      const res = truncateAtParagraphBoundary(text, 100);
      expect(res.truncated).toBe(false);
      expect(res.text).toBe(text);
      expect(res.usedCharCount).toBe(text.length);
    });
  });

  describe('Unit Service: extractPdfTextFromBuffer', () => {
    it('rejects buffers without %PDF- magic bytes', async () => {
      const invalidBuffer = Buffer.from('Plain text file pretending to be PDF');
      await expect(extractPdfTextFromBuffer(invalidBuffer)).rejects.toThrow(
        /not a valid PDF document/
      );
    });

    it('detects encrypted/password-protected PDFs cleanly', async () => {
      const encryptedBuf = await createEncryptedPdfBuffer('secret');
      await expect(extractPdfTextFromBuffer(encryptedBuf)).rejects.toThrow(
        /password-protected/
      );
    });

    it('enforces page cap when total pages exceed allowed maximum', async () => {
      const multiPageBuf = await createPdfBuffer(['Page 1', 'Page 2', 'Page 3']);
      await expect(
        extractPdfTextFromBuffer(multiPageBuf, { maxPages: 2 })
      ).rejects.toThrow(/exceeds maximum allowed page count/);
    });

    it('flags likely scanned/image-only PDFs when characters per page is below threshold', async () => {
      const sparseBuf = await createPdfBuffer(['Hi', 'Bye']);
      const res = await extractPdfTextFromBuffer(sparseBuf);
      expect(res.scannedLikely).toBe(true);
      expect(res.message).toMatch(/scanned images/i);
    });
  });

  describe('REST Endpoint: POST /api/ai/extract-pdf', () => {
    it('requires authentication (401 for unauthenticated request)', async () => {
      const pdfBuf = await createPdfBuffer(['Content here']);
      const res = await request(app)
        .post('/api/ai/extract-pdf')
        .attach('pdf', pdfBuf, 'notes.pdf');

      expect(res.status).toBe(401);
    });

    it('returns 400 INVALID_FILE when no file is uploaded', async () => {
      const res = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE');
    });

    it('returns 400 INVALID_PDF when file magic bytes do not start with %PDF-', async () => {
      const fakePdf = Buffer.from('Invalid non-pdf data');
      const res = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('pdf', fakePdf, 'fake.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PDF');
    });

    it('returns 400 CORRUPT_PDF when PDF structure is corrupt', async () => {
      const corruptBuf = Buffer.from('%PDF-1.4\ncorrupted bytes invalid trailer');
      const res = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('pdf', corruptBuf, 'corrupt.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CORRUPT_PDF');
    });

    it('returns 400 PDF_PASSWORD_PROTECTED when uploading password protected PDF', async () => {
      const encryptedBuf = await createEncryptedPdfBuffer('secretPass');
      const res = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('pdf', encryptedBuf, 'encrypted.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PDF_PASSWORD_PROTECTED');
      expect(res.body.error.message).toMatch(/password-protected/i);
    });

    it('successfully extracts text from valid PDF with page range support', async () => {
      const page1 = 'First page: Cellular respiration occurs in three main stages: glycolysis, Krebs cycle, and electron transport chain.';
      const page2 = 'Second page: Glycolysis produces a net gain of two ATP molecules and two pyruvate molecules per glucose.';
      const page3 = 'Third page: Oxidative phosphorylation yields the majority of ATP through the mitochondrial ATP synthase enzyme.';
      const pdfBuf = await createPdfBuffer([page1, page2, page3]);

      // Extract all pages
      const resAll = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('pdf', pdfBuf, 'lecture.pdf');

      expect(resAll.status).toBe(200);
      expect(resAll.body.text).toContain('Cellular respiration occurs');
      expect(resAll.body.text).toContain('Glycolysis produces');
      expect(resAll.body.text).toContain('Oxidative phosphorylation');
      expect(resAll.body.totalPages).toBe(3);
      expect(resAll.body.pageCount).toBe(3);
      expect(resAll.body.scannedLikely).toBe(false);

      // Extract only page 2 using custom page range
      const resRange = await request(app)
        .post('/api/ai/extract-pdf')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('startPage', '2')
        .field('endPage', '2')
        .attach('pdf', pdfBuf, 'lecture.pdf');

      expect(resRange.status).toBe(200);
      expect(resRange.body.text).toContain('Glycolysis produces');
      expect(resRange.body.text).not.toContain('Cellular respiration occurs');
      expect(resRange.body.pageCount).toBe(1);
    });
  });

  describe('Integration: POST /api/ai/generate-quiz with pdfText', () => {
    it('accepts pdfText directly and generates grounded questions in mock mode', async () => {
      const lectureNotes =
        'Cellular respiration is a series of chemical reactions that break down glucose to produce ATP. ' +
        'The primary reaction cycle drives active transformation in Cellular Respiration. ' +
        'Substrate concentration governs the reaction kinetic rate. ' +
        'Increased temperature raises average kinetic velocity and fruitful collision rates. ' +
        'Endothermic processes absorb heat from the surroundings while exothermic ones release heat. ' +
        'Side reactions and dynamic equilibrium invariably reduce real yield below theoretical maximums.';

      const res = await request(app)
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          topic: 'Cellular Respiration',
          pdfText: lectureNotes,
          questionCount: 3,
          difficulty: 'mixed'
        });

      expect(res.status).toBe(200);
      const draft = res.body.quiz || res.body.draft;
      expect(draft).toBeDefined();
      expect(draft.topic).toBe('Cellular Respiration');
      expect(draft.questions.length).toBe(3);
      expect(draft.questions[0].options.length).toBe(4);
      expect(draft.questions[0].explanation).toBeDefined();
    });

    it('rejects generate-quiz if material / pdfText is shorter than 50 characters', async () => {
      const res = await request(app)
        .post('/api/ai/generate-quiz')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          topic: 'Short',
          pdfText: 'Too short text'
        });

      expect(res.status).toBe(400);
    });
  });
});

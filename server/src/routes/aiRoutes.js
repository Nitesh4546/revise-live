import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { generateQuiz, extractPdf } from '../controllers/aiController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { aiRateLimiter, aiExtractRateLimiter } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.AI_MAX_PDF_MB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname?.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      const err = new Error('Only PDF files are supported.');
      err.code = 'INVALID_MIME_TYPE';
      cb(err, false);
    }
  }
});

function uploadPdfMiddleware(req, res, next) {
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: `PDF file exceeds the maximum allowed size of ${env.AI_MAX_PDF_MB}MB.`
          }
        });
      }
      return res.status(400).json({
        error: {
          code: err.code || 'UPLOAD_ERROR',
          message: err.message || 'Error uploading file.'
        }
      });
    }

    if (req.files) {
      req.file = (req.files.pdf && req.files.pdf[0]) || (req.files.file && req.files.file[0]);
    }
    next();
  });
}

const generateQuizSchema = z
  .object({
    title: z.string().trim().max(100).optional(),
    topic: z.string().trim().min(1, 'Topic is required').max(100),
    sourceMaterial: z
      .string()
      .trim()
      .max(env.AI_MAX_SOURCE_CHARS, `Source material cannot exceed ${env.AI_MAX_SOURCE_CHARS} characters`)
      .optional(),
    notes: z
      .string()
      .trim()
      .max(env.AI_MAX_SOURCE_CHARS, `Notes cannot exceed ${env.AI_MAX_SOURCE_CHARS} characters`)
      .optional(),
    pdfText: z
      .string()
      .trim()
      .max(env.AI_MAX_SOURCE_CHARS, `PDF text cannot exceed ${env.AI_MAX_SOURCE_CHARS} characters`)
      .optional(),
    questionCount: z.coerce.number().int().min(1).max(env.AI_MAX_QUESTIONS).default(10),
    difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
    timeLimit: z.coerce.number().int().min(10).max(120).default(20),
    language: z.string().trim().max(40).optional().default('English')
  })
  .refine(
    (data) => {
      const material = (data.sourceMaterial || data.notes || data.pdfText || '').trim();
      return material.length >= 50;
    },
    {
      message: 'Source material (or notes / pdfText) must be at least 50 characters',
      path: ['sourceMaterial']
    }
  );

router.use(authMiddleware);

router.post(
  '/extract-pdf',
  aiExtractRateLimiter,
  uploadPdfMiddleware,
  extractPdf
);

router.post(
  '/generate-quiz',
  aiRateLimiter,
  validateRequest({ body: generateQuizSchema }),
  generateQuiz
);

export default router;

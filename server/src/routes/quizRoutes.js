import { Router } from 'express';
import { z } from 'zod';
import {
  listQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  duplicateQuiz,
  exportQuizPdf
} from '../controllers/quizController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { gameSettingsZodSchema } from '../utils/gameSettings.js';

const router = Router();

export const questionZodSchema = z.object({
  questionText: z.string().trim().min(1, 'Question text is required').max(300, 'Max 300 characters'),
  options: z
    .array(z.string().trim().min(1, 'Option cannot be empty').max(120, 'Max 120 characters per option'))
    .length(4, 'Must have exactly 4 options')
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === 4, {
      message: 'Options must be distinct'
    }),
  correctIndex: z.number().int().min(0).max(3),
  distractorRationales: z.array(z.string().trim().max(300)).optional().default([]),
  sourceQuote: z.string().trim().max(200).optional(),
  grounded: z.boolean().optional(),
  type: z.enum(['mcq', 'truefalse', 'typein']).optional().default('mcq'),
  explanation: z.string().trim().min(1, 'Explanation is required').max(400, 'Max 400 characters'),
  topicTag: z.string().trim().max(40).default('General'),
  timeLimit: z.number().int().min(10).max(120).default(20)
});

export const quizZodSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Max 100 characters'),
  topic: z.string().trim().min(1, 'Topic is required').max(100, 'Max 100 characters'),
  description: z.string().trim().max(300).optional().default(''),
  sourceMaterial: z.string().trim().max(30000).optional().default(''),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  defaultSettings: gameSettingsZodSchema.partial().optional(),
  questions: z.array(questionZodSchema).min(1, 'Must have at least 1 question').max(50, 'Max 50 questions')
});

const quizQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
});

router.use(authMiddleware);

router.get('/', validateRequest({ query: quizQuerySchema }), listQuizzes);
router.get('/:id/export.pdf', exportQuizPdf);
router.get('/:id', getQuiz);
router.post('/', validateRequest({ body: quizZodSchema }), createQuiz);
router.put('/:id', validateRequest({ body: quizZodSchema }), updateQuiz);
router.delete('/:id', deleteQuiz);
router.post('/:id/duplicate', duplicateQuiz);

export default router;

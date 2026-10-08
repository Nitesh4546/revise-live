import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEV_JWT_PLACEHOLDERS = [
  'super-secret-dev-jwt-key-change-in-prod-min-32-chars',
  'super-secret-jwt-key-for-development-change-me',
  'dev-placeholder',
  'change-in-prod'
];

const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    MONGODB_URI: z.string().default('mongodb://localhost:27017/revise_live'),
    JWT_SECRET: z.string().default('super-secret-dev-jwt-key-change-in-prod-min-32-chars'),
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    AI_MOCK: z
      .string()
      .optional()
      .transform((val) => {
        if (val !== undefined && val !== '') {
          return val === 'true' || val === '1';
        }
        // In production, do NOT implicitly default AI_MOCK to true when key is missing
        if (process.env.NODE_ENV === 'production') {
          return false;
        }
        // In development/test, default to false if GEMINI_API_KEY is present, true if missing
        const key = process.env.GEMINI_API_KEY;
        return !(key && key.trim().length > 0);
      })
      .default(''),
    CLIENT_URL: z.string().default('http://localhost:5173'),
    GRACE_MS: z.coerce.number().default(300),
    HOST_GRACE_MS: z.coerce.number().default(300000),
    MAX_PLAYERS_PER_ROOM: z.coerce.number().default(300),
    MAX_ACTIVE_ROOMS: z.coerce.number().default(200),
    AI_RATE_LIMIT_PER_HOUR: z.coerce.number().default(10),
    AI_MAX_SOURCE_CHARS: z.coerce.number().default(30000),
    AI_MAX_QUESTIONS: z.coerce.number().default(20),
    AI_MAX_PDF_MB: z.coerce.number().default(10),
    AI_MAX_PDF_PAGES: z.coerce.number().default(100),
    AI_PDF_EXTRACT_TIMEOUT_MS: z.coerce.number().default(15000),
    AI_EXTRACT_RATE_LIMIT_PER_HOUR: z.coerce.number().default(20),
    PDF_MAX_STUDENTS: z.coerce.number().default(300),
    FINISHED_ROOM_TTL_MIN: z.coerce.number().default(60),
    RECEIPT_TTL_DAYS: z.coerce.number().default(30),
    SESSION_RETENTION_DAYS: z.coerce.number().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
  })
  .superRefine((data, ctx) => {
    // In production, JWT_SECRET must be explicitly set, at least 32 chars, and not a dev placeholder
    if (data.NODE_ENV === 'production') {
      const isPlaceholder = DEV_JWT_PLACEHOLDERS.some((p) =>
        data.JWT_SECRET.toLowerCase().includes(p.toLowerCase())
      );
      if (!data.JWT_SECRET || data.JWT_SECRET.length < 32 || isPlaceholder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'In production (NODE_ENV=production), JWT_SECRET must be explicitly provided, at least 32 characters long, and cannot be a default development placeholder.'
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export default env;

import { Router } from 'express';
import { z } from 'zod';
import { register, login, getMe, updatePreferences } from '../controllers/authController.js';
import { validateRequest } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long')
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system'], {
    errorMap: () => ({ message: "Theme must be one of 'light', 'dark', or 'system'" })
  })
});

router.post('/register', authRateLimiter, validateRequest({ body: registerSchema }), register);
router.post('/login', authRateLimiter, validateRequest({ body: loginSchema }), login);
router.get('/me', authMiddleware, getMe);
router.patch('/preferences', authMiddleware, validateRequest({ body: preferencesSchema }), updatePreferences);

export default router;

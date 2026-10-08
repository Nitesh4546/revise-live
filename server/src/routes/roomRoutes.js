import { Router } from 'express';
import { roomManager } from '../sockets/roomManager.js';
import { roomLookupSuccessRateLimiter, failedPinTracker } from '../middleware/rateLimit.js';

const router = Router();

router.get('/:pin', roomLookupSuccessRateLimiter, (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? String(forwarded).split(',')[0].trim() : null) || req.ip || req.socket?.remoteAddress || 'unknown';

  // Check if IP is throttled for too many wrong PIN attempts
  if (failedPinTracker.isBlocked(ip)) {
    return res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many invalid PIN attempts. Please wait before guessing again.'
      }
    });
  }

  const pin = req.params.pin?.trim();
  const room = roomManager.getRoom(pin);

  if (!room) {
    failedPinTracker.recordFailure(ip);
    return res.status(200).json({
      exists: false,
      status: null,
      locked: false
    });
  }

  res.status(200).json({
    exists: true,
    status: room.status,
    locked: room.locked,
    quizTitle: room.quiz.title
  });
});

export default router;

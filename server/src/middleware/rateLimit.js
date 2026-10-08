import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts, please try again later.'
      }
    });
  }
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.AI_RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AI_RATE_LIMITED',
        message: `AI generation limit reached (${env.AI_RATE_LIMIT_PER_HOUR} per hour). Please try again later.`
      }
    });
  }
});

export const aiExtractRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.AI_EXTRACT_RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AI_EXTRACT_RATE_LIMITED',
        message: `PDF extraction limit reached (${env.AI_EXTRACT_RATE_LIMIT_PER_HOUR} per hour). Please try again later.`
      }
    });
  }
});

/**
 * Sliding window tracker for failed PIN lookups (wrong PIN brute-force defense)
 * Defaults to 100 failed lookups in 1 minute.
 * IPs with a recent successful join in the last 10 minutes receive a larger budget (500)
 * to prevent one student from blocking a whole school NAT.
 */
export class FailedPinTracker {
  constructor(maxFailures = 100, windowMs = 60 * 1000, trustedMaxFailures = 500, trustedWindowMs = 10 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.trustedMaxFailures = trustedMaxFailures;
    this.windowMs = windowMs;
    this.trustedWindowMs = trustedWindowMs;
    this.failures = new Map(); // ip -> [timestamp]
    this.successfulJoins = new Map(); // ip -> timestamp
  }

  recordSuccessfulJoin(ip) {
    if (!ip) return;
    this.successfulJoins.set(ip, Date.now());
  }

  isBlocked(ip) {
    if (!ip) return false;
    const now = Date.now();
    const list = this.failures.get(ip);
    if (!list) return false;
    const recent = list.filter((t) => now - t < this.windowMs);
    this.failures.set(ip, recent);

    const lastJoin = this.successfulJoins.get(ip);
    const hasRecentJoin = lastJoin && now - lastJoin < this.trustedWindowMs;
    const effectiveLimit = hasRecentJoin ? this.trustedMaxFailures : this.maxFailures;

    return recent.length >= effectiveLimit;
  }

  recordFailure(ip) {
    if (!ip) return;
    const now = Date.now();
    const list = this.failures.get(ip) || [];
    const recent = list.filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.failures.set(ip, recent);
  }

  reset(ip) {
    if (ip) {
      this.failures.delete(ip);
      this.successfulJoins.delete(ip);
    } else {
      this.failures.clear();
      this.successfulJoins.clear();
    }
  }
}

export const failedPinTracker = new FailedPinTracker(100, 60 * 1000, 500, 10 * 60 * 1000);

/**
 * Keyed on IP + PIN with a high ceiling (1000/min) so entire classrooms on a shared IP
 * can query a valid PIN without getting throttled.
 */
export const roomLookupSuccessRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (forwarded ? String(forwarded).split(',')[0].trim() : null) || req.ip || 'unknown';
    return `${ip}:${req.params.pin || ''}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many queries for this game PIN. Please slow down.'
      }
    });
  }
});

// Backward-compatible alias
export const roomLookupRateLimiter = roomLookupSuccessRateLimiter;

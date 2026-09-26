import rateLimit from 'express-rate-limit';

export const investigationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                  // max 20 investigation submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many investigation requests. Please wait before trying again.' },
});
import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't count successful logins against the brute-force bucket — only
  // failed attempts matter for login rate-limiting.
  skipSuccessfulRequests: true,
});

// /auth/refresh fires automatically every ~14 min per active tab. Give it
// its own generous bucket so a user with multiple tabs (or a tab left open
// overnight) never trips the general limiter and gets locked out.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many token refresh attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

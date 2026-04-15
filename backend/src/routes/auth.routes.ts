import { Router } from 'express';
import { authLimiter, refreshLimiter } from '../middleware/rateLimiter.middleware';
import { register, login, refresh, forgotPassword, verify2fa } from '../controllers/auth.controller';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-2fa', authLimiter, verify2fa);

export default router;

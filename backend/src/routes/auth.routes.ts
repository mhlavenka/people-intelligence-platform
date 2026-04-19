import { Router } from 'express';
import { authLimiter, refreshLimiter } from '../middleware/rateLimiter.middleware';
import { verifyRecaptcha } from '../middleware/recaptcha.middleware';
import { register, login, refresh, forgotPassword, verify2fa } from '../controllers/auth.controller';

const router = Router();

router.post('/register', authLimiter, verifyRecaptcha, register);
router.post('/login', authLimiter, verifyRecaptcha, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/forgot-password', authLimiter, verifyRecaptcha, forgotPassword);
router.post('/verify-2fa', authLimiter, verify2fa);

export default router;

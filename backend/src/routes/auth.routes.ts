import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.middleware';
import { register, login, refresh, forgotPassword } from '../controllers/auth.controller';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/forgot-password', authLimiter, forgotPassword);

export default router;

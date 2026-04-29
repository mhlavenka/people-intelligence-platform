import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authLimiter, refreshLimiter } from '../middleware/rateLimiter.middleware';
import { verifyRecaptcha } from '../middleware/recaptcha.middleware';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { register, login, refresh, forgotPassword, verify2fa } from '../controllers/auth.controller';
import { LoginSession } from '../models/LoginSession.model';
import { logActivity } from '../services/activityLog.service';

const router = Router();

router.post('/register', authLimiter, verifyRecaptcha, register);
router.post('/login', authLimiter, verifyRecaptcha, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/forgot-password', authLimiter, verifyRecaptcha, forgotPassword);
router.post('/verify-2fa', authLimiter, verify2fa);

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await LoginSession.deleteOne({ tokenHash });
    if (req.user) {
      logActivity({
        org: req.user.organizationId,
        actor: req.user.userId,
        type: 'auth.logout',
        label: 'Signed out',
      });
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

export default router;

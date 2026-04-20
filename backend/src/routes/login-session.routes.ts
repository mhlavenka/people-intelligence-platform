import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { LoginSession } from '../models/LoginSession.model';

const router = Router();
router.use(authenticateToken, tenantResolver);

// GET /api/auth/sessions — list current user's active sessions
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await LoginSession.find({ userId: req.user!.userId })
      .sort({ lastActiveAt: -1 })
      .lean();

    const currentTokenHash = hashToken(req.headers.authorization?.replace('Bearer ', '') || '');

    const result = sessions.map((s) => ({
      _id: s._id,
      device: s.device,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.tokenHash === currentTokenHash,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/sessions/:id — revoke a specific session
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await LoginSession.findOne({
      _id: req.params['id'],
      userId: req.user!.userId,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await session.deleteOne();
    res.json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/sessions — revoke all sessions except current
router.delete('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const currentTokenHash = hashToken(req.headers.authorization?.replace('Bearer ', '') || '');

    await LoginSession.deleteMany({
      userId: req.user!.userId,
      tokenHash: { $ne: currentTokenHash },
    });

    res.json({ message: 'All other sessions revoked' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/sessions/org — admin: list all org sessions
router.get('/org', requireRole('admin', 'hr_manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessions = await LoginSession.find({ organizationId: req.user!.organizationId })
      .populate('userId', 'firstName lastName email role profilePicture')
      .sort({ lastActiveAt: -1 })
      .lean();

    const result = sessions.map((s) => ({
      _id: s._id,
      user: s.userId,
      device: s.device,
      ip: s.ip,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/sessions/org/:id — admin: revoke any session in org
router.delete('/org/:id', requireRole('admin', 'hr_manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await LoginSession.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    await session.deleteOne();
    res.json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
});

function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default router;
export { hashToken };

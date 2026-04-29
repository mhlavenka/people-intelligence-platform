import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { LoginSession } from '../models/LoginSession.model';
import { logActivity } from '../services/activityLog.service';

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

// GET /api/auth/sessions/org — admin: list active org sessions.
// The LoginSession TTL is synced to AppSettings.sessionPolicy.autoLogoutMinutes
// (see loginSessionPolicy.service.ts), so any row in the collection is by
// definition still within the active window. No additional filter needed.
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

// DELETE /api/auth/sessions/org/stale — admin: remove sessions inactive for 1+ hour
router.delete('/org/stale', requireRole('admin', 'hr_manager'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const result = await LoginSession.deleteMany({
      organizationId: req.user!.organizationId,
      lastActiveAt: { $lt: cutoff },
    });
    if (result.deletedCount > 0) {
      logActivity({
        org: req.user!.organizationId, actor: req.user!.userId,
        type: 'auth.sessions.stale_purged',
        label: 'Stale login sessions purged',
        detail: `${result.deletedCount} session(s)`,
      });
    }
    res.json({ message: `${result.deletedCount} stale session(s) removed` });
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
    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'auth.session.revoked_by_admin',
      label: 'Login session revoked (by admin)',
      refModel: 'User', refId: session.userId,
    });
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

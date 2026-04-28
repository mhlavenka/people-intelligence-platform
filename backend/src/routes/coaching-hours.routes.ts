import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { CoachingHoursLog } from '../models/CoachingHoursLog.model';
import { User } from '../models/User.model';
import { getHoursSummary, getHoursLogEntries } from '../services/coachingHours.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

/**
 * Resolve which coach's hours the request is asking for.
 *
 *   - coach role:           always self
 *   - admin / hr_manager:   defaults to self; can override via ?coachId=
 *   - anyone else:          rejected by requirePermission below
 *
 * Returns null when the requested coachId is invalid or out-of-tenant.
 */
async function resolveCoachId(req: AuthRequest): Promise<mongoose.Types.ObjectId | null> {
  const requested = (req.query['coachId'] as string | undefined)
    ?? (req.body?.coachId as string | undefined);

  if (req.user!.role === 'coach' || !requested) {
    return new mongoose.Types.ObjectId(req.user!.userId);
  }

  if (!mongoose.isValidObjectId(requested)) return null;

  // Confirm the requested coach belongs to the same tenant.
  const coach = await User.findOne({
    _id: requested,
    organizationId: req.user!.organizationId,
  }).select('_id').lean();
  if (!coach) return null;

  return new mongoose.Types.ObjectId(requested);
}

function parseDateRange(req: AuthRequest): { from?: Date; to?: Date } {
  const range: { from?: Date; to?: Date } = {};
  const from = req.query['from'] as string | undefined;
  const to = req.query['to'] as string | undefined;
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.from = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) range.to = d;
  }
  return range;
}

// ─── Summary & entries ───────────────────────────────────────────────────────

router.get(
  '/summary',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
      const summary = await getHoursSummary(orgId, coachId, parseDateRange(req));
      res.json(summary);
    } catch (e) { next(e); }
  },
);

router.get(
  '/entries',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
      const entries = await getHoursLogEntries(orgId, coachId, parseDateRange(req));
      res.json(entries);
    } catch (e) { next(e); }
  },
);

// ─── Manual log CRUD ─────────────────────────────────────────────────────────

router.post(
  '/',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const entry = await CoachingHoursLog.create({
        ...req.body,
        coachId,
        organizationId: req.user!.organizationId,
      });
      res.status(201).json(entry);
    } catch (e) { next(e); }
  },
);

router.put(
  '/:id',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const existing = await CoachingHoursLog.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!existing) { res.status(404).json({ error: 'Entry not found' }); return; }

      // A coach can only edit their own entries; admin/hr_manager can edit any.
      if (req.user!.role === 'coach' && String(existing.coachId) !== req.user!.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // Don't let the client reassign coachId / organizationId via body.
      const { coachId: _ignoreCoach, organizationId: _ignoreOrg, ...rest } = req.body;
      Object.assign(existing, rest);
      await existing.save();
      res.json(existing);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/:id',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const existing = await CoachingHoursLog.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!existing) { res.status(404).json({ error: 'Entry not found' }); return; }

      if (req.user!.role === 'coach' && String(existing.coachId) !== req.user!.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await existing.deleteOne();
      res.status(204).end();
    } catch (e) { next(e); }
  },
);

router.get(
  '/',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const filter: Record<string, unknown> = {
        organizationId: req.user!.organizationId,
        coachId,
      };

      const category = req.query['category'] as string | undefined;
      if (category) filter['category'] = category;

      const range = parseDateRange(req);
      if (range.from || range.to) {
        filter['date'] = {};
        if (range.from) (filter['date'] as any).$gte = range.from;
        if (range.to)   (filter['date'] as any).$lte = range.to;
      }

      const entries = await CoachingHoursLog.find(filter).sort({ date: -1 });
      res.json(entries);
    } catch (e) { next(e); }
  },
);

export default router;

import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { CoachingHoursLog } from '../models/CoachingHoursLog.model';
import { User } from '../models/User.model';
import { getHoursSummary, getHoursLogEntries } from '../services/coachingHours.service';
import { importCsv, exportCsv } from '../services/coachingHoursCsv.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB — far more than any realistic ICF log
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.mimetype === 'application/csv'
      || file.mimetype === 'text/plain'
      || file.originalname.toLowerCase().endsWith('.csv');
    if (!ok) { cb(new Error('Only CSV files are accepted')); return; }
    cb(null, true);
  },
});

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

// ─── CSV import / export ─────────────────────────────────────────────────────

/**
 * POST /import — accepts a CSV upload.
 *
 *   multipart form fields:
 *     file:    .csv (required)
 *     dryRun:  'true' | 'false'   (default: 'true')
 *     coachId: ObjectId           (admin override)
 *
 * On dryRun (the default), no rows are inserted; the response includes a
 * row-by-row preview with errors. On dryRun=false the valid rows are
 * persisted and the same preview is returned for confirmation UI.
 */
router.post(
  '/import',
  requirePermission('MANAGE_COACHING'),
  csvUpload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'CSV file required' }); return; }

      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const dryRun = (req.body?.dryRun ?? 'true') !== 'false';
      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);

      const preview = await importCsv(orgId, coachId, req.file.buffer, req.file.originalname, { dryRun });
      res.json(preview);
    } catch (e) {
      // Header / parse errors come through as Error('CSV parse failed: ...') etc.
      if (e instanceof Error && (e.message.startsWith('CSV parse failed') || e.message.startsWith('Missing required column'))) {
        res.status(400).json({ error: e.message });
        return;
      }
      next(e);
    }
  },
);

/**
 * GET /export.csv — returns a flat CSV of session-derived + manual rows
 * for the requested coach + range.
 */
router.get(
  '/export.csv',
  requirePermission('MANAGE_COACHING'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = await resolveCoachId(req);
      if (!coachId) { res.status(404).json({ error: 'Coach not found' }); return; }

      const orgId = new mongoose.Types.ObjectId(req.user!.organizationId);
      const csv = await exportCsv(orgId, coachId, parseDateRange(req));

      const filename = `icf-hours-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e) { next(e); }
  },
);

export default router;

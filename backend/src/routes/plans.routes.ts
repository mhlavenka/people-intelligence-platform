import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Plan } from '../models/Plan.model';
import { logActivity } from '../services/activityLog.service';

const router = Router();
router.use(authenticateToken);

// ─── GET /api/plans — available plans (any authenticated user, for billing sidebar) ──

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1, priceMonthly: 1 }).lean();
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// ─── All write operations: system_admin only ──────────────────────────────────

router.use(requireRole('system_admin'));

// GET /api/plans/admin — all plans including inactive
router.get('/admin', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await Plan.find({}).sort({ sortOrder: 1, priceMonthly: 1 }).lean();
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// POST /api/plans — create a plan
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key, name, description, priceMonthly, overagePriceCents, maxUsers, modules, limits, features, isActive, sortOrder } = req.body;

    if (!key || !name || priceMonthly === undefined || !maxUsers) {
      res.status(400).json({ error: req.t('errors.planFieldsRequired') });
      return;
    }

    const plan = await Plan.create({
      key,
      name,
      description: description ?? '',
      priceMonthly,
      overagePriceCents: overagePriceCents ?? 1500,
      maxUsers,
      modules: modules ?? [],
      limits: limits ?? {},
      features: features ?? [],
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    // Plans are global (no organizationId) — log against the system-admin's home org.
    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'sysadmin.plan.created', label: 'Plan created (system-admin)',
      detail: `${plan.key} — ${plan.name}`,
      refModel: 'Plan', refId: plan._id,
    });

    res.status(201).json(plan);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: req.t('errors.planKeyExists') });
      return;
    }
    next(e);
  }
});

// PUT /api/plans/:id — update a plan
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = await Plan.findById(req.params['id']);
    if (!plan) {
      res.status(404).json({ error: req.t('errors.planNotFound') });
      return;
    }

    const { key, name, description, priceMonthly, overagePriceCents, maxUsers, modules, limits, features, isActive, sortOrder } = req.body;

    if (key !== undefined) plan.key = key;
    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (priceMonthly !== undefined) plan.priceMonthly = priceMonthly;
    if (overagePriceCents !== undefined) plan.overagePriceCents = overagePriceCents;
    if (maxUsers !== undefined) plan.maxUsers = maxUsers;
    if (modules !== undefined) plan.modules = modules;
    if (limits !== undefined) Object.assign(plan.limits, limits);
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;

    await plan.save();
    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'sysadmin.plan.updated', label: 'Plan updated (system-admin)',
      detail: `${plan.key} — ${plan.name}`,
      refModel: 'Plan', refId: plan._id,
    });
    res.json(plan);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: req.t('errors.planKeyExists') });
      return;
    }
    next(e);
  }
});

// DELETE /api/plans/:id — delete a plan
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params['id']);
    if (!plan) {
      res.status(404).json({ error: req.t('errors.planNotFound') });
      return;
    }
    logActivity({
      org: req.user!.organizationId, actor: req.user!.userId,
      type: 'sysadmin.plan.deleted', label: 'Plan deleted (system-admin)',
      detail: `${plan.key} — ${plan.name}`,
    });
    res.json({ message: 'Plan deleted' });
  } catch (e) {
    next(e);
  }
});

export default router;

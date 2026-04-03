import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Plan } from '../models/Plan.model';

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
    const { key, name, description, priceMonthly, overagePriceCents, maxUsers, features, isActive, sortOrder } = req.body as {
      key: string;
      name: string;
      description?: string;
      priceMonthly: number;
      overagePriceCents?: number;
      maxUsers: number;
      features?: string[];
      isActive?: boolean;
      sortOrder?: number;
    };

    if (!key || !name || priceMonthly === undefined || !maxUsers) {
      res.status(400).json({ error: 'key, name, priceMonthly, and maxUsers are required' });
      return;
    }

    const plan = await Plan.create({
      key,
      name,
      description: description ?? '',
      priceMonthly,
      overagePriceCents: overagePriceCents ?? 1500,
      maxUsers,
      features: features ?? [],
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
    });

    res.status(201).json(plan);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'A plan with that key already exists' });
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
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const { key, name, description, priceMonthly, overagePriceCents, maxUsers, features, isActive, sortOrder } = req.body as Partial<{
      key: string;
      name: string;
      description: string;
      priceMonthly: number;
      overagePriceCents: number;
      maxUsers: number;
      features: string[];
      isActive: boolean;
      sortOrder: number;
    }>;

    if (key !== undefined) plan.key = key;
    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (priceMonthly !== undefined) plan.priceMonthly = priceMonthly;
    if (overagePriceCents !== undefined) plan.overagePriceCents = overagePriceCents;
    if (maxUsers !== undefined) plan.maxUsers = maxUsers;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;

    await plan.save();
    res.json(plan);
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'A plan with that key already exists' });
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
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    res.json({ message: 'Plan deleted' });
  } catch (e) {
    next(e);
  }
});

export default router;

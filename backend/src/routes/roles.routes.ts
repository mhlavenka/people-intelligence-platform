import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { CustomRole } from '../models/CustomRole.model';
import { PERMISSION_GROUPS } from '../config/permissions';

const router = Router();

router.use(authenticateToken, tenantResolver);

/** Return all available permission group definitions (static, no DB). */
router.get('/permissions', (_req, res) => {
  res.json(PERMISSION_GROUPS);
});

/** List all custom roles for the current org. */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const roles = await CustomRole.find({ organizationId: req.user!.organizationId }).sort({ name: 1 });
    res.json(roles);
  } catch (e) {
    next(e);
  }
});

/** Get a single custom role. */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = await CustomRole.findOne({
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    });
    if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
    res.json(role);
  } catch (e) {
    next(e);
  }
});

/** Create a custom role. Admin and HR Manager only. */
router.post(
  '/',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.userId,
      });
      res.status(201).json(role);
    } catch (e) {
      next(e);
    }
  }
);

/** Update a custom role. Admin and HR Manager only. */
router.put(
  '/:id',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
      res.json(role);
    } catch (e) {
      next(e);
    }
  }
);

/** Delete a custom role. Admin only. */
router.delete(
  '/:id',
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!role) { res.status(404).json({ error: 'Role not found' }); return; }
      res.json({ message: 'Role deleted' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';

const router = Router();
router.use(authenticateToken);

// Convenience endpoint — no need to know the org ID on the frontend
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const org = await Organization.findById(req.user!.organizationId);
    if (!org) { res.status(404).json({ error: req.t('errors.organizationNotFound') }); return; }
    const currentUsers = await User.countDocuments({
      organizationId: req.user!.organizationId,
      isActive: { $ne: false },
    });
    res.json({ ...org.toObject(), currentUsers });
  } catch (e) { next(e); }
});

router.put(
  '/me',
  requirePermission('MANAGE_ORGANIZATION'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Protect immutable fields
      const { slug: _s, stripeCustomerId: _st, plan: _p, ...safeBody } = req.body;
      void _s; void _st; void _p;
      const org = await Organization.findByIdAndUpdate(
        req.user!.organizationId, safeBody, { new: true, runValidators: true }
      );
      if (!org) { res.status(404).json({ error: req.t('errors.organizationNotFound') }); return; }
      res.json(org);
    } catch (e) { next(e); }
  }
);

router.get('/:orgId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.organizationId !== req.params['orgId']) {
      res.status(403).json({ error: req.t('errors.accessDenied') });
      return;
    }
    const org = await Organization.findById(req.params['orgId']);
    if (!org) {
      res.status(404).json({ error: req.t('errors.organizationNotFound') });
      return;
    }
    res.json(org);
  } catch (e) {
    next(e);
  }
});

router.put(
  '/:orgId',
  requirePermission('MANAGE_ORGANIZATION'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.organizationId !== req.params['orgId']) {
        res.status(403).json({ error: req.t('errors.accessDenied') });
        return;
      }
      const org = await Organization.findByIdAndUpdate(req.params['orgId'], req.body, {
        new: true,
        runValidators: true,
      });
      if (!org) {
        res.status(404).json({ error: req.t('errors.organizationNotFound') });
        return;
      }
      res.json(org);
    } catch (e) {
      next(e);
    }
  }
);

export default router;

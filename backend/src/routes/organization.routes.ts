import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { Organization } from '../models/Organization.model';

const router = Router();
router.use(authenticateToken);

router.get('/:orgId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.organizationId !== req.params['orgId']) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const org = await Organization.findById(req.params['orgId']);
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }
    res.json(org);
  } catch (e) {
    next(e);
  }
});

router.put(
  '/:orgId',
  requireRole('admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user!.organizationId !== req.params['orgId']) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      const org = await Organization.findByIdAndUpdate(req.params['orgId'], req.body, {
        new: true,
        runValidators: true,
      });
      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }
      res.json(org);
    } catch (e) {
      next(e);
    }
  }
);

export default router;

import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { User } from '../models/User.model';

const router = Router();
router.use(authenticateToken, tenantResolver);

/** GET /api/org-chart — all active users in the org with their managerId */
router.get(
  '/',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const users = await User.find({ organizationId: req.user!.organizationId, isActive: true })
        .select('firstName lastName email role managerId')
        .sort({ role: 1, firstName: 1 })
        .setOptions({ bypassTenantCheck: true });
      res.json(users);
    } catch (e) {
      next(e);
    }
  }
);

/** PUT /api/org-chart — bulk-update managerId for multiple users */
router.put(
  '/',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const updates: Array<{ userId: string; managerId: string | null }> = req.body.updates;

      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({ error: 'updates array is required' });
        return;
      }

      // Validate all referenced users belong to this org
      const userIds = updates.map((u) => u.userId);
      const managerIds = updates.map((u) => u.managerId).filter(Boolean) as string[];

      const allRefIds = [...new Set([...userIds, ...managerIds])];
      const count = await User.countDocuments({
        _id: { $in: allRefIds },
        organizationId: orgId,
      }).setOptions({ bypassTenantCheck: true });

      if (count !== allRefIds.length) {
        res.status(400).json({ error: 'One or more users not found in this organization' });
        return;
      }

      await Promise.all(
        updates.map(({ userId, managerId }) =>
          User.updateOne(
            { _id: userId, organizationId: orgId },
            { managerId: managerId ? new mongoose.Types.ObjectId(managerId) : null }
          ).setOptions({ bypassTenantCheck: true })
        )
      );

      res.json({ updated: updates.length });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

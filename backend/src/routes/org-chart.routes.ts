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
      // Exclude external coachees (role='coachee') — they are coaching-only
      // accounts without org affiliation. Internal users who are ALSO being
      // coached (role=manager/hr_manager/etc. with isCoachee=true) stay in
      // the chart via their real role.
      const users = await User.find({
        organizationId: req.user!.organizationId,
        isActive: true,
        role: { $ne: 'coachee' },
      })
        .select('firstName lastName email role department managerId')
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

      // Every userId being updated MUST belong to this org — that's the
      // real integrity check. Stale managerIds (e.g. pointing at a former
      // employee that's been hard-deleted) should be silently coerced to
      // null rather than rejecting the whole save.
      const userIds = [...new Set(updates.map((u) => u.userId))];
      const userCount = await User.countDocuments({
        _id: { $in: userIds },
        organizationId: orgId,
      }).setOptions({ bypassTenantCheck: true });

      if (userCount !== userIds.length) {
        const foundUsers = await User.find({
          _id: { $in: userIds },
          organizationId: orgId,
        }).select('_id').setOptions({ bypassTenantCheck: true });
        const foundSet = new Set(foundUsers.map((u) => u._id.toString()));
        const missing = userIds.filter((id) => !foundSet.has(id));
        console.warn('[OrgChart] PUT rejected — user IDs not in org:', missing);
        res.status(400).json({
          error: 'One or more users not found in this organization',
          missing,
        });
        return;
      }

      // Resolve the subset of managerIds that actually exist in this org.
      // Any managerId that doesn't resolve is cleared to null on save.
      const rawManagerIds = updates
        .map((u) => u.managerId)
        .filter((id): id is string => !!id);
      const managerIds = [...new Set(rawManagerIds)];
      const validManagers = managerIds.length
        ? await User.find({
            _id: { $in: managerIds },
            organizationId: orgId,
          }).select('_id').setOptions({ bypassTenantCheck: true })
        : [];
      const validManagerSet = new Set(validManagers.map((u) => u._id.toString()));
      const droppedManagerIds = managerIds.filter((id) => !validManagerSet.has(id));
      if (droppedManagerIds.length) {
        console.warn('[OrgChart] Stale managerIds coerced to null:', droppedManagerIds);
      }

      await Promise.all(
        updates.map(({ userId, managerId }) => {
          const resolvedManagerId = managerId && validManagerSet.has(managerId)
            ? new mongoose.Types.ObjectId(managerId)
            : null;
          return User.updateOne(
            { _id: userId, organizationId: orgId },
            { managerId: resolvedManagerId }
          ).setOptions({ bypassTenantCheck: true });
        })
      );

      res.json({ updated: updates.length, droppedManagerIds });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

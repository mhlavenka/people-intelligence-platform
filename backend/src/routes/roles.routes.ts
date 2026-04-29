import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { CustomRole } from '../models/CustomRole.model';
import { SystemRoleOverride } from '../models/SystemRoleOverride.model';
import { PERMISSION_GROUPS, SYSTEM_ROLE_PERMISSIONS } from '../config/permissions';
import { logActivity } from '../services/activityLog.service';

const router = Router();

router.use(authenticateToken, tenantResolver);

/** Return all available permission group definitions (static, no DB). */
router.get('/permissions', (_req, res) => {
  res.json(PERMISSION_GROUPS);
});

// ── System role permission overrides (must be above /:id to avoid conflict) ──

/** Get effective system role permissions for this org (defaults + overrides). */
router.get('/system-roles', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const overrides = await SystemRoleOverride.find({ organizationId: orgId });
    const overrideMap: Record<string, string[]> = {};
    for (const o of overrides) { overrideMap[o.role] = o.permissions; }

    const result: Record<string, { permissions: string[]; isOverridden: boolean }> = {};
    for (const role of Object.keys(SYSTEM_ROLE_PERMISSIONS)) {
      if (role === 'system_admin') continue;
      result[role] = {
        permissions: overrideMap[role] ?? SYSTEM_ROLE_PERMISSIONS[role] ?? [],
        isOverridden: !!overrideMap[role],
      };
    }
    res.json(result);
  } catch (e) { next(e); }
});

/** Update permissions for a system role (org-level override). */
router.put(
  '/system-roles/:role',
  requirePermission('MANAGE_ROLES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { role } = req.params as { role: string };
      const { permissions } = req.body as { permissions: string[] };

      if (!SYSTEM_ROLE_PERMISSIONS[role] || role === 'system_admin') {
        res.status(400).json({ error: req.t('errors.invalidRole') });
        return;
      }

      const override = await SystemRoleOverride.findOneAndUpdate(
        { organizationId: orgId, role },
        { permissions, updatedBy: req.user!.userId },
        { upsert: true, new: true, runValidators: true }
      );

      logActivity({
        org: orgId, actor: req.user!.userId,
        type: 'role.system.permissions_overridden',
        label: 'System role permissions overridden',
        detail: `${role} — ${permissions.length} permission(s)`,
      });

      res.json(override);
    } catch (e) { next(e); }
  }
);

/** Reset a system role to defaults (remove override). */
router.delete(
  '/system-roles/:role',
  requirePermission('MANAGE_ROLES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const { role } = req.params as { role: string };
      await SystemRoleOverride.findOneAndDelete({ organizationId: orgId, role });
      logActivity({
        org: orgId, actor: req.user!.userId,
        type: 'role.system.permissions_reset',
        label: 'System role permissions reset to defaults',
        detail: role,
      });
      res.json({ message: 'Reset to defaults', permissions: SYSTEM_ROLE_PERMISSIONS[role] ?? [] });
    } catch (e) { next(e); }
  }
);

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
    if (!role) { res.status(404).json({ error: req.t('errors.roleNotFound') }); return; }
    res.json(role);
  } catch (e) {
    next(e);
  }
});

/** Create a custom role. Admin and HR Manager only. */
router.post(
  '/',
  requirePermission('MANAGE_ROLES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.userId,
      });
      logActivity({
        org: req.user!.organizationId, actor: req.user!.userId,
        type: 'role.custom.created', label: 'Custom role created',
        detail: role.name,
        refModel: 'CustomRole', refId: role._id,
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
  requirePermission('MANAGE_ROLES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        req.body,
        { new: true, runValidators: true }
      );
      if (!role) { res.status(404).json({ error: req.t('errors.roleNotFound') }); return; }
      logActivity({
        org: req.user!.organizationId, actor: req.user!.userId,
        type: 'role.custom.updated', label: 'Custom role updated',
        detail: role.name,
        refModel: 'CustomRole', refId: role._id,
      });
      res.json(role);
    } catch (e) {
      next(e);
    }
  }
);

/** Delete a custom role. Admin only. */
router.delete(
  '/:id',
  requirePermission('MANAGE_ROLES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = await CustomRole.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!role) { res.status(404).json({ error: req.t('errors.roleNotFound') }); return; }
      logActivity({
        org: req.user!.organizationId, actor: req.user!.userId,
        type: 'role.custom.deleted', label: 'Custom role deleted',
        detail: role.name,
      });
      res.json({ message: 'Role deleted' });
    } catch (e) {
      next(e);
    }
  }
);

export default router;

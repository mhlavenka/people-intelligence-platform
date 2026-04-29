import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.model';
import {
  getStats,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  suspendOrganization,
  listOrgUsers,
  updateOrgUser,
  startOrgTrial,
  endOrgTrial,
} from '../controllers/system-admin.controller';
import { logActivity } from '../services/activityLog.service';

const router = Router();

// All system-admin routes require authentication and system_admin role
router.use(authenticateToken, requireRole('system_admin'));

router.get('/stats',                                       getStats);
router.get('/organizations',                               listOrganizations);
router.post('/organizations',                              createOrganization);
router.get('/organizations/:id',                           getOrganization);
router.put('/organizations/:id',                           updateOrganization);
router.delete('/organizations/:id',                        suspendOrganization);
router.post('/organizations/:id/trial',                    startOrgTrial);
router.delete('/organizations/:id/trial',                  endOrgTrial);
router.get('/organizations/:id/users',                     listOrgUsers);
router.patch('/organizations/:id/users/:userId',           updateOrgUser);

/** Create a user in a specific organization (system admin). */
router.post('/organizations/:id/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;
    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: req.t('errors.fieldsRequired', { fields: 'firstName, lastName, email, password' }) });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      organizationId: req.params['id'],
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: role || 'admin',
    });
    // Log to the TARGET org's activity log (not the system-admin's home org).
    logActivity({
      org: req.params['id']!, actor: req.user!.userId,
      type: 'sysadmin.org.user_created',
      label: 'User created (by system-admin)',
      detail: `${firstName} ${lastName} <${email}> — ${user.role}`,
      refModel: 'User', refId: user._id,
    });
    res.status(201).json({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  } catch (e: any) {
    if (e.code === 11000) { res.status(409).json({ error: req.t('errors.userEmailExists') }); return; }
    next(e);
  }
});

export default router;

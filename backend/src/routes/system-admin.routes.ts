import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
  getStats,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  suspendOrganization,
  listOrgUsers,
  updateOrgUser,
} from '../controllers/system-admin.controller';

const router = Router();

// All system-admin routes require authentication and system_admin role
router.use(authenticateToken, requireRole('system_admin'));

router.get('/stats',                                       getStats);
router.get('/organizations',                               listOrganizations);
router.post('/organizations',                              createOrganization);
router.get('/organizations/:id',                           getOrganization);
router.put('/organizations/:id',                           updateOrganization);
router.delete('/organizations/:id',                        suspendOrganization);
router.get('/organizations/:id/users',                     listOrgUsers);
router.patch('/organizations/:id/users/:userId',           updateOrgUser);

export default router;

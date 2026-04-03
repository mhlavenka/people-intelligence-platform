import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import {
  analyzeConflict,
  getAnalyses,
  getAnalysis,
  escalateConflict,
  getSubAnalyses,
  createSubAnalysis,
} from '../controllers/conflict.controller';

const router = Router();

router.use(authenticateToken, tenantResolver);

router.post('/analyze', requireRole('admin', 'hr_manager'), analyzeConflict);
router.get('/analyses', getAnalyses);
router.get('/analyses/:id', getAnalysis);
router.get('/analyses/:id/sub-analyses', getSubAnalyses);
router.post('/analyses/:id/sub-analyses', requireRole('admin', 'hr_manager', 'manager'), createSubAnalysis);
router.post('/escalate/:id', requireRole('admin', 'hr_manager', 'manager'), escalateConflict);

export default router;

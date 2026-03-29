import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import {
  analyzeConflict,
  getAnalyses,
  getAnalysis,
  escalateConflict,
} from '../controllers/conflict.controller';

const router = Router();

router.use(authenticateToken, tenantResolver);

router.post('/analyze', requireRole('admin', 'hr_manager'), analyzeConflict);
router.get('/analyses', getAnalyses);
router.get('/analyses/:id', getAnalysis);
router.post('/escalate/:id', requireRole('admin', 'hr_manager', 'manager'), escalateConflict);

export default router;

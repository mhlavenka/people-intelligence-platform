import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
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

router.delete(
  '/analyses/:id',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const analysis = await ConflictAnalysis.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!analysis) { res.status(404).json({ error: 'Analysis not found' }); return; }
      // Also delete sub-analyses
      await ConflictAnalysis.deleteMany({
        parentId: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      res.json({ message: 'Analysis deleted' });
    } catch (e) { next(e); }
  }
);

export default router;

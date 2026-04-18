import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import {
  analyzeConflict,
  getAnalyses,
  getAnalysis,
  escalateConflict,
  getSubAnalyses,
  createSubAnalysis,
  generateRecommendedActions,
} from '../controllers/conflict.controller';

const router = Router();

router.use(authenticateToken, tenantResolver);

router.post('/analyze', requirePermission('RUN_CONFLICT_ANALYSIS'), analyzeConflict);
router.get('/analyses', requirePermission('VIEW_CONFLICT_DASHBOARD'), getAnalyses);
router.get('/analyses/:id', requirePermission('VIEW_CONFLICT_DASHBOARD'), getAnalysis);
router.get('/analyses/:id/sub-analyses', requirePermission('VIEW_CONFLICT_DASHBOARD'), getSubAnalyses);
router.post('/analyses/:id/sub-analyses', requirePermission('RUN_CONFLICT_ANALYSIS'), createSubAnalysis);
router.post('/analyses/:id/recommended-actions', requirePermission('RUN_CONFLICT_ANALYSIS'), generateRecommendedActions);
router.post('/escalate/:id', requirePermission('ESCALATE_CONFLICT'), escalateConflict);

router.patch(
  '/analyses/:id/completed-actions',
  requirePermission('VIEW_CONFLICT_DASHBOARD'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { completedActions } = req.body as { completedActions: Record<string, number[]> };
      const analysis = await ConflictAnalysis.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        { completedActions },
        { new: true },
      );
      if (!analysis) { res.status(404).json({ error: req.t('errors.analysisNotFound') }); return; }
      res.json({ completedActions: analysis.completedActions });
    } catch (e) { next(e); }
  }
);

router.delete(
  '/analyses/:id',
  requirePermission('RUN_CONFLICT_ANALYSIS'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const analysis = await ConflictAnalysis.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!analysis) { res.status(404).json({ error: req.t('errors.analysisNotFound') }); return; }
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

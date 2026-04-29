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
  updateProfessionalReview,
  generateActionIntake,
} from '../controllers/conflict.controller';
import { logActivity } from '../services/activityLog.service';

const router = Router();

router.use(authenticateToken, tenantResolver);

router.post('/analyze', requirePermission('RUN_CONFLICT_ANALYSIS'), analyzeConflict);
router.get('/analyses', requirePermission('VIEW_CONFLICT_DASHBOARD'), getAnalyses);
router.get('/analyses/:id', requirePermission('VIEW_CONFLICT_DASHBOARD'), getAnalysis);
router.get('/analyses/:id/sub-analyses', requirePermission('VIEW_CONFLICT_DASHBOARD'), getSubAnalyses);
router.post('/analyses/:id/sub-analyses', requirePermission('RUN_CONFLICT_ANALYSIS'), createSubAnalysis);
router.post('/analyses/:id/recommended-actions', requirePermission('RUN_CONFLICT_ANALYSIS'), generateRecommendedActions);
router.post('/escalate/:id', requirePermission('ESCALATE_CONFLICT'), escalateConflict);
router.patch('/analyses/:id/professional-review', requirePermission('VIEW_CONFLICT_DASHBOARD'), updateProfessionalReview);
router.post('/analyses/:id/generate-intake', requirePermission('RUN_CONFLICT_ANALYSIS'), generateActionIntake);

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

// Trend of teamAlignmentScore across recent analyses, used by the dashboard
// sparkline. Parent analyses only (sub-analyses don't carry alignment),
// optionally filtered by department.
router.get(
  '/alignment-trend',
  requirePermission('VIEW_CONFLICT_DASHBOARD'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? '12'), 10) || 12, 3), 30);
      const dept = typeof req.query['departmentId'] === 'string' ? req.query['departmentId'] : undefined;

      const filter: Record<string, unknown> = {
        organizationId: req.user!.organizationId,
        teamAlignmentScore: { $exists: true, $ne: null },
        parentId: { $exists: false },
      };
      if (dept) filter['departmentId'] = dept;

      const docs = await ConflictAnalysis.find(filter)
        .select('_id name departmentId teamAlignmentScore createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      // Reverse so the oldest is first (left-to-right sparkline reads chronologically).
      res.json(docs.reverse());
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
      logActivity({
        org: req.user!.organizationId, actor: req.user!.userId,
        type: 'conflict.analysis.deleted', label: 'Conflict analysis deleted',
        detail: analysis.name,
      });
      res.json({ message: 'Analysis deleted' });
    } catch (e) { next(e); }
  }
);

export default router;

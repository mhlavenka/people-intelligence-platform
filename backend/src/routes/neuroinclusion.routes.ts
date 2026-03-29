import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { NeuroinclustionAssessment } from '../models/NeuroinclustionAssessment.model';
import { Organization } from '../models/Organization.model';
import { buildNeuroinclustionGapPrompt, callClaude } from '../services/ai.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.post('/assess', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { respondentRole, dimensions } = req.body;

    const overallMaturityScore =
      dimensions.reduce((sum: number, d: { score: number }) => sum + d.score, 0) /
      dimensions.length;

    const org = await Organization.findById(organizationId);
    const prompt = buildNeuroinclustionGapPrompt(
      { respondentRole, dimensions, overallMaturityScore },
      { name: org?.name || '', industry: org?.industry }
    );

    const aiResponse = await callClaude(prompt);
    let parsed: { aiGapAnalysis: string; actionRoadmap: string[] };
    try {
      const clean = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { aiGapAnalysis: aiResponse, actionRoadmap: [] };
    }

    const assessment = await NeuroinclustionAssessment.create({
      organizationId,
      respondentRole,
      dimensions,
      overallMaturityScore: Math.round(overallMaturityScore * 100) / 100,
      aiGapAnalysis: parsed.aiGapAnalysis,
      actionRoadmap: parsed.actionRoadmap,
      completedAt: new Date(),
    });

    res.status(201).json(assessment);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/assessments',
  requireRole('admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const assessments = await NeuroinclustionAssessment.find({
        organizationId: req.user!.organizationId,
      }).sort({ completedAt: -1 });
      res.json(assessments);
    } catch (e) {
      next(e);
    }
  }
);

export default router;

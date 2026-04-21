import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { NeuroinclustionAssessment } from '../models/NeuroinclustionAssessment.model';
import { Organization } from '../models/Organization.model';
import { buildNeuroinclustionGapPrompt, callClaude, extractJson } from '../services/ai.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

/** Convert an array that may contain objects into a plain string[]. */
function normalizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      // Try common field names Claude uses for the main action text
      const text = obj['action'] ?? obj['initiative'] ?? obj['description'] ?? obj['detail'] ?? Object.values(obj)[0];
      const timeline = typeof obj['timeline'] === 'string' ? ` (${obj['timeline']})` : '';
      return `${String(text ?? '')}${timeline}`.trim();
    }
    return String(item).trim();
  }).filter(Boolean);
}

/** Normalize aiGapAnalysis: may be a string, string[], or array of objects. */
function normalizeGapAnalysis(val: unknown): string[] {
  if (Array.isArray(val)) return normalizeStringArray(val);
  if (typeof val === 'string') {
    return val.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  return [];
}

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
      { name: org?.name || '', industry: org?.industry },
      req.language
    );

    const aiResponse = await callClaude(prompt, undefined, undefined, req.user!.organizationId);
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(extractJson(aiResponse));
    } catch {
      raw = { aiGapAnalysis: aiResponse };
    }

    const assessment = await NeuroinclustionAssessment.create({
      organizationId,
      userId: req.user!.userId,
      respondentRole,
      dimensions,
      overallMaturityScore: Math.round(overallMaturityScore * 100) / 100,
      aiGapAnalysis:       normalizeGapAnalysis(raw['aiGapAnalysis']),
      actionRoadmap:       normalizeStringArray(raw['actionRoadmap']),
      quickWins:           normalizeStringArray(raw['quickWins']),
      longTermInitiatives: normalizeStringArray(raw['longTermInitiatives']),
      completedAt: new Date(),
    });

    res.status(201).json(assessment);
  } catch (e) {
    next(e);
  }
});

// Latest assessment for the current user — any authenticated user
router.get('/assessments/latest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assessment = await NeuroinclustionAssessment.findOne({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
    })
      .sort({ completedAt: -1 })
      .lean()
      .setOptions({ bypassTenantCheck: true });

    res.json(assessment ?? null);
  } catch (e) { next(e); }
});

router.get(
  '/assessments',
  requirePermission('VIEW_NEUROINCLUSION_RESULTS'),
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

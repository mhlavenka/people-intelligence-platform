import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { DevelopmentPlan } from '../models/DevelopmentPlan.model';
import { User } from '../models/User.model';
import { buildIDPPrompt, callClaude, extractJson } from '../services/ai.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.post(
  '/idp/generate',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const { coacheeId, coachId, eqiScores, competencyGaps, goals } = req.body;

      const coachee = await User.findOne({ _id: coacheeId, organizationId });
      if (!coachee) {
        res.status(404).json({ error: 'Coachee not found in this organization' });
        return;
      }

      const prompt = buildIDPPrompt(
        { firstName: coachee.firstName, role: coachee.role, competencyGaps },
        eqiScores,
        goals
      );

      const aiResponse = await callClaude(prompt, undefined, 4096);
      let parsed: {
        goal: string;
        currentReality: string;
        options: string[];
        willDoActions: string[];
        milestones: Array<{ title: string; weeksFromNow: number; successCriteria: string }>;
        resources?: string[];
      };

      try {
        parsed = JSON.parse(extractJson(aiResponse));
      } catch (parseErr) {
        console.error('[IDP] JSON parse failed. Raw AI response:', aiResponse);
        parsed = {
          goal: goals,
          currentReality: '',
          options: [],
          willDoActions: [],
          milestones: [],
        };
      }

      // Ensure all fields have safe fallbacks regardless of what Claude returned
      parsed.goal            = parsed.goal            || goals;
      parsed.currentReality  = parsed.currentReality  || '';
      parsed.options         = Array.isArray(parsed.options)       ? parsed.options       : [];
      parsed.willDoActions   = Array.isArray(parsed.willDoActions)  ? parsed.willDoActions  : [];
      parsed.milestones      = Array.isArray(parsed.milestones)    ? parsed.milestones    : [];

      const milestones = parsed.milestones.map((m) => ({
        title: m.title || 'Milestone',
        dueDate: new Date(Date.now() + (m.weeksFromNow || 4) * 7 * 24 * 3600 * 1000),
        status: 'pending' as const,
        notes: m.successCriteria || '',
      }));

      const idp = await DevelopmentPlan.create({
        organizationId,
        coacheeId,
        coachId,
        goal: parsed.goal || goals,
        currentReality: parsed.currentReality,
        options: parsed.options,
        willDoActions: parsed.willDoActions,
        milestones,
        eqiScores,
        competencyGaps,
        aiGeneratedContent: aiResponse,
        status: 'draft',
      });

      res.status(201).json(idp);
    } catch (e) {
      next(e);
    }
  }
);

router.get('/idps', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const filter: Record<string, unknown> = { organizationId };

    // Coachees only see their own IDP; all other roles see the full org list
    if (req.user!.role === 'coachee') {
      filter['coacheeId'] = req.user!.userId;
    }

    const idps = await DevelopmentPlan.find(filter)
      .populate('coacheeId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(idps);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/idps/:id/regenerate',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;

      const existing = await DevelopmentPlan.findOne({ _id: req.params['id'], organizationId });
      if (!existing) {
        res.status(404).json({ error: 'IDP not found' });
        return;
      }

      const coachee = await User.findOne({ _id: existing.coacheeId, organizationId });
      if (!coachee) {
        res.status(404).json({ error: 'Coachee not found' });
        return;
      }

      // Serialize Mongoose Mixed field to a plain object before passing to prompt builder
      const eqiScores: Record<string, number> =
        JSON.parse(JSON.stringify(existing.eqiScores ?? {}));

      const prompt = buildIDPPrompt(
        { firstName: coachee.firstName, role: coachee.role, competencyGaps: existing.competencyGaps },
        eqiScores,
        existing.goal
      );

      const aiResponse = await callClaude(prompt, undefined, 4096);
      let parsed: {
        goal: string;
        currentReality: string;
        options: string[];
        willDoActions: string[];
        milestones: Array<{ title: string; weeksFromNow: number; successCriteria: string }>;
      };

      try {
        parsed = JSON.parse(extractJson(aiResponse));
      } catch {
        console.error('[IDP Regenerate] JSON parse failed. Raw AI response:', aiResponse);
        res.status(500).json({ error: 'AI returned invalid response. Please try again.' });
        return;
      }

      parsed.currentReality = parsed.currentReality || '';
      parsed.options        = Array.isArray(parsed.options)       ? parsed.options       : [];
      parsed.willDoActions  = Array.isArray(parsed.willDoActions)  ? parsed.willDoActions  : [];
      parsed.milestones     = Array.isArray(parsed.milestones)    ? parsed.milestones    : [];

      const milestones = parsed.milestones.map((m) => ({
        title: m.title || 'Milestone',
        dueDate: new Date(Date.now() + (m.weeksFromNow || 4) * 7 * 24 * 3600 * 1000),
        status: 'pending' as const,
        notes: m.successCriteria || '',
      }));

      existing.goal             = parsed.goal || existing.goal;
      existing.currentReality   = parsed.currentReality;
      existing.options          = parsed.options;
      existing.willDoActions    = parsed.willDoActions;
      existing.milestones       = milestones;
      existing.aiGeneratedContent = aiResponse;
      existing.status           = 'draft';
      await existing.save();

      res.json(existing);
    } catch (e) {
      next(e);
    }
  }
);

router.put('/idps/:id/milestone', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { milestoneId, status, notes } = req.body;

    const idp = await DevelopmentPlan.findOne({ _id: req.params['id'], organizationId });
    if (!idp) {
      res.status(404).json({ error: 'IDP not found' });
      return;
    }

    const milestone = idp.milestones.find((m) => m._id?.toString() === milestoneId);
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }

    milestone.status = status;
    if (notes !== undefined) milestone.notes = notes;
    await idp.save();

    res.json(idp);
  } catch (e) {
    next(e);
  }
});

export default router;

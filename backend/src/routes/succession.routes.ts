import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { DevelopmentPlan } from '../models/DevelopmentPlan.model';
import { User } from '../models/User.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import { JournalEntry } from '../models/JournalEntry.model';
import { buildIDPPrompt, buildConflictIDPPrompt, callClaude, extractJson } from '../services/ai.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.post(
  '/idp/generate',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const { coacheeId, coachId, eqiScores, competencyGaps, goals, sourceModule } = req.body;

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
        sourceModule: sourceModule || 'succession',
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

/** Generate an IDP from a conflict analysis — used by the Conflict Intelligence "Skill Development" section. */
router.post(
  '/idp/generate-from-conflict',
  requireRole('admin', 'hr_manager', 'coach', 'manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const { coacheeId, analysisId, goals } = req.body;

      const coachee = await User.findOne({ _id: coacheeId, organizationId });
      if (!coachee) {
        res.status(404).json({ error: 'User not found in this organization' });
        return;
      }

      const analysis = await ConflictAnalysis.findOne({ _id: analysisId, organizationId });
      if (!analysis) {
        res.status(404).json({ error: 'Conflict analysis not found' });
        return;
      }

      const prompt = buildConflictIDPPrompt(
        { firstName: coachee.firstName, role: coachee.role },
        {
          riskScore: analysis.riskScore,
          riskLevel: analysis.riskLevel,
          conflictTypes: analysis.conflictTypes,
          aiNarrative: analysis.aiNarrative,
        },
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
        competencyGaps?: string[];
      };

      try {
        parsed = JSON.parse(extractJson(aiResponse));
      } catch {
        console.error('[Conflict IDP] JSON parse failed. Raw:', aiResponse);
        parsed = {
          goal: goals,
          currentReality: '',
          options: [],
          willDoActions: [],
          milestones: [],
          competencyGaps: analysis.conflictTypes,
        };
      }

      parsed.goal           = parsed.goal           || goals;
      parsed.currentReality = parsed.currentReality || '';
      parsed.options        = Array.isArray(parsed.options)      ? parsed.options      : [];
      parsed.willDoActions  = Array.isArray(parsed.willDoActions) ? parsed.willDoActions : [];
      parsed.milestones     = Array.isArray(parsed.milestones)   ? parsed.milestones   : [];

      const milestones = parsed.milestones.map((m) => ({
        title: m.title || 'Milestone',
        dueDate: new Date(Date.now() + (m.weeksFromNow || 4) * 7 * 24 * 3600 * 1000),
        status: 'pending' as const,
        notes: m.successCriteria || '',
      }));

      const idp = await DevelopmentPlan.create({
        organizationId,
        coacheeId,
        coachId: req.user!.userId,
        sourceModule: 'conflict',
        sourceAnalysisId: analysisId,
        goal: parsed.goal,
        currentReality: parsed.currentReality,
        options: parsed.options,
        willDoActions: parsed.willDoActions,
        milestones,
        eqiScores: {},
        competencyGaps: parsed.competencyGaps || analysis.conflictTypes,
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

    // Optional filter by source module (e.g. ?module=conflict)
    if (req.query['module']) {
      const mod = req.query['module'] as string;
      if (mod === 'succession') {
        // Include legacy IDPs that have no sourceModule field (created before the field existed)
        filter['sourceModule'] = { $in: ['succession', null, undefined] };
      } else {
        filter['sourceModule'] = mod;
      }
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

/** Update IDP status (e.g. draft → active, active → completed). */
router.put(
  '/idps/:id/status',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      if (!['draft', 'active', 'completed'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      const idp = await DevelopmentPlan.findOne({ _id: req.params['id'], organizationId: req.user!.organizationId });
      if (!idp) { res.status(404).json({ error: 'IDP not found' }); return; }
      idp.status = status;
      await idp.save();
      res.json(idp);
    } catch (e) { next(e); }
  }
);

/** Delete an IDP — only drafts can be deleted. */
router.delete(
  '/idps/:id',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const idp = await DevelopmentPlan.findOne({ _id: req.params['id'], organizationId: req.user!.organizationId });
      if (!idp) {
        res.status(404).json({ error: 'IDP not found' });
        return;
      }
      if (idp.status !== 'draft') {
        res.status(400).json({ error: 'Only draft IDPs can be deleted. Deactivate active IDPs instead.' });
        return;
      }
      await idp.deleteOne();
      res.json({ message: 'IDP deleted' });
    } catch (e) {
      next(e);
    }
  }
);

// ── Journal Entries ──────────────────────────────────────────────────────────

/** List journal entries for the current user (or all if admin/hr/coach). */
router.get('/journal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
    if (req.user!.role === 'coachee') {
      filter['userId'] = req.user!.userId;
    }
    if (req.query['idpId']) {
      filter['idpId'] = req.query['idpId'];
    }
    const entries = await JournalEntry.find(filter)
      .populate('userId', 'firstName lastName')
      .populate('idpId', 'goal')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(entries);
  } catch (e) { next(e); }
});

/** Create a journal entry. */
router.post('/journal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, prompt, mood, tags, idpId } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const entry = await JournalEntry.create({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      idpId: idpId || undefined,
      prompt: prompt || undefined,
      content: content.trim(),
      mood: mood || undefined,
      tags: tags || [],
    });
    res.status(201).json(entry);
  } catch (e) { next(e); }
});

/** Delete a journal entry (own only, or admin/hr/coach). */
router.delete('/journal/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filter: Record<string, unknown> = {
      _id: req.params['id'],
      organizationId: req.user!.organizationId,
    };
    if (req.user!.role === 'coachee') {
      filter['userId'] = req.user!.userId;
    }
    const entry = await JournalEntry.findOneAndDelete(filter);
    if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
    res.json({ message: 'Entry deleted' });
  } catch (e) { next(e); }
});

export default router;

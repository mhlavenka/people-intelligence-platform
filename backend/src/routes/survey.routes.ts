import { Router, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyAssignment } from '../models/SurveyAssignment.model';
import { CoachingSession } from '../models/CoachingSession.model';
import { User } from '../models/User.model';
import { callClaude, buildAITemplatePrompt } from '../services/ai.service';
import { createHubNotification, notifyCoachIntakeSubmitted } from '../services/hubNotification.service';
import { sendEmail } from '../services/email.service';
import { config } from '../config/env';

function makeSubmissionToken(userId: string, templateId: string, sessionId?: string): string {
  const payload = sessionId ? `${userId}:${templateId}:${sessionId}` : `${userId}:${templateId}`;
  return createHash('sha256').update(payload).digest('hex');
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

async function isSessionIntakeAccessible(
  sessionId: string,
  templateId?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const session = await CoachingSession.findById(sessionId)
    .select('date preSessionIntakeSentAt postSessionIntakeSentAt preSessionIntakeTemplateId postSessionIntakeTemplateId status')
    .setOptions({ bypassTenantCheck: true });
  if (!session) return { ok: false, reason: 'Session not found.' };

  const isPostSession = !!templateId
    && session.postSessionIntakeTemplateId?.toString() === templateId;
  const isPreSession = !!templateId
    && session.preSessionIntakeTemplateId?.toString() === templateId;

  if (isPostSession) {
    // Post-session form is gated by dispatch (postSessionIntakeSentAt is set
    // when the coach marks the session complete). Status will be 'completed'
    // or 'no_show' at that point — both should remain submittable.
    if (!session.postSessionIntakeSentAt) {
      return { ok: false, reason: 'Post-session form has not been sent yet.' };
    }
    return { ok: true };
  }

  // Default / pre-session path: session must still be scheduled and either
  // dispatched OR within the 24-hour pre-window.
  if (session.status !== 'scheduled' && !isPreSession) {
    return { ok: false, reason: 'Session is no longer scheduled.' };
  }
  if (isPreSession && session.status !== 'scheduled') {
    return { ok: false, reason: 'Session is no longer scheduled.' };
  }
  const hoursUntil = (session.date.getTime() - Date.now()) / (60 * 60 * 1000);
  if (session.preSessionIntakeSentAt) return { ok: true };
  if (hoursUntil <= 24) return { ok: true };
  return { ok: false, reason: 'This form will be available 24 hours before your session.' };
}

const router = Router();
const MIN_GROUP_SIZE = 5;

router.use(authenticateToken, tenantResolver);

router.post(
  '/templates',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.userId,
      });
      res.status(201).json(template);
    } catch (e) {
      next(e);
    }
  }
);

/** Generate a new intake template from a free-form description via Claude. */
router.post(
  '/templates/ai-generate',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      const moduleType = req.body.moduleType as 'conflict' | 'neuroinclusion' | 'succession' | 'coaching';
      const intakeType = req.body.intakeType as 'survey' | 'interview' | 'assessment';
      const questionCount = typeof req.body.questionCount === 'number' ? req.body.questionCount : 8;

      if (description.length < 10) {
        res.status(400).json({ error: req.t('errors.aiTemplateDescTooShort') });
        return;
      }
      if (!['conflict', 'neuroinclusion', 'succession', 'coaching'].includes(moduleType)) {
        res.status(400).json({ error: req.t('errors.invalidModuleType') });
        return;
      }
      if (!['survey', 'interview', 'assessment'].includes(intakeType)) {
        res.status(400).json({ error: req.t('errors.invalidIntakeType') });
        return;
      }

      const prompt = buildAITemplatePrompt(
        description,
        { moduleType, intakeType, questionCount },
        req.language || 'en',
      );
      const aiResponse = await callClaude(prompt, undefined, undefined, req.user!.organizationId);

      let parsed: { title: string; description?: string; instructions?: string; questions: Array<{ id: string; text: string; type: string; category: string }> };
      try {
        let clean = aiResponse.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
        const objStart = clean.indexOf('{');
        const objEnd = clean.lastIndexOf('}');
        if (objStart !== -1 && objEnd > objStart) clean = clean.slice(objStart, objEnd + 1);
        parsed = JSON.parse(clean);
      } catch {
        res.status(500).json({ error: req.t('errors.aiInvalidQuestionFormat') });
        return;
      }

      if (!parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        res.status(500).json({ error: req.t('errors.aiInvalidQuestionFormat') });
        return;
      }

      // Sanitise questions: clamp to known types, ensure ids and categories.
      const allowedTypes = new Set(['scale', 'text', 'boolean']);
      const questions = parsed.questions
        .filter((q) => q && typeof q.text === 'string' && q.text.trim().length > 0)
        .map((q, idx) => ({
          id: (q.id && typeof q.id === 'string' ? q.id : `q${idx + 1}`).slice(0, 32),
          text: q.text.trim().slice(0, 600),
          type: allowedTypes.has(q.type) ? q.type : 'text',
          category: (q.category && typeof q.category === 'string' ? q.category : 'General').slice(0, 80),
        }));

      const template = await SurveyTemplate.create({
        organizationId: req.user!.organizationId,
        moduleType,
        intakeType,
        title: String(parsed.title).slice(0, 120),
        description: typeof parsed.description === 'string' ? parsed.description.slice(0, 400) : undefined,
        instructions: typeof parsed.instructions === 'string' ? parsed.instructions.slice(0, 1000) : undefined,
        isActive: true,
        isGlobal: false,
        isAutoGenerated: true,
        createdBy: req.user!.userId,
        questions,
      });

      res.status(201).json(template);
    } catch (e) { next(e); }
  }
);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await SurveyTemplate.find({
      $or: [
        { organizationId: req.user!.organizationId },
        { isGlobal: true },
      ],
      isActive: true,
      sourceTemplateId: { $exists: false },
    }).setOptions({ bypassTenantCheck: true });
    res.json(templates);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/templates',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
      };
      if (req.query['includeInactive'] !== 'true') {
        filter['isActive'] = true;
      }
      if (req.query['includeAutoGenerated'] !== 'true') {
        filter['isAutoGenerated'] = { $ne: true };
      }
      const moduleType = req.query['moduleType'];
      if (typeof moduleType === 'string' &&
          ['conflict', 'neuroinclusion', 'succession', 'coaching'].includes(moduleType)) {
        filter['moduleType'] = moduleType;
      }
      filter['sourceTemplateId'] = { $exists: false };
      const templates = await SurveyTemplate.find(filter).setOptions({ bypassTenantCheck: true });
      res.json(templates);
    } catch (e) {
      next(e);
    }
  }
);

// Returns only intakes relevant to the current user: assigned directly,
// assigned via department, or linked as pre/post-session intakes.
router.get(
  '/my-intakes',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.organizationId;

      // 1. Get user's department
      const me = await User.findById(userId).select('department').lean();
      const myDept = me?.department;

      // 2. Find template IDs assigned to this user (direct or via department)
      const assignmentFilter: Record<string, unknown> = {
        organizationId: orgId,
        $or: [{ userIds: userId }] as any[],
      };
      if (myDept) {
        (assignmentFilter['$or'] as any[]).push({ departments: myDept });
      }
      const assignments = await SurveyAssignment.find(assignmentFilter)
        .select('templateId')
        .lean();
      const assignedIds = [...new Set(assignments.map((a) => a.templateId.toString()))];

      // 3. Find pre/post session intake template IDs from upcoming sessions
      const CoachingSession = (await import('../models/CoachingSession.model')).CoachingSession;
      const sessions = await CoachingSession.find({
        organizationId: orgId,
        $or: [{ coacheeId: userId }],
        status: 'scheduled',
      })
        .select('preSessionIntakeTemplateId postSessionIntakeTemplateId')
        .lean();
      const sessionTemplateIds = new Set<string>();
      for (const s of sessions) {
        if (s.preSessionIntakeTemplateId) sessionTemplateIds.add(s.preSessionIntakeTemplateId.toString());
        if (s.postSessionIntakeTemplateId) sessionTemplateIds.add(s.postSessionIntakeTemplateId.toString());
      }

      const allIds = [...new Set([...assignedIds, ...sessionTemplateIds])];
      if (allIds.length === 0) { res.json([]); return; }

      const templates = await SurveyTemplate.find({
        _id: { $in: allIds },
        isActive: true,
      }).setOptions({ bypassTenantCheck: true });

      // Annotate each template with whether THIS user has already submitted it.
      // Submissions are dedup'd by SHA-256(userId:templateId[:sessionId]); look up
      // by the per-template token so anonymous + non-anonymous flows both match.
      const tokens = templates.map((t) => makeSubmissionToken(userId, t._id.toString()));
      const submitted = await SurveyResponse.find({
        submissionToken: { $in: tokens },
      }).select('submissionToken').setOptions({ bypassTenantCheck: true });
      const submittedTokens = new Set(submitted.map((r) => r.submissionToken));

      const annotated = templates.map((t) => {
        const token = makeSubmissionToken(userId, t._id.toString());
        const obj = t.toObject() as unknown as Record<string, unknown>;
        obj['submitted'] = submittedTokens.has(token);
        return obj;
      });

      const onlyPending = req.query['pending'] === 'true';
      const result = onlyPending
        ? annotated.filter((t) => !t['submitted'])
        : annotated;

      res.json(result);
    } catch (e) { next(e); }
  },
);

// Lightweight count endpoint for the nav badge — just the number of
// pending intakes for the current user.
router.get(
  '/my-intakes/count',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.organizationId;

      const me = await User.findById(userId).select('department').lean();
      const myDept = me?.department;

      const assignmentFilter: Record<string, unknown> = {
        organizationId: orgId,
        $or: [{ userIds: userId }] as any[],
      };
      if (myDept) {
        (assignmentFilter['$or'] as any[]).push({ departments: myDept });
      }
      const assignments = await SurveyAssignment.find(assignmentFilter)
        .select('templateId').lean();
      const assignedIds = [...new Set(assignments.map((a) => a.templateId.toString()))];

      const CoachingSession = (await import('../models/CoachingSession.model')).CoachingSession;
      const sessions = await CoachingSession.find({
        organizationId: orgId,
        $or: [{ coacheeId: userId }],
        status: 'scheduled',
      })
        .select('preSessionIntakeTemplateId postSessionIntakeTemplateId').lean();
      const sessionTemplateIds = new Set<string>();
      for (const s of sessions) {
        if (s.preSessionIntakeTemplateId) sessionTemplateIds.add(s.preSessionIntakeTemplateId.toString());
        if (s.postSessionIntakeTemplateId) sessionTemplateIds.add(s.postSessionIntakeTemplateId.toString());
      }

      const allIds = [...new Set([...assignedIds, ...sessionTemplateIds])];
      if (allIds.length === 0) { res.json({ count: 0 }); return; }

      const activeIds = (await SurveyTemplate.find({
        _id: { $in: allIds }, isActive: true,
      }).select('_id').setOptions({ bypassTenantCheck: true })).map((t) => t._id.toString());

      const tokens = activeIds.map((id) => makeSubmissionToken(userId, id));
      const submittedCount = await SurveyResponse.countDocuments({
        submissionToken: { $in: tokens },
      }).setOptions({ bypassTenantCheck: true } as any);

      res.json({ count: Math.max(0, activeIds.length - submittedCount) });
    } catch (e) { next(e); }
  },
);

router.get(
  '/templates/:id',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOne({
        _id: req.params['id'],
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
      }).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: req.t('errors.intakeTemplateNotFound') });
        return;
      }
      if (!template.isActive) {
        res.status(410).json({ error: req.t('errors.intakeNoLongerActive') });
        return;
      }
      res.json(template);
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  '/templates/:id',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndUpdate(
        { _id: req.params['id'], $or: [{ organizationId: req.user!.organizationId }, { isGlobal: true }] },
        req.body,
        { new: true, runValidators: true }
      ).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: req.t('errors.intakeTemplateNotFound') });
        return;
      }
      res.json(template);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/templates/:id/translate',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { targetLanguage } = req.body;
      if (!targetLanguage || !['en', 'fr', 'es', 'sk'].includes(targetLanguage)) {
        res.status(400).json({ error: 'Valid targetLanguage (en, fr, es, sk) is required' });
        return;
      }

      const template = await SurveyTemplate.findOne({
        _id: req.params['id'],
        $or: [{ organizationId: req.user!.organizationId }, { isGlobal: true }],
      }).setOptions({ bypassTenantCheck: true });

      if (!template) {
        res.status(404).json({ error: req.t('errors.intakeTemplateNotFound') });
        return;
      }

      const langNames: Record<string, string> = {
        en: 'English',
        fr: 'French (use formal "vous" register)',
        es: 'Spanish (Latin American)',
        sk: 'Slovak',
      };

      const questionsForAI = template.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        category: q.category,
        options: q.options?.map((o) => ({ value: o.value, text: o.text, subscale: o.subscale })),
        scale_range: q.scale_range ? {
          min: q.scale_range.min,
          max: q.scale_range.max,
          labels: q.scale_range.labels instanceof Map
            ? Object.fromEntries(q.scale_range.labels)
            : q.scale_range.labels || undefined,
        } : undefined,
      }));

      const prompt = `Translate the following intake/survey content into ${langNames[targetLanguage]}.

TITLE: ${template.title}
DESCRIPTION: ${template.description || ''}
INSTRUCTIONS: ${template.instructions || ''}

QUESTIONS (JSON):
${JSON.stringify(questionsForAI, null, 2)}

Return ONLY valid JSON with this exact structure:
{
  "title": "translated title",
  "description": "translated description",
  "instructions": "translated instructions",
  "questions": [
    {
      "id": "keep original id unchanged",
      "text": "translated question text",
      "category": "translated category",
      "options": [{"value": "keep original", "text": "translated text", "subscale": "keep original"}],
      "scale_labels": {"1": "translated label", "5": "translated label"}
    }
  ]
}

Rules:
- Translate text, category, option text, scale labels, description, instructions, and title
- Keep id, value, subscale, type, and all numeric/structural fields unchanged
- Omit options/scale_labels if the original question doesn't have them
- Return ONLY the JSON object, no markdown fences`;

      const raw = await callClaude(prompt, undefined, 4096, req.user!.organizationId);
      let translated: any;
      try {
        const clean = raw.replace(/```(?:json)?\r?\n?/g, '').replace(/```/g, '').trim();
        const objStart = clean.indexOf('{');
        const objEnd = clean.lastIndexOf('}');
        if (objStart === -1 || objEnd <= objStart) throw new Error('no JSON object in response');
        translated = JSON.parse(clean.slice(objStart, objEnd + 1));
      } catch (parseErr) {
        console.error('[Translate] AI response parse failed:', parseErr, '\nRaw:', raw.slice(0, 500));
        res.status(502).json({ error: req.t('errors.aiInvalidQuestionFormat') });
        return;
      }

      const updatedQuestions = template.questions.map((q) => {
        const tq = translated.questions?.find((t: { id: string }) => t.id === q.id);
        if (!tq) return q;
        const updated: Record<string, unknown> = (q as any).toObject ? (q as any).toObject() : { ...q };
        updated.text = tq.text || q.text;
        if (tq.category) updated.category = tq.category;
        if (tq.options && updated.options) {
          updated.options = (updated.options as any[]).map((o: any) => {
            const to = tq.options?.find((opt: { value: string }) => opt.value === o.value);
            return to ? { ...o, text: to.text || o.text } : o;
          });
        }
        if (tq.scale_labels && updated.scale_range) {
          updated.scale_range = { ...(updated.scale_range as any), labels: tq.scale_labels };
        }
        return updated;
      });

      const sourceObj = template.toObject();
      delete (sourceObj as any)._id;
      delete (sourceObj as any).__v;
      delete (sourceObj as any).createdAt;
      delete (sourceObj as any).updatedAt;

      const sourceId = template.sourceTemplateId || template._id;

      const copy = await SurveyTemplate.create({
        ...sourceObj,
        title: translated.title || template.title,
        description: translated.description ?? template.description,
        instructions: translated.instructions ?? template.instructions,
        questions: updatedQuestions,
        language: targetLanguage,
        sourceTemplateId: sourceId,
        isGlobal: false,
        organizationId: req.user!.organizationId,
        createdBy: req.user!.userId,
      });

      res.status(201).json(copy);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/templates/:id/translations',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const templateId = req.params['id'];
      const template = await SurveyTemplate.findById(templateId)
        .setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: req.t('errors.intakeTemplateNotFound') });
        return;
      }

      const sourceId = template.sourceTemplateId || template._id;

      const translations = await SurveyTemplate.find({
        $or: [
          { _id: sourceId },
          { sourceTemplateId: sourceId },
        ],
        _id: { $ne: templateId },
      })
        .select('_id title language')
        .setOptions({ bypassTenantCheck: true });

      res.json(translations);
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/templates/:id',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOneAndDelete({
        _id: req.params['id'],
        $or: [{ organizationId: req.user!.organizationId }, { isGlobal: true }],
      }).setOptions({ bypassTenantCheck: true });
      if (!template) {
        res.status(404).json({ error: req.t('errors.intakeTemplateNotFound') });
        return;
      }

      // Clear this template from any ConflictAnalysis generatedIntakeIds
      const { ConflictAnalysis } = await import('../models/ConflictAnalysis.model');
      const analyses = await ConflictAnalysis.find({
        organizationId: req.user!.organizationId,
        [`generatedIntakeIds`]: { $exists: true },
      });
      for (const a of analyses) {
        const map = (a.generatedIntakeIds || {}) as Record<string, string>;
        let changed = false;
        for (const [k, v] of Object.entries(map)) {
          if (v === req.params['id']) { delete map[k]; changed = true; }
        }
        if (changed) {
          a.generatedIntakeIds = map;
          a.markModified('generatedIntakeIds');
          await a.save();
        }
      }

      res.json({ message: 'Template deleted' });
    } catch (e) {
      next(e);
    }
  }
);

// Check if the authenticated user already submitted a response for this template
router.get('/check/:templateId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : undefined;

    if (sessionId) {
      const access = await isSessionIntakeAccessible(sessionId, req.params['templateId']);
      if (!access.ok) {
        res.json({ alreadySubmitted: false, locked: true, lockedReason: access.reason });
        return;
      }
    }

    const token = makeSubmissionToken(
      req.user!.userId.toString(),
      req.params['templateId'],
      sessionId,
    );
    const existing = await SurveyResponse.findOne({ submissionToken: token }).setOptions({ bypassTenantCheck: true });
    res.json({ alreadySubmitted: !!existing, locked: false });
  } catch (e) {
    next(e);
  }
});

router.post('/respond', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      templateId, isAnonymous = true, departmentId, responses,
      coacheeId, sessionFormat, targetName, sessionId, respondentLanguage,
    } = req.body;

    // 24h gate (pre-session) / dispatch gate (post-session): coachees can only
    // submit session-bound intakes once they're available. Coaches submitting
    // on behalf of a coachee bypass this check.
    if (sessionId && !coacheeId) {
      const access = await isSessionIntakeAccessible(sessionId, templateId);
      if (!access.ok) {
        res.status(403).json({ error: access.reason });
        return;
      }
    }

    const tokenSubject = coacheeId ? coacheeId.toString() : req.user!.userId.toString();
    const submissionToken = makeSubmissionToken(tokenSubject, templateId, sessionId);

    // Duplicate check — DB unique index is the safety net, but give a friendly error here
    const existing = await SurveyResponse.findOne({ submissionToken }).setOptions({ bypassTenantCheck: true });
    if (existing) {
      res.status(409).json({ error: req.t('errors.responseAlreadySubmitted') });
      return;
    }

    const doc: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
      templateId,
      submissionToken,
      departmentId,
      respondentLanguage: respondentLanguage || req.language || 'en',
      responses,
      isAnonymous: coacheeId ? false : isAnonymous,
      submittedAt: new Date(),
    };

    if (sessionId) doc['sessionId'] = sessionId;

    // Coach-led submission: attribute to the coachee
    if (coacheeId) {
      doc['respondentId'] = coacheeId;
      doc['coachId'] = req.user!.userId;
      if (sessionFormat) doc['sessionFormat'] = sessionFormat;
      if (targetName)    doc['targetName']    = targetName;
    } else if (!isAnonymous) {
      doc['respondentId'] = req.user!.userId;
    }

    const response = await SurveyResponse.create(doc);

    // Coach-facing notification when a coachee completes a session intake.
    // Fire-and-forget; never delay the 201 response.
    if (sessionId) {
      notifyCoachOnSessionIntakeSubmit({
        sessionId: String(sessionId),
        templateId: String(templateId),
        actingUserId: req.user!.userId.toString(),
        language: req.language || 'en',
      }).catch((err) => console.error('[Survey] Failed to notify coach of intake:', err));
    }

    res.status(201).json({ message: 'Response recorded', id: response._id });
  } catch (e) {
    next(e);
  }
});

/** Compare a session's pre/post-session template to the just-submitted one and
 *  notify the coach (hub + email) when a coachee finishes their intake. */
async function notifyCoachOnSessionIntakeSubmit(p: {
  sessionId: string;
  templateId: string;
  actingUserId: string;
  language: string;
}): Promise<void> {
  const session = await CoachingSession.findById(p.sessionId)
    .select('coachId coacheeId organizationId engagementId date preSessionIntakeTemplateId postSessionIntakeTemplateId')
    .setOptions({ bypassTenantCheck: true });
  if (!session) return;

  const isPre = session.preSessionIntakeTemplateId?.toString() === p.templateId;
  const isPost = session.postSessionIntakeTemplateId?.toString() === p.templateId;
  if (!isPre && !isPost) return;

  // Don't notify the coach for their own coach-led submissions
  if (session.coachId.toString() === p.actingUserId) return;

  const [coach, coachee] = await Promise.all([
    User.findById(session.coachId).select('firstName lastName email preferredLanguage'),
    User.findById(session.coacheeId).select('firstName lastName'),
  ]);
  if (!coach?.email || !coachee) return;

  const lang = coach.preferredLanguage || p.language || 'en';
  const sessionDate = session.date.toLocaleDateString(lang, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const coacheeName = `${coachee.firstName} ${coachee.lastName}`;
  const kind: 'pre' | 'post' = isPre ? 'pre' : 'post';
  const link = `${config.frontendUrl}/coaching/${session.engagementId}`;

  await notifyCoachIntakeSubmitted({
    coachId: session.coachId,
    organizationId: session.organizationId,
    coacheeName,
    kind,
    sessionDate,
    engagementId: session.engagementId,
  });

  const subject = isPre
    ? `Pre-session form completed — ${sessionDate}`
    : `Post-session reflection completed — ${sessionDate}`;
  const headline = isPre
    ? `${coacheeName} completed the pre-session form`
    : `${coacheeName} completed the post-session reflection`;

  await sendEmail({
    to: coach.email,
    subject,
    html: `<h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">${headline}</h2>
           <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
             Your coachee has just submitted their ${isPre ? 'pre-session form' : 'post-session reflection'}
             for the session on <strong>${sessionDate}</strong>.
           </p>
           <a href="${link}" style="display:inline-block;background:#3A9FD6;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View in ARTES</a>`,
  });
}

router.get(
  '/responses/:templateId/count',
  requirePermission('VIEW_CONFLICT_RESPONSES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const count = await SurveyResponse.countDocuments({
        organizationId: req.user!.organizationId,
        templateId: req.params['templateId'],
      });
      res.json({ count });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  '/responses/:templateId',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await SurveyResponse.deleteMany({
        organizationId: req.user!.organizationId,
        templateId: req.params['templateId'],
      });
      res.json({ message: 'Responses cleared', deletedCount: result.deletedCount });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/responses/:templateId',
  requirePermission('VIEW_CONFLICT_RESPONSES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const organizationId = req.user!.organizationId;
      const templateId = req.params['templateId'];
      const sessionId = typeof req.query['sessionId'] === 'string' ? req.query['sessionId'] : undefined;

      const template = await SurveyTemplate.findById(templateId).setOptions({ bypassTenantCheck: true });
      const isSurvey = !template || template.intakeType === 'survey';
      // When scoped to a single session the aggregation floor doesn't apply —
      // there's exactly one known respondent and anonymity is not at stake.
      const minRequired = sessionId
        ? 1
        : template?.minResponsesForAnalysis ?? (isSurvey ? MIN_GROUP_SIZE : 1);

      const filter: Record<string, unknown> = { organizationId, templateId };
      if (sessionId) filter['sessionId'] = sessionId;

      const count = await SurveyResponse.countDocuments(filter);

      if (count < minRequired) {
        res.status(403).json({
          error: req.t('errors.minimumResponsesRequired', { min: minRequired, count }),
        });
        return;
      }

      // Return responses without respondentId to protect anonymity — except
      // when scoped to a single session, where the response is already
      // coachee-attributed by design.
      const query = SurveyResponse.find(filter);
      if (!sessionId) query.select('-respondentId');
      const responses = await query;

      res.json({ count, responses });
    } catch (e) {
      next(e);
    }
  }
);

// ── Intake Assignments ──────────────────────────────────────────────────

router.post(
  '/templates/:id/assign',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const template = await SurveyTemplate.findOne({
        _id: req.params['id'],
        $or: [
          { organizationId: req.user!.organizationId },
          { isGlobal: true },
        ],
      }).setOptions({ bypassTenantCheck: true });
      if (!template) { res.status(404).json({ error: req.t('errors.templateNotFound') }); return; }

      const { userIds = [], departments = [], message } = req.body as {
        userIds?: string[];
        departments?: string[];
        message?: string;
      };
      if (!userIds.length && !departments.length) {
        res.status(400).json({ error: req.t('errors.assignmentTargetRequired') });
        return;
      }

      // Resolve all recipient user IDs (explicit + department members)
      const recipientSet = new Set<string>(userIds);
      if (departments.length) {
        const deptUsers = await User.find({
          organizationId: req.user!.organizationId,
          department: { $in: departments },
        }).select('_id').lean();
        for (const u of deptUsers) recipientSet.add(u._id.toString());
      }

      const assignment = await SurveyAssignment.create({
        organizationId: req.user!.organizationId,
        templateId: template._id,
        assignedBy: req.user!.userId,
        userIds,
        departments,
        message,
      });

      // Send hub notification to each recipient
      const intakeLink = `/intake/${template._id}`;
      const promises = Array.from(recipientSet).map((uid) =>
        createHubNotification({
          userId: uid,
          organizationId: req.user!.organizationId,
          type: 'survey_response',
          title: template.title,
          body: message || `You have been assigned a new intake: ${template.title}`,
          link: intakeLink,
          category: 'surveyAssigned',
        }),
      );
      await Promise.allSettled(promises);

      res.status(201).json({ assignment, notifiedCount: recipientSet.size });
    } catch (e) { next(e); }
  },
);

router.get(
  '/templates/:id/assignments',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const assignments = await SurveyAssignment.find({
        templateId: req.params['id'],
        organizationId: req.user!.organizationId,
      })
        .populate('assignedBy', 'firstName lastName')
        .sort({ createdAt: -1 });
      res.json(assignments);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/assignments/:id',
  requirePermission('MANAGE_INTAKE_TEMPLATES'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await SurveyAssignment.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!result) { res.status(404).json({ error: req.t('errors.assignmentNotFound') }); return; }
      res.json({ deleted: true });
    } catch (e) { next(e); }
  },
);

export default router;

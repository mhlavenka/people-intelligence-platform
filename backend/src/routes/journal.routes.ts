import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { JournalSessionNote } from '../models/JournalSessionNote.model';
import { JournalReflectiveEntry } from '../models/JournalReflectiveEntry.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import {
  callClaude,
  extractJson,
  buildSessionSummaryPrompt,
  buildEngagementInsightPrompt,
  buildSupervisionDigestPrompt,
} from '../services/ai.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

// Coachees always have journal access to their own data (scoped by
// journalScope); other roles need the explicit VIEW_JOURNAL permission.
// This avoids lockout when a SystemRoleOverride strips VIEW_JOURNAL.
const journalReadAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === 'coachee') { next(); return; }
  requirePermission('VIEW_JOURNAL')(req, res, next);
};
const journalAccess = requirePermission('MANAGE_JOURNAL');

/** Build a per-role engagement filter for journal queries. */
function journalScope(req: AuthRequest): Record<string, unknown> {
  const filter: Record<string, unknown> = { organizationId: req.user!.organizationId };
  if (req.user!.role === 'coach') filter['coachId'] = req.user!.userId;
  else if (req.user!.role === 'coachee') filter['coacheeId'] = req.user!.userId;
  return filter;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION NOTES
// ═══════════════════════════════════════════════════════════════════════════

/** List notes for an engagement. */
router.get(
  '/engagements/:engagementId/notes',
  journalReadAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const notes = await JournalSessionNote.find({
        ...journalScope(req),
        engagementId: req.params['engagementId'],
      })
        .sort({ sessionNumber: -1 })
        .lean();
      res.json(notes);
    } catch (e) { next(e); }
  }
);

/** Create a session note. Auto-increments sessionNumber per engagement.
 *  Coachees can also create — useful for pre-filling pre-session notes
 *  before the coach has opened the journal. Coachees may only set
 *  coacheePre / coacheePost on creation; coach-side fields are stripped.
 */
router.post(
  '/engagements/:engagementId/notes',
  journalReadAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params['engagementId'];
      const orgId = req.user!.organizationId;

      const engagement = await CoachingEngagement.findOne({
        _id: engagementId,
        organizationId: orgId,
      });
      if (!engagement) { res.status(404).json({ error: req.t('errors.engagementNotFound') }); return; }

      // Role-scope: coachees can only create on engagements they're part of;
      // coaches only on engagements they own.
      if (req.user!.role === 'coachee' && engagement.coacheeId.toString() !== req.user!.userId) {
        res.status(403).json({ error: req.t('errors.forbidden') }); return;
      }
      if (req.user!.role === 'coach' && engagement.coachId.toString() !== req.user!.userId) {
        res.status(403).json({ error: req.t('errors.forbidden') }); return;
      }

      // If a note already exists for the same sessionId, return it (idempotent).
      if (req.body.sessionId) {
        const existing = await JournalSessionNote.findOne({
          organizationId: orgId,
          engagementId,
          sessionId: req.body.sessionId,
        });
        if (existing) { res.status(200).json(existing); return; }
      }

      const lastNote = await JournalSessionNote.findOne({ engagementId })
        .sort({ sessionNumber: -1 })
        .select('sessionNumber')
        .lean();
      const sessionNumber = (lastNote?.sessionNumber ?? 0) + 1;

      // For coachees, strip out any coach-side fields they may have sent.
      const body = { ...req.body };
      if (req.user!.role === 'coachee') {
        delete body.preSession;
        delete body.inSession;
        delete body.postSession;
        delete body.aiSummary;
        delete body.aiThemes;
      }

      const note = await JournalSessionNote.create({
        ...body,
        organizationId: orgId,
        coachId: engagement.coachId,
        engagementId,
        coacheeId: engagement.coacheeId,
        sessionNumber,
      });

      res.status(201).json(note);
    } catch (e) { next(e); }
  }
);

/** Get a single note. */
router.get(
  '/notes/:noteId',
  journalReadAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOne({
        ...journalScope(req),
        _id: req.params['noteId'],
      }).lean();
      if (!note) { res.status(404).json({ error: req.t('errors.noteNotFound') }); return; }
      res.json(note);
    } catch (e) { next(e); }
  }
);

/** Update a note.
 *  Write rules:
 *    coach / admin / hr_manager → may write preSession, inSession, postSession,
 *      durationMinutes, format, status, sessionDate
 *    coachee → may ONLY write coacheePre and coacheePost
 */
router.put(
  '/notes/:noteId',
  journalReadAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOne({
        ...journalScope(req),
        _id: req.params['noteId'],
      });
      if (!note) { res.status(404).json({ error: req.t('errors.noteNotFound') }); return; }

      // Once a coach finalises a note (status='complete') the journal is
      // locked. Coachee-facing fields stay editable so the coachee can still
      // submit their pre/post-session reflection. Coach edits are rejected.
      if (note.status === 'complete' && req.user!.role !== 'coachee') {
        res.status(409).json({ error: req.t('errors.noteLockedComplete') });
        return;
      }

      if (req.user!.role === 'coachee') {
        if (req.body.coacheePre !== undefined) note.coacheePre = req.body.coacheePre;
        if (req.body.coacheePost !== undefined) note.coacheePost = req.body.coacheePost;
      } else {
        // Coach side: prevent overwriting coachee fields by accident.
        const update = { ...req.body };
        delete update.coacheePre;
        delete update.coacheePost;
        Object.assign(note, update);
      }
      await note.save();
      res.json(note);
    } catch (e) { next(e); }
  }
);

/** Delete a note. */
router.delete(
  '/notes/:noteId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOneAndDelete({
        _id: req.params['noteId'],
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      });
      if (!note) { res.status(404).json({ error: req.t('errors.noteNotFound') }); return; }
      res.json({ message: 'Note deleted' });
    } catch (e) { next(e); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// AI — SESSION SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

/** Generate or regenerate AI summary for a session note. */
router.post(
  '/notes/:noteId/ai-summary',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOne({
        _id: req.params['noteId'],
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      });
      if (!note) { res.status(404).json({ error: req.t('errors.noteNotFound') }); return; }

      if (note.status !== 'complete') {
        res.status(400).json({ error: req.t('errors.noteNotComplete') });
        return;
      }

      const prompt = buildSessionSummaryPrompt({
        preSession: note.preSession,
        inSession: note.inSession,
        postSession: note.postSession,
      }, req.language);

      const raw = await callClaude(prompt, undefined, 1024, req.user!.organizationId);
      const parsed = JSON.parse(extractJson(raw));

      note.aiSummary = parsed.summary;
      note.aiThemes = parsed.themes || [];
      note.aiGeneratedAt = new Date();
      await note.save();

      res.json({
        aiSummary: note.aiSummary,
        aiThemes: note.aiThemes,
        aiGeneratedAt: note.aiGeneratedAt,
        growthEdgeMoment: parsed.growthEdgeMoment,
      });
    } catch (e) { next(e); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// REFLECTIVE ENTRIES
// ═══════════════════════════════════════════════════════════════════════════

/** List reflective entries for the coach. */
router.get(
  '/reflective',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      };
      if (req.query['mood']) filter['mood'] = req.query['mood'];
      if (req.query['isSupervisionReady'] === 'true') filter['isSupervisionReady'] = true;
      if (req.query['tag']) filter['tags'] = req.query['tag'];

      const entries = await JournalReflectiveEntry.find(filter)
        .sort({ entryDate: -1 })
        .lean();
      res.json(entries);
    } catch (e) { next(e); }
  }
);

/** Create reflective entry. */
router.post(
  '/reflective',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const entry = await JournalReflectiveEntry.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      });
      res.status(201).json(entry);
    } catch (e) { next(e); }
  }
);

/** Get single reflective entry. */
router.get(
  '/reflective/:entryId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const entry = await JournalReflectiveEntry.findOne({
        _id: req.params['entryId'],
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      }).lean();
      if (!entry) { res.status(404).json({ error: req.t('errors.entryNotFound') }); return; }
      res.json(entry);
    } catch (e) { next(e); }
  }
);

/** Update reflective entry. */
router.put(
  '/reflective/:entryId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const entry = await JournalReflectiveEntry.findOneAndUpdate(
        {
          _id: req.params['entryId'],
          organizationId: req.user!.organizationId,
          coachId: req.user!.userId,
        },
        req.body,
        { new: true, runValidators: true }
      );
      if (!entry) { res.status(404).json({ error: req.t('errors.entryNotFound') }); return; }
      res.json(entry);
    } catch (e) { next(e); }
  }
);

/** Delete reflective entry. */
router.delete(
  '/reflective/:entryId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const entry = await JournalReflectiveEntry.findOneAndDelete({
        _id: req.params['entryId'],
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      });
      if (!entry) { res.status(404).json({ error: req.t('errors.entryNotFound') }); return; }
      res.json({ message: 'Entry deleted' });
    } catch (e) { next(e); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

/** Cross-session insight report for an engagement. */
router.get(
  '/insights/engagement/:engagementId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const notes = await JournalSessionNote.find({
        organizationId: req.user!.organizationId,
        engagementId: req.params['engagementId'],
        coachId: req.user!.userId,
        status: 'complete',
      })
        .sort({ sessionNumber: 1 })
        .lean();

      if (notes.length < 2) {
        res.status(400).json({ error: req.t('errors.minTwoSessionNotes') });
        return;
      }

      const prompt = buildEngagementInsightPrompt(
        notes.map((n) => ({
          sessionNumber: n.sessionNumber,
          sessionDate: n.sessionDate.toISOString().split('T')[0],
          preSession: n.preSession,
          inSession: n.inSession,
          postSession: n.postSession,
          aiSummary: n.aiSummary,
          aiThemes: n.aiThemes,
        })),
        req.language
      );

      const raw = await callClaude(prompt, undefined, 2048, req.user!.organizationId);
      const parsed = JSON.parse(extractJson(raw));
      res.json(parsed);
    } catch (e) { next(e); }
  }
);

/** Supervision digest across all coach's work. */
router.get(
  '/insights/supervision',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const coachId = req.user!.userId;

      const [entries, notes] = await Promise.all([
        JournalReflectiveEntry.find({
          organizationId: orgId,
          coachId,
          isSupervisionReady: true,
        }).sort({ entryDate: -1 }).lean(),

        JournalSessionNote.find({
          organizationId: orgId,
          coachId,
          status: 'complete',
          'postSession.coachReflection': { $exists: true, $ne: '' },
        }).sort({ sessionDate: -1 }).limit(20).lean(),
      ]);

      if (entries.length === 0 && notes.length === 0) {
        res.status(400).json({ error: req.t('errors.noSupervisionEntries') });
        return;
      }

      const prompt = buildSupervisionDigestPrompt(
        entries.map((e) => ({
          title: e.title,
          body: e.body,
          mood: e.mood,
          entryDate: e.entryDate.toISOString().split('T')[0],
          tags: e.tags,
        })),
        notes.map((n) => ({
          sessionNumber: n.sessionNumber,
          sessionDate: n.sessionDate.toISOString().split('T')[0],
          postSession: n.postSession,
          aiThemes: n.aiThemes,
        })),
        req.language
      );

      const raw = await callClaude(prompt, undefined, 2048, req.user!.organizationId);
      const parsed = JSON.parse(extractJson(raw));
      res.json({
        ...parsed,
        meta: {
          reflectiveEntriesIncluded: entries.length,
          sessionReflectionsIncluded: notes.length,
        },
      });
    } catch (e) { next(e); }
  }
);

export default router;

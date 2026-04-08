import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
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

// All journal routes: admin, hr_manager, coach
const journalAccess = requireRole('admin', 'hr_manager', 'coach');

// ═══════════════════════════════════════════════════════════════════════════
// SESSION NOTES
// ═══════════════════════════════════════════════════════════════════════════

/** List notes for an engagement. */
router.get(
  '/engagements/:engagementId/notes',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const notes = await JournalSessionNote.find({
        organizationId: req.user!.organizationId,
        engagementId: req.params['engagementId'],
        coachId: req.user!.userId,
      })
        .sort({ sessionNumber: -1 })
        .lean();
      res.json(notes);
    } catch (e) { next(e); }
  }
);

/** Create a session note. Auto-increments sessionNumber per engagement. */
router.post(
  '/engagements/:engagementId/notes',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const engagementId = req.params['engagementId'];
      const orgId = req.user!.organizationId;
      const coachId = req.user!.userId;

      // Verify engagement exists and belongs to this org
      const engagement = await CoachingEngagement.findOne({
        _id: engagementId,
        organizationId: orgId,
      });
      if (!engagement) {
        res.status(404).json({ error: 'Engagement not found' });
        return;
      }

      // Auto-increment sessionNumber
      const lastNote = await JournalSessionNote.findOne({ engagementId })
        .sort({ sessionNumber: -1 })
        .select('sessionNumber')
        .lean();
      const sessionNumber = (lastNote?.sessionNumber ?? 0) + 1;

      const note = await JournalSessionNote.create({
        ...req.body,
        organizationId: orgId,
        coachId,
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
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOne({
        _id: req.params['noteId'],
        organizationId: req.user!.organizationId,
        coachId: req.user!.userId,
      }).lean();
      if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
      res.json(note);
    } catch (e) { next(e); }
  }
);

/** Update a note. */
router.put(
  '/notes/:noteId',
  journalAccess,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const note = await JournalSessionNote.findOneAndUpdate(
        {
          _id: req.params['noteId'],
          organizationId: req.user!.organizationId,
          coachId: req.user!.userId,
        },
        req.body,
        { new: true, runValidators: true }
      );
      if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
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
      if (!note) { res.status(404).json({ error: 'Note not found' }); return; }
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
      if (!note) { res.status(404).json({ error: 'Note not found' }); return; }

      if (note.status !== 'complete') {
        res.status(400).json({ error: 'Note must be marked complete before generating AI summary' });
        return;
      }

      const prompt = buildSessionSummaryPrompt({
        preSession: note.preSession,
        inSession: note.inSession,
        postSession: note.postSession,
      });

      const raw = await callClaude(prompt, undefined, 1024);
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
      if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
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
      if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
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
      if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
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
        res.status(400).json({ error: 'At least 2 completed session notes are required for insights' });
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
        }))
      );

      const raw = await callClaude(prompt, undefined, 2048);
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
        res.status(400).json({ error: 'No supervision-ready entries or session reflections found' });
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
        }))
      );

      const raw = await callClaude(prompt, undefined, 2048);
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

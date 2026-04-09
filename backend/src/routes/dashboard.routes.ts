import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import { DevelopmentPlan } from '../models/DevelopmentPlan.model';
import { NeuroinclustionAssessment } from '../models/NeuroinclustionAssessment.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { CoachingSession } from '../models/CoachingSession.model';
import { JournalSessionNote } from '../models/JournalSessionNote.model';
import { JournalReflectiveEntry } from '../models/JournalReflectiveEntry.model';
import { User } from '../models/User.model';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.get('/activity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const LIMIT = 5;

    const [
      surveyResponses, conflictAnalyses, idps, neuroinclusions,
      engagements, sessions, journalNotes, reflectiveEntries,
    ] = await Promise.all([
      SurveyResponse.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate<{ templateId: { title: string; moduleType: string } }>('templateId', 'title moduleType')
        .lean()
        .setOptions({ bypassTenantCheck: true }),

      ConflictAnalysis.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .lean(),

      DevelopmentPlan.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .lean(),

      NeuroinclustionAssessment.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .lean(),

      CoachingEngagement.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      CoachingSession.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      JournalSessionNote.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      JournalReflectiveEntry.find({ organizationId: orgId })
        .sort({ createdAt: -1 })
        .limit(LIMIT)
        .populate('coachId', 'firstName lastName')
        .lean(),
    ]);

    type ActivityItem = {
      type: string;
      label: string;
      detail: string;
      createdAt: Date;
    };

    const items: ActivityItem[] = [];

    for (const r of surveyResponses) {
      const tpl = r.templateId as unknown as { title?: string; moduleType?: string } | null;
      const title = tpl?.title ?? 'Survey';
      items.push({
        type: 'survey_response',
        label: `${title} response submitted`,
        detail: r.departmentId ? `Department: ${r.departmentId}` : 'Anonymous submission',
        createdAt: r.createdAt,
      });
    }

    for (const c of conflictAnalyses) {
      items.push({
        type: 'conflict_analysis',
        label: 'Conflict analysis completed',
        detail: `${c.departmentId ? c.departmentId + ' — ' : ''}Risk score: ${c.riskScore} (${c.riskLevel.charAt(0).toUpperCase() + c.riskLevel.slice(1)})`,
        createdAt: c.createdAt,
      });
    }

    for (const idp of idps) {
      items.push({
        type: 'idp',
        label: 'Development plan created',
        detail: idp.goal.length > 80 ? idp.goal.slice(0, 80) + '…' : idp.goal,
        createdAt: idp.createdAt,
      });
    }

    for (const n of neuroinclusions) {
      items.push({
        type: 'neuroinclusion',
        label: 'Neuroinclusion assessment submitted',
        detail: `${n.respondentRole} — Maturity score: ${n.overallMaturityScore}/100`,
        createdAt: n.createdAt,
      });
    }

    // Coaching engagements
    for (const eng of engagements) {
      const coachee = eng.coacheeId as unknown as { firstName?: string; lastName?: string } | null;
      const name = coachee ? `${coachee.firstName} ${coachee.lastName}` : 'Unknown';
      items.push({
        type: 'coaching_engagement',
        label: `Coaching engagement ${eng.status === 'prospect' ? 'created' : 'updated'}`,
        detail: `${name} — ${eng.status}`,
        createdAt: eng.createdAt,
      });
    }

    // Coaching sessions
    for (const s of sessions) {
      const coachee = s.coacheeId as unknown as { firstName?: string; lastName?: string } | null;
      const name = coachee ? `${coachee.firstName} ${coachee.lastName}` : 'Unknown';
      items.push({
        type: 'coaching_session',
        label: `Coaching session ${s.status}`,
        detail: `${name} — ${s.duration}min ${s.format}`,
        createdAt: s.createdAt,
      });
    }

    // Journal session notes
    for (const n of journalNotes) {
      const coachee = n.coacheeId as unknown as { firstName?: string; lastName?: string } | null;
      const name = coachee ? `${coachee.firstName} ${coachee.lastName}` : 'Unknown';
      items.push({
        type: 'journal_note',
        label: `Session note #${n.sessionNumber} ${n.status === 'complete' ? 'completed' : 'drafted'}`,
        detail: name,
        createdAt: n.createdAt,
      });
    }

    // Reflective journal entries
    for (const e of reflectiveEntries) {
      const coach = e.coachId as unknown as { firstName?: string; lastName?: string } | null;
      const name = coach ? `${coach.firstName} ${coach.lastName}` : 'Unknown';
      items.push({
        type: 'journal_reflective',
        label: `Reflective entry: ${e.title}`,
        detail: `${name} — ${e.mood}`,
        createdAt: e.createdAt,
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(items.slice(0, 20));
  } catch (e) {
    next(e);
  }
});

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const [
      activeConflicts,
      neuroResult,
      activeIdps,
      activeSurveys,
      totalResponses,
    ] = await Promise.all([
      // Conflict: analyses not yet resolved
      ConflictAnalysis.countDocuments({
        organizationId: orgId,
        escalationStatus: { $nin: ['resolved'] },
      }),

      // Neuro-inclusion: average maturity score across all org assessments
      NeuroinclustionAssessment.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(orgId.toString()) } },
        { $group: { _id: null, avg: { $avg: '$overallMaturityScore' } } },
      ]),

      // Succession: active + draft IDPs
      DevelopmentPlan.countDocuments({
        organizationId: orgId,
        status: { $in: ['active', 'draft'] },
      }),

      // Surveys: active templates (org-specific + global)
      SurveyTemplate.countDocuments({
        $or: [{ organizationId: orgId }, { isGlobal: true }],
        isActive: true,
      }).setOptions({ bypassTenantCheck: true }),

      // Surveys: total responses collected for this org
      SurveyResponse.countDocuments({ organizationId: orgId }),
    ]);

    const maturityScore = neuroResult.length > 0
      ? Math.round(neuroResult[0].avg)
      : null;

    res.json({
      conflict:      { value: activeConflicts,  label: 'active analyses' },
      neuroinclusion:{ value: maturityScore,     label: 'avg maturity score' },
      succession:    { value: activeIdps,        label: 'active IDPs' },
      surveys:       { responses: totalResponses, activeSurveys },
    });
  } catch (e) {
    next(e);
  }
});

export default router;

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
import { ActivityLog } from '../models/ActivityLog.model';
import { buildTemplateAccessOr } from '../services/templateAccess.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

router.get('/activity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const PER_SOURCE = 25;
    const totalCap = Math.min(Number(req.query['limit']) || 50, 500);

    // Cursor — load entries strictly older than this createdAt (used by Load more).
    const sinceParam = typeof req.query['since'] === 'string' ? req.query['since'] : '';
    const sinceDate = sinceParam ? new Date(sinceParam) : null;
    const sinceValid = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : null;

    // Explicit date-range filters (?from=ISO inclusive, ?to=ISO inclusive).
    const fromParam = typeof req.query['from'] === 'string' ? req.query['from'] : '';
    const toParam   = typeof req.query['to']   === 'string' ? req.query['to']   : '';
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate   = toParam   ? new Date(toParam)   : null;
    const fromValid = fromDate && !isNaN(fromDate.getTime()) ? fromDate : null;
    const toValid   = toDate   && !isNaN(toDate.getTime())   ? toDate   : null;

    const dateClause: Record<string, Date> = {};
    if (sinceValid) dateClause['$lt']  = sinceValid;  // cursor wins over explicit `to`
    else if (toValid) dateClause['$lte'] = toValid;
    if (fromValid)  dateClause['$gte'] = fromValid;
    const dateFilter = Object.keys(dateClause).length ? { createdAt: dateClause } : {};

    const typeFilter = typeof req.query['type'] === 'string' && req.query['type'] !== 'all'
      ? String(req.query['type']) : null;

    const [
      surveyResponses, conflictAnalyses, idps, neuroinclusions,
      engagements, sessions, journalNotes, reflectiveEntries,
      activityLogs,
    ] = await Promise.all([
      SurveyResponse.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .populate<{ templateId: { title: string; moduleType: string } }>('templateId', 'title moduleType')
        .lean()
        .setOptions({ bypassTenantCheck: true }),

      ConflictAnalysis.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .lean(),

      DevelopmentPlan.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .lean(),

      NeuroinclustionAssessment.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .lean(),

      CoachingEngagement.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      CoachingSession.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      JournalSessionNote.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .populate('coacheeId', 'firstName lastName')
        .lean(),

      JournalReflectiveEntry.find({ organizationId: orgId, ...dateFilter })
        .sort({ createdAt: -1 })
        .limit(PER_SOURCE)
        .populate('coachId', 'firstName lastName')
        .lean(),

      ActivityLog.find({
        organizationId: orgId,
        ...dateFilter,
        ...(typeFilter ? { type: typeFilter } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(totalCap)
        .populate<{ actorUserId: { firstName: string; lastName: string } | null }>('actorUserId', 'firstName lastName')
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

    // Persisted ActivityLog events (auth, settings, lifecycle changes — anything
    // that doesn't leave a record in another collection)
    for (const a of activityLogs) {
      const actor = a.actorUserId as unknown as { firstName?: string; lastName?: string } | null;
      const actorName = actor ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() : '';
      const detailParts = [a.detail, actorName ? `by ${actorName}` : ''].filter(Boolean);
      items.push({
        type: a.type,
        label: a.label,
        detail: detailParts.join(' — '),
        createdAt: a.createdAt,
      });
    }

    // Apply backend-side type filter to the read-time aggregator output too,
    // so the ?type=… query param has consistent semantics across both sources.
    const filtered = typeFilter ? items.filter((i) => i.type === typeFilter) : items;
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(filtered.slice(0, totalCap));
  } catch (e) {
    next(e);
  }
});

/** Distinct ActivityLog event types in the org — drives the type-filter
 *  dropdown on the activity-log page. Returned independently of the
 *  current filter so the dropdown stays comprehensive. We also include
 *  the legacy aggregator buckets so the frontend can still filter on
 *  inferred entries (survey_response, conflict_analysis, …). */
router.get('/activity-types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const distinct = await ActivityLog.distinct('type', { organizationId: orgId });
    const aggregatorTypes = [
      'survey_response', 'conflict_analysis', 'idp', 'neuroinclusion',
      'coaching_engagement', 'coaching_session', 'journal_note', 'journal_reflective',
    ];
    const all = Array.from(new Set([...distinct, ...aggregatorTypes])).sort();
    res.json(all);
  } catch (e) { next(e); }
});

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const templateAccessOr = await buildTemplateAccessOr(orgId);

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

      // Surveys: active templates (org-specific + enabled global)
      SurveyTemplate.countDocuments({
        $or: templateAccessOr,
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

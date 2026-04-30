import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { authenticateToken, requireRole, requirePermission, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { Invoice } from '../models/Invoice.model';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import { DevelopmentPlan } from '../models/DevelopmentPlan.model';
import { NeuroinclustionAssessment } from '../models/NeuroinclustionAssessment.model';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { JournalEntry } from '../models/JournalEntry.model';
import { buildTemplateAccessOr } from '../services/templateAccess.service';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM ADMIN REPORTS (cross-org)
// ═══════════════════════════════════════════════════════════════════════════

const sysRouter = Router();
sysRouter.use(authenticateToken, requireRole('system_admin'));

/** AR Aging Report — invoices grouped by aging buckets. */
sysRouter.get('/ar-aging', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const invoices = await Invoice.find({
      status: { $in: ['sent', 'overdue'] },
    })
      .setOptions({ bypassTenantCheck: true })
      .populate('organizationId', 'name billingEmail plan')
      .sort({ dueDate: 1 })
      .lean();

    const buckets = {
      current: [] as any[],     // not yet due
      days30: [] as any[],      // 1–30 days overdue
      days60: [] as any[],      // 31–60 days
      days90: [] as any[],      // 61–90 days
      over90: [] as any[],      // 90+ days
    };

    for (const inv of invoices) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const item = {
        invoiceNumber: inv.invoiceNumber,
        organization: inv.organizationId,
        total: inv.total,
        currency: inv.currency,
        dueDate: inv.dueDate,
        daysOverdue: Math.max(0, daysOverdue),
        status: inv.status,
        reminderCount: inv.reminderCount ?? 0,
      };
      if (daysOverdue <= 0) buckets.current.push(item);
      else if (daysOverdue <= 30) buckets.days30.push(item);
      else if (daysOverdue <= 60) buckets.days60.push(item);
      else if (daysOverdue <= 90) buckets.days90.push(item);
      else buckets.over90.push(item);
    }

    const sumBucket = (items: any[]) => items.reduce((s, i) => s + i.total, 0);

    res.json({
      buckets,
      summary: {
        current: { count: buckets.current.length, total: sumBucket(buckets.current) },
        days30:  { count: buckets.days30.length,  total: sumBucket(buckets.days30) },
        days60:  { count: buckets.days60.length,  total: sumBucket(buckets.days60) },
        days90:  { count: buckets.days90.length,  total: sumBucket(buckets.days90) },
        over90:  { count: buckets.over90.length,  total: sumBucket(buckets.over90) },
        grandTotal: sumBucket(invoices),
      },
    });
  } catch (e) { next(e); }
});

/** Revenue report — paid invoices grouped by month. */
sysRouter.get('/revenue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const months = parseInt(req.query['months'] as string) || 12;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const pipeline = [
      { $match: { status: 'paid', paidAt: { $gte: since } } },
      { $group: {
        _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
        revenue: { $sum: '$total' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1 as const, '_id.month': 1 as const } },
    ];

    const result = await Invoice.aggregate(pipeline).option({ bypassTenantCheck: true });
    const data = result.map((r) => ({
      period: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      revenue: r.revenue,
      invoiceCount: r.count,
    }));

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    res.json({ data, totalRevenue, months });
  } catch (e) { next(e); }
});

/** Platform usage report — activity across all orgs. */
sysRouter.get('/platform-usage', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalOrgs, activeOrgs, totalUsers, activeUsers,
      totalAnalyses, totalIdps, totalResponses, totalAssessments,
    ] = await Promise.all([
      Organization.countDocuments({}).setOptions({ bypassTenantCheck: true }),
      Organization.countDocuments({ isActive: true }).setOptions({ bypassTenantCheck: true }),
      User.countDocuments({}).setOptions({ bypassTenantCheck: true }),
      User.countDocuments({ isActive: true }).setOptions({ bypassTenantCheck: true }),
      ConflictAnalysis.countDocuments({}).setOptions({ bypassTenantCheck: true }),
      DevelopmentPlan.countDocuments({}).setOptions({ bypassTenantCheck: true }),
      SurveyResponse.countDocuments({}).setOptions({ bypassTenantCheck: true }),
      NeuroinclustionAssessment.countDocuments({}).setOptions({ bypassTenantCheck: true }),
    ]);

    // Users by role
    const roleBreakdown = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]).option({ bypassTenantCheck: true });

    // Orgs by plan
    const planBreakdown = await Organization.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]).option({ bypassTenantCheck: true });

    res.json({
      organizations: { total: totalOrgs, active: activeOrgs, inactive: totalOrgs - activeOrgs },
      users: { total: totalUsers, active: activeUsers, inactive: totalUsers - activeUsers },
      activity: {
        conflictAnalyses: totalAnalyses,
        developmentPlans: totalIdps,
        surveyResponses: totalResponses,
        neuroAssessments: totalAssessments,
      },
      roleBreakdown: Object.fromEntries(roleBreakdown.map((r) => [r._id, r.count])),
      planBreakdown: Object.fromEntries(planBreakdown.map((p) => [p._id || 'none', p.count])),
    });
  } catch (e) { next(e); }
});

/** Organization detail report — per-org stats for all orgs. */
sysRouter.get('/org-summary', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgs = await Organization.find({}).setOptions({ bypassTenantCheck: true }).lean();
    const report = [];

    for (const org of orgs) {
      const orgId = org._id;
      const [userCount, analysisCount, idpCount, responseCount, invoiceTotal] = await Promise.all([
        User.countDocuments({ organizationId: orgId, isActive: true }).setOptions({ bypassTenantCheck: true }),
        ConflictAnalysis.countDocuments({ organizationId: orgId }).setOptions({ bypassTenantCheck: true }),
        DevelopmentPlan.countDocuments({ organizationId: orgId }).setOptions({ bypassTenantCheck: true }),
        SurveyResponse.countDocuments({ organizationId: orgId }).setOptions({ bypassTenantCheck: true }),
        Invoice.aggregate([
          { $match: { organizationId: orgId, status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$total' } } },
        ]).then((r) => r[0]?.total || 0),
      ]);

      report.push({
        orgId, name: org.name, plan: org.plan, isActive: org.isActive,
        maxUsers: org.maxUsers, modules: org.modules,
        userCount, analysisCount, idpCount, responseCount,
        totalRevenue: invoiceTotal,
      });
    }

    res.json(report);
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// ORG ADMIN REPORTS (tenant-scoped)
// ═══════════════════════════════════════════════════════════════════════════

const orgRouter = Router();
orgRouter.use(authenticateToken, tenantResolver, requirePermission('VIEW_REPORTS'));

/** Org engagement report — user activity summary. */
orgRouter.get('/engagement', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const [totalUsers, activeUsers, totalResponses, totalAnalyses, totalIdps, totalJournals] = await Promise.all([
      User.countDocuments({ organizationId: orgId }),
      User.countDocuments({ organizationId: orgId, isActive: true }),
      SurveyResponse.countDocuments({ organizationId: orgId }),
      ConflictAnalysis.countDocuments({ organizationId: orgId }),
      DevelopmentPlan.countDocuments({ organizationId: orgId }),
      JournalEntry.countDocuments({ organizationId: orgId }),
    ]);

    // Users by role
    const roleBreakdown = await User.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    // Users by department
    const deptBreakdown = await User.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId), department: { $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Recent logins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentLogins = await User.countDocuments({
      organizationId: orgId,
      lastLoginAt: { $gte: thirtyDaysAgo },
    });

    res.json({
      users: { total: totalUsers, active: activeUsers, recentLogins },
      activity: {
        surveyResponses: totalResponses,
        conflictAnalyses: totalAnalyses,
        developmentPlans: totalIdps,
        journalEntries: totalJournals,
      },
      roleBreakdown: Object.fromEntries(roleBreakdown.map((r) => [r._id, r.count])),
      deptBreakdown: deptBreakdown.map((d) => ({ department: d._id, count: d.count })),
    });
  } catch (e) { next(e); }
});

/** Conflict risk report — risk trends and department breakdown. */
orgRouter.get('/conflict-risk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const analyses = await ConflictAnalysis.find({ organizationId: orgId, parentId: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // By risk level
    const byLevel: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const a of analyses) { byLevel[a.riskLevel] = (byLevel[a.riskLevel] || 0) + 1; }

    // By department
    const byDept: Record<string, { count: number; avgScore: number; total: number }> = {};
    for (const a of analyses) {
      const dept = a.departmentId || 'All Departments';
      if (!byDept[dept]) byDept[dept] = { count: 0, avgScore: 0, total: 0 };
      byDept[dept].count++;
      byDept[dept].total += a.riskScore;
    }
    for (const d of Object.values(byDept)) { d.avgScore = Math.round(d.total / d.count); }

    // Trend (monthly avg risk score)
    const trend = await ConflictAnalysis.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId), parentId: { $exists: false } } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        avgScore: { $avg: '$riskScore' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Escalation stats
    const escalated = analyses.filter((a) => a.escalationRequested).length;

    res.json({
      total: analyses.length,
      avgRiskScore: analyses.length ? Math.round(analyses.reduce((s, a) => s + a.riskScore, 0) / analyses.length) : 0,
      byLevel,
      byDepartment: byDept,
      escalated,
      trend: trend.map((t) => ({
        period: `${t._id.year}-${String(t._id.month).padStart(2, '0')}`,
        avgScore: Math.round(t.avgScore),
        count: t.count,
      })),
    });
  } catch (e) { next(e); }
});

/** IDP progress report. */
orgRouter.get('/idp-progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const idps = await DevelopmentPlan.find({ organizationId: orgId })
      .populate('coacheeId', 'firstName lastName department')
      .lean();

    const byStatus: Record<string, number> = { draft: 0, active: 0, completed: 0 };
    let totalMilestones = 0;
    let completedMilestones = 0;

    for (const idp of idps) {
      byStatus[idp.status] = (byStatus[idp.status] || 0) + 1;
      totalMilestones += idp.milestones.length;
      completedMilestones += idp.milestones.filter((m) => m.status === 'completed').length;
    }

    res.json({
      total: idps.length,
      byStatus,
      milestones: { total: totalMilestones, completed: completedMilestones, rate: totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0 },
      plans: idps.map((idp) => ({
        id: idp._id,
        coachee: idp.coacheeId,
        goal: idp.goal,
        status: idp.status,
        sourceModule: (idp as any).sourceModule || 'succession',
        milestonesDone: idp.milestones.filter((m) => m.status === 'completed').length,
        milestonesTotal: idp.milestones.length,
        competencyGaps: idp.competencyGaps,
        createdAt: idp.createdAt,
      })),
    });
  } catch (e) { next(e); }
});

/** Survey response report. */
orgRouter.get('/survey-activity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;

    const templates = await SurveyTemplate.find({
      $or: await buildTemplateAccessOr(orgId),
      isActive: true,
    }).setOptions({ bypassTenantCheck: true }).lean();

    const templateStats = [];
    for (const tpl of templates) {
      const responseCount = await SurveyResponse.countDocuments({
        organizationId: orgId,
        templateId: tpl._id,
      });
      templateStats.push({
        templateId: tpl._id,
        title: tpl.title,
        moduleType: tpl.moduleType,
        intakeType: tpl.intakeType,
        responseCount,
        isGlobal: tpl.isGlobal || false,
      });
    }

    const totalResponses = templateStats.reduce((s, t) => s + t.responseCount, 0);

    // Monthly trend
    const trend = await SurveyResponse.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      { $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      totalResponses,
      activeTemplates: templates.length,
      templates: templateStats.sort((a, b) => b.responseCount - a.responseCount),
      trend: trend.map((t) => ({
        period: `${t._id.year}-${String(t._id.month).padStart(2, '0')}`,
        count: t.count,
      })),
    });
  } catch (e) { next(e); }
});

// Mount both routers
router.use('/system-admin', sysRouter);
router.use('/org', orgRouter);

export default router;

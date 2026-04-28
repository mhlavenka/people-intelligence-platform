/**
 * Aggregation service for ICF-credentialing hours.
 *
 * Source-of-truth model:
 *   - Hours from completed CoachingSession documents are the canonical record
 *     for in-platform coaching. They are NOT materialized into CoachingHoursLog
 *     because that would require keeping two stores in sync on every session
 *     edit / cancel / reschedule.
 *   - CoachingHoursLog stores only manual entries: external clients, mentor
 *     coaching received, CCE credits, and CSV-imported rows.
 *
 * `getHoursSummary` unions both sources at read time and returns per-category
 * totals plus progress toward each ICF credential level.
 */

import mongoose from 'mongoose';
import { CoachingSession } from '../models/CoachingSession.model';
import { CoachingHoursLog, HoursLogCategory, HoursLogClientType, HoursLogPaidStatus } from '../models/CoachingHoursLog.model';
import { ICF_LEVELS, IcfLevelKey } from '../config/icf-credential-levels';

export interface HoursDateRange {
  from?: Date;
  to?: Date;
}

export interface HoursSummary {
  totals: {
    /** Sum of all coaching hours that count toward ICF (session category, paid + pro_bono). */
    coachingTotal: number;
    paid: number;
    proBono: number;
    individual: number;
    team: number;
    group: number;
    /** Mentor-coaching hours received (separate ICF requirement, not added to coachingTotal). */
    mentorCoachingReceived: number;
    /** CCE credit hours (Continuing Coach Education). */
    cceCredits: number;
  };
  bySource: {
    fromSessions: number;       // completed CoachingSession durations
    fromManualLog: number;      // session-category CoachingHoursLog rows
  };
  icfProgress: Array<{
    level: IcfLevelKey;
    name: string;
    coachingHoursRequired: number;
    coachingHoursLogged: number;
    coachingHoursRemaining: number;
    percentComplete: number;
    mentorCoachingRequired: number;
    mentorCoachingLogged: number;
    eligible: boolean;          // both coaching + mentor thresholds met
  }>;
  dateRange: { from?: Date; to?: Date };
}

export interface HoursLogEntry {
  source: 'session' | 'manual';
  id: string;
  date: Date;
  hours: number;
  category: HoursLogCategory;
  clientType?: HoursLogClientType;
  paidStatus?: HoursLogPaidStatus;
  clientName?: string;
  clientOrganization?: string;
  sponsorContactName?: string;
  assessmentType?: string;
  mentorCoachName?: string;
  mentorCoachOrganization?: string;
  notes?: string;
}

function buildDateMatch(field: string, range: HoursDateRange): Record<string, any> {
  const match: Record<string, any> = {};
  if (range.from || range.to) {
    match[field] = {};
    if (range.from) match[field].$gte = range.from;
    if (range.to)   match[field].$lte = range.to;
  }
  return match;
}

/**
 * Compute the hours summary for one coach.
 * `organizationId` scopes the query to the coach's tenant; the tenantFilterPlugin
 * also enforces this at the model layer when `bypassTenantCheck` is not set.
 */
export async function getHoursSummary(
  organizationId: mongoose.Types.ObjectId,
  coachId: mongoose.Types.ObjectId,
  range: HoursDateRange = {},
): Promise<HoursSummary> {
  // 1. Hours from completed CoachingSession rows
  const sessionMatch: Record<string, any> = {
    organizationId,
    coachId,
    status: 'completed',
    ...buildDateMatch('date', range),
  };

  const sessionAgg = await CoachingSession.aggregate([
    { $match: sessionMatch },
    {
      $group: {
        _id: { clientType: '$clientType', paidStatus: '$paidStatus' },
        minutes: { $sum: '$duration' },
      },
    },
  ]).option({ bypassTenantCheck: true } as any);

  let sessionPaid = 0;
  let sessionProBono = 0;
  let sessionIndividual = 0;
  let sessionTeam = 0;
  let sessionGroup = 0;
  let sessionTotalMinutes = 0;

  for (const row of sessionAgg) {
    const minutes = row.minutes ?? 0;
    sessionTotalMinutes += minutes;
    if (row._id.paidStatus === 'paid') sessionPaid += minutes;
    else if (row._id.paidStatus === 'pro_bono') sessionProBono += minutes;
    if (row._id.clientType === 'individual') sessionIndividual += minutes;
    else if (row._id.clientType === 'team') sessionTeam += minutes;
    else if (row._id.clientType === 'group') sessionGroup += minutes;
  }

  // 2. Hours from manual CoachingHoursLog rows
  const logMatch: Record<string, any> = {
    organizationId,
    coachId,
    ...buildDateMatch('date', range),
  };

  const logAgg = await CoachingHoursLog.aggregate([
    { $match: logMatch },
    {
      $group: {
        _id: { category: '$category', clientType: '$clientType', paidStatus: '$paidStatus' },
        hours: { $sum: '$hours' },
      },
    },
  ]).option({ bypassTenantCheck: true } as any);

  let logPaid = 0;
  let logProBono = 0;
  let logIndividual = 0;
  let logTeam = 0;
  let logGroup = 0;
  let mentorReceived = 0;
  let cceCredits = 0;
  let logSessionHours = 0;

  for (const row of logAgg) {
    const hours = row.hours ?? 0;
    if (row._id.category === 'session') {
      logSessionHours += hours;
      if (row._id.paidStatus === 'paid') logPaid += hours;
      else if (row._id.paidStatus === 'pro_bono') logProBono += hours;
      if (row._id.clientType === 'individual') logIndividual += hours;
      else if (row._id.clientType === 'team') logTeam += hours;
      else if (row._id.clientType === 'group') logGroup += hours;
    } else if (row._id.category === 'mentor_coaching_received') {
      mentorReceived += hours;
    } else if (row._id.category === 'cce') {
      cceCredits += hours;
    }
  }

  const sessionTotalHours = sessionTotalMinutes / 60;
  const coachingTotal = sessionTotalHours + logSessionHours;

  const totals: HoursSummary['totals'] = {
    coachingTotal: round2(coachingTotal),
    paid: round2(sessionPaid / 60 + logPaid),
    proBono: round2(sessionProBono / 60 + logProBono),
    individual: round2(sessionIndividual / 60 + logIndividual),
    team: round2(sessionTeam / 60 + logTeam),
    group: round2(sessionGroup / 60 + logGroup),
    mentorCoachingReceived: round2(mentorReceived),
    cceCredits: round2(cceCredits),
  };

  const icfProgress = ICF_LEVELS.map((level) => {
    const remaining = Math.max(0, level.coachingHoursRequired - totals.coachingTotal);
    const percent = level.coachingHoursRequired === 0
      ? 100
      : Math.min(100, (totals.coachingTotal / level.coachingHoursRequired) * 100);
    const eligible =
      totals.coachingTotal >= level.coachingHoursRequired
      && totals.mentorCoachingReceived >= level.mentorCoachingHoursRequired;
    return {
      level: level.key,
      name: level.name,
      coachingHoursRequired: level.coachingHoursRequired,
      coachingHoursLogged: totals.coachingTotal,
      coachingHoursRemaining: round2(remaining),
      percentComplete: round2(percent),
      mentorCoachingRequired: level.mentorCoachingHoursRequired,
      mentorCoachingLogged: totals.mentorCoachingReceived,
      eligible,
    };
  });

  return {
    totals,
    bySource: {
      fromSessions: round2(sessionTotalHours),
      fromManualLog: round2(logSessionHours),
    },
    icfProgress,
    dateRange: { from: range.from, to: range.to },
  };
}

/**
 * Flat union of session-derived rows and manual log rows for export and
 * detail tables. Rows are sorted by date descending.
 */
export async function getHoursLogEntries(
  organizationId: mongoose.Types.ObjectId,
  coachId: mongoose.Types.ObjectId,
  range: HoursDateRange = {},
): Promise<HoursLogEntry[]> {
  const sessionMatch: Record<string, any> = {
    organizationId,
    coachId,
    status: 'completed',
    ...buildDateMatch('date', range),
  };

  const [sessions, manual] = await Promise.all([
    CoachingSession.find(sessionMatch)
      .select('_id date duration clientType paidStatus sharedNotes coacheeId')
      .populate({ path: 'coacheeId', select: 'firstName lastName' })
      .setOptions({ bypassTenantCheck: true } as any)
      .lean(),
    CoachingHoursLog.find({ organizationId, coachId, ...buildDateMatch('date', range) })
      .setOptions({ bypassTenantCheck: true } as any)
      .lean(),
  ]);

  const sessionRows: HoursLogEntry[] = sessions.map((s: any) => ({
    source: 'session',
    id: String(s._id),
    date: s.date,
    hours: round2((s.duration ?? 0) / 60),
    category: 'session',
    clientType: s.clientType,
    paidStatus: s.paidStatus,
    clientName: s.coacheeId
      ? `${s.coacheeId.firstName ?? ''} ${s.coacheeId.lastName ?? ''}`.trim()
      : undefined,
    notes: s.sharedNotes || undefined,
  }));

  const manualRows: HoursLogEntry[] = manual.map((m: any) => ({
    source: 'manual',
    id: String(m._id),
    date: m.date,
    hours: round2(m.hours ?? 0),
    category: m.category,
    clientType: m.clientType,
    paidStatus: m.paidStatus,
    clientName: m.clientName || m.mentorCoachName || m.cceProvider,
    clientOrganization: m.clientOrganization,
    sponsorContactName: m.sponsorContactName,
    assessmentType: m.assessmentType,
    mentorCoachName: m.mentorCoachName,
    mentorCoachOrganization: m.mentorCoachOrganization,
    notes: m.notes,
  }));

  return [...sessionRows, ...manualRows].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

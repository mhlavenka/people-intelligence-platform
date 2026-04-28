/**
 * CSV import/export for ICF-credentialing hours.
 *
 * Import: parses a CSV buffer, validates row-by-row, returns a preview of
 * accepted/rejected rows on dryRun, or commits valid rows on dryRun=false.
 * Rejected rows never short-circuit valid ones — coaches can fix what
 * failed and re-import only the bad rows.
 *
 * Export: emits the full hours log (sessions + manual rows) as a flat CSV
 * matching the column order of the official ICF Coaching Hours Log
 * spreadsheet, so the file can be uploaded directly with a credential
 * application.
 */

import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import {
  CoachingHoursLog,
  HoursLogCategory,
  HoursLogClientType,
  HoursLogPaidStatus,
  CceCategory,
} from '../models/CoachingHoursLog.model';
import { getHoursLogEntries } from './coachingHours.service';

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportRowResult {
  rowNumber: number;             // 1-based, matches the CSV row (header = 1)
  raw: Record<string, string>;
  parsed?: Partial<{
    date: Date;
    hours: number;
    category: HoursLogCategory;
    clientType: HoursLogClientType;
    paidStatus: HoursLogPaidStatus;
    clientName: string;
    clientOrganization: string;
    clientEmail: string;
    sponsorContactName: string;
    assessmentType: string;
    mentorCoachName: string;
    mentorCoachIcfCredential: 'ACC' | 'PCC' | 'MCC';
    mentorCoachOrganization: string;
    cceCategory: CceCategory;
    cceProvider: string;
    cceCertificateUrl: string;
    notes: string;
  }>;
  errors: string[];              // empty when row is valid
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRowResult[];
  committed: boolean;
}

const REQUIRED_HEADERS = ['date', 'hours', 'category'] as const;

const VALID_CATEGORIES: HoursLogCategory[] = ['session', 'mentor_coaching_received', 'cce'];
const VALID_CLIENT_TYPES: HoursLogClientType[] = ['individual', 'team', 'group'];
const VALID_PAID_STATUSES: HoursLogPaidStatus[] = ['paid', 'pro_bono'];
const VALID_CCE_CATEGORIES: CceCategory[] = ['core_competency', 'resource_development'];
const VALID_MENTOR_CREDS = ['ACC', 'PCC', 'MCC'] as const;

export async function importCsv(
  organizationId: mongoose.Types.ObjectId,
  coachId: mongoose.Types.ObjectId,
  fileBuffer: Buffer,
  filename: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportPreview> {
  const dryRun = options.dryRun !== false;        // default true

  let records: Record<string, string>[];
  try {
    records = parse(fileBuffer, {
      columns: (h) => (h as string[]).map((s) => s.trim().toLowerCase().replace(/\s+/g, '_')),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`CSV parse failed: ${message}`);
  }

  if (records.length === 0) {
    return { totalRows: 0, validRows: 0, invalidRows: 0, rows: [], committed: false };
  }

  const headers = Object.keys(records[0] ?? {});
  const missingRequired = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingRequired.length > 0) {
    throw new Error(`Missing required column(s): ${missingRequired.join(', ')}`);
  }

  const rows: ImportRowResult[] = records.map((raw, idx) => validateRow(raw, idx + 2)); // +2 = header is row 1

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  if (!dryRun && validRows.length > 0) {
    const docs = validRows.map((r) => ({
      ...r.parsed!,
      organizationId,
      coachId,
      importedFromFile: filename,
    }));
    await CoachingHoursLog.insertMany(docs);
  }

  return {
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    rows,
    committed: !dryRun && validRows.length > 0,
  };
}

function validateRow(raw: Record<string, string>, rowNumber: number): ImportRowResult {
  const errors: string[] = [];
  const parsed: ImportRowResult['parsed'] = {};

  // date
  const dateStr = (raw['date'] ?? '').trim();
  if (!dateStr) {
    errors.push('date is required');
  } else {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      errors.push(`date "${dateStr}" is not a valid date (try YYYY-MM-DD)`);
    } else {
      parsed.date = d;
    }
  }

  // hours
  const hoursStr = (raw['hours'] ?? '').trim();
  if (!hoursStr) {
    errors.push('hours is required');
  } else {
    const n = Number(hoursStr);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`hours "${hoursStr}" must be a non-negative number`);
    } else {
      parsed.hours = n;
    }
  }

  // category
  const categoryStr = (raw['category'] ?? '').trim().toLowerCase();
  if (!categoryStr) {
    errors.push('category is required');
  } else if (!VALID_CATEGORIES.includes(categoryStr as HoursLogCategory)) {
    errors.push(`category "${categoryStr}" must be one of: ${VALID_CATEGORIES.join(', ')}`);
  } else {
    parsed.category = categoryStr as HoursLogCategory;
  }

  // optional / category-specific fields (only validate format; don't reject for absence)
  const clientType = (raw['client_type'] ?? '').trim().toLowerCase();
  if (clientType) {
    if (!VALID_CLIENT_TYPES.includes(clientType as HoursLogClientType)) {
      errors.push(`client_type "${clientType}" must be one of: ${VALID_CLIENT_TYPES.join(', ')}`);
    } else {
      parsed.clientType = clientType as HoursLogClientType;
    }
  }

  const paidStatus = (raw['paid_status'] ?? '').trim().toLowerCase();
  if (paidStatus) {
    if (!VALID_PAID_STATUSES.includes(paidStatus as HoursLogPaidStatus)) {
      errors.push(`paid_status "${paidStatus}" must be one of: ${VALID_PAID_STATUSES.join(', ')}`);
    } else {
      parsed.paidStatus = paidStatus as HoursLogPaidStatus;
    }
  }

  const cceCategory = (raw['cce_category'] ?? '').trim().toLowerCase();
  if (cceCategory) {
    if (!VALID_CCE_CATEGORIES.includes(cceCategory as CceCategory)) {
      errors.push(`cce_category "${cceCategory}" must be one of: ${VALID_CCE_CATEGORIES.join(', ')}`);
    } else {
      parsed.cceCategory = cceCategory as CceCategory;
    }
  }

  const mentorCred = (raw['mentor_coach_icf_credential'] ?? '').trim().toUpperCase();
  if (mentorCred) {
    if (!(VALID_MENTOR_CREDS as readonly string[]).includes(mentorCred)) {
      errors.push(`mentor_coach_icf_credential "${mentorCred}" must be one of: ${VALID_MENTOR_CREDS.join(', ')}`);
    } else {
      parsed.mentorCoachIcfCredential = mentorCred as 'ACC' | 'PCC' | 'MCC';
    }
  }

  // Free-text passthroughs
  copyIfPresent(raw, parsed, 'client_name', 'clientName');
  copyIfPresent(raw, parsed, 'client_organization', 'clientOrganization');
  copyIfPresent(raw, parsed, 'client_email', 'clientEmail');
  copyIfPresent(raw, parsed, 'sponsor_contact_name', 'sponsorContactName');
  copyIfPresent(raw, parsed, 'assessment_type', 'assessmentType');
  copyIfPresent(raw, parsed, 'mentor_coach_name', 'mentorCoachName');
  copyIfPresent(raw, parsed, 'mentor_coach_organization', 'mentorCoachOrganization');
  copyIfPresent(raw, parsed, 'cce_provider', 'cceProvider');
  copyIfPresent(raw, parsed, 'cce_certificate_url', 'cceCertificateUrl');
  copyIfPresent(raw, parsed, 'notes', 'notes');

  // Cross-field rule: session category should have a clientType.
  if (parsed.category === 'session' && !parsed.clientType) {
    parsed.clientType = 'individual';   // sensible default rather than reject
  }

  return { rowNumber, raw, parsed, errors };
}

function copyIfPresent(
  raw: Record<string, string>,
  parsed: ImportRowResult['parsed'],
  csvKey: string,
  parsedKey: keyof NonNullable<ImportRowResult['parsed']>,
): void {
  const v = (raw[csvKey] ?? '').trim();
  if (v) (parsed as any)[parsedKey] = v;
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Columns mirror the ICF Client Coaching Log spreadsheet.
 *
 * One row per coaching engagement (i.e. per client), aggregating all sessions
 * for that client into total paid hours, total pro bono hours, start date,
 * end date, and session count. Mentor Coaching Received and CCE entries are
 * surfaced as separate rows tagged in the `coaching_type` column.
 */
const ICF_EXPORT_COLUMNS = [
  'client_name',
  'client_contact_information',
  'coaching_type',                  // Individual / Group / Team / Mentor Coaching Received / CCE
  'number_of_paid_hours',
  'number_of_pro_bono_hours',
  'start_date_of_coaching',
  'end_date_of_coaching',
  'number_of_sessions',
  'sponsor_organization',
  'sponsor_contact',
  'mentor_coach_name',
  'mentor_coach_organization',
  'assessment_type',
  'notes',
] as const;

interface AggregateRow {
  clientName: string;
  clientContact: string;
  coachingType: string;
  paidHours: number;
  proBonoHours: number;
  startDate: Date | null;
  endDate: Date | null;
  sessionCount: number;
  sponsorOrganization: string;
  sponsorContact: string;
  mentorCoachName: string;
  mentorCoachOrganization: string;
  assessmentType: string;
  notes: string[];
}

const COACHING_TYPE_LABEL: Record<string, string> = {
  individual: 'Individual',
  team: 'Team',
  group: 'Group',
};

function makeKey(e: { clientName?: string; clientOrganization?: string; clientType?: string; assessmentType?: string }): string {
  return [
    (e.clientName ?? '').toLowerCase().trim(),
    (e.clientOrganization ?? '').toLowerCase().trim(),
    e.clientType ?? '',
    e.assessmentType ?? '',
  ].join('|');
}

export async function exportCsv(
  organizationId: mongoose.Types.ObjectId,
  coachId: mongoose.Types.ObjectId,
  range: { from?: Date; to?: Date } = {},
): Promise<string> {
  const entries = await getHoursLogEntries(organizationId, coachId, range);

  // 1. Bucket session-category entries by (client + organization + clientType + assessmentType)
  // 2. Mentor Coaching Received: bucket by (mentorCoachName + mentorCoachOrganization)
  // 3. CCE: bucket by cceProvider/notes (one row per provider × category)
  const byKey = new Map<string, AggregateRow>();

  for (const e of entries) {
    let key: string;
    let agg: AggregateRow;

    if (e.category === 'mentor_coaching_received') {
      key = `mentor|${(e.mentorCoachName ?? '').toLowerCase()}|${(e.mentorCoachOrganization ?? '').toLowerCase()}`;
      agg = byKey.get(key) ?? blankAggregate();
      agg.coachingType = 'Mentor Coaching Received';
      agg.clientName = e.mentorCoachName ?? '';
      agg.mentorCoachName = e.mentorCoachName ?? agg.mentorCoachName;
      agg.mentorCoachOrganization = e.mentorCoachOrganization ?? agg.mentorCoachOrganization;
    } else if (e.category === 'cce') {
      key = `cce|${(e.notes ?? '').toLowerCase()}`;
      agg = byKey.get(key) ?? blankAggregate();
      agg.coachingType = 'CCE';
      agg.clientName = e.notes ?? 'CCE credit';
    } else {
      // session / assessment debrief
      key = makeKey(e);
      agg = byKey.get(key) ?? blankAggregate();
      agg.coachingType = COACHING_TYPE_LABEL[e.clientType ?? 'individual'] ?? 'Individual';
      agg.clientName = e.clientName ?? agg.clientName;
      agg.clientContact = e.clientEmail ?? agg.clientContact;
      agg.sponsorOrganization = e.clientOrganization ?? agg.sponsorOrganization;
      agg.sponsorContact = e.sponsorContactName ?? agg.sponsorContact;
      agg.assessmentType = e.assessmentType ?? agg.assessmentType;
    }

    // Common: hours, dates, count, notes
    if (e.paidStatus === 'pro_bono') {
      agg.proBonoHours += e.hours;
    } else {
      // 'paid' or unset (mentor/cce default): treat as paid
      agg.paidHours += e.hours;
    }
    if (!agg.startDate || e.date < agg.startDate) agg.startDate = e.date;
    if (!agg.endDate   || e.date > agg.endDate)   agg.endDate = e.date;
    agg.sessionCount += 1;
    if (e.notes && !agg.notes.includes(e.notes)) agg.notes.push(e.notes);

    byKey.set(key, agg);
  }

  // Sort by coachingType then clientName for a readable export
  const rows = [...byKey.values()].sort((a, b) =>
    a.coachingType.localeCompare(b.coachingType) || a.clientName.localeCompare(b.clientName),
  );

  const lines: string[] = [];
  lines.push(ICF_EXPORT_COLUMNS.join(','));

  for (const r of rows) {
    const row: Record<string, string> = {
      client_name: r.clientName,
      client_contact_information: r.clientContact,
      coaching_type: r.coachingType,
      number_of_paid_hours: round2(r.paidHours).toString(),
      number_of_pro_bono_hours: round2(r.proBonoHours).toString(),
      start_date_of_coaching: r.startDate ? r.startDate.toISOString().slice(0, 10) : '',
      end_date_of_coaching:   r.endDate   ? r.endDate.toISOString().slice(0, 10)   : '',
      number_of_sessions: String(r.sessionCount),
      sponsor_organization: r.sponsorOrganization,
      sponsor_contact: r.sponsorContact,
      mentor_coach_name: r.mentorCoachName,
      mentor_coach_organization: r.mentorCoachOrganization,
      assessment_type: r.assessmentType,
      notes: r.notes.slice(0, 5).join('; ').replace(/\s+/g, ' ').trim(),
    };
    lines.push(ICF_EXPORT_COLUMNS.map((c) => csvEscape(row[c] ?? '')).join(','));
  }

  return lines.join('\n') + '\n';
}

function blankAggregate(): AggregateRow {
  return {
    clientName: '',
    clientContact: '',
    coachingType: '',
    paidHours: 0,
    proBonoHours: 0,
    startDate: null,
    endDate: null,
    sessionCount: 0,
    sponsorOrganization: '',
    sponsorContact: '',
    mentorCoachName: '',
    mentorCoachOrganization: '',
    assessmentType: '',
    notes: [],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

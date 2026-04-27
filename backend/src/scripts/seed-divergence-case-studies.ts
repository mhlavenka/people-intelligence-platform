/**
 * Seed the 10 divergence case studies under the Onkwe organisation.
 *
 * One department per case study, populated with anonymous SurveyResponse
 * documents matching the matrices in /docs/caseStudies/*.md. Idempotent —
 * for each case the script first deletes existing SurveyResponse and
 * ConflictAnalysis documents in scope (org=Onkwe, dept=case-N), then
 * inserts fresh responses.
 *
 * Quality scoring runs naturally via computeQuality() so the case-10
 * straightliner is detected by the live quality pipeline rather than by
 * a manual override — that way the test verifies the actual filter.
 *
 *   npx ts-node src/scripts/seed-divergence-case-studies.ts          # dry-run
 *   npx ts-node src/scripts/seed-divergence-case-studies.ts --apply  # write
 *   npx ts-node src/scripts/seed-divergence-case-studies.ts --case 04 --apply
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { Organization } from '../models/Organization.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { SurveyResponse } from '../models/SurveyResponse.model';
import { ConflictAnalysis } from '../models/ConflictAnalysis.model';
import { computeQuality, DEFAULT_QUALITY_POLICY } from '../services/surveyMetrics.service';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyCaseFlag = args.indexOf('--case');
const onlyCase = onlyCaseFlag >= 0 ? args[onlyCaseFlag + 1] : null;
const bypass = { bypassTenantCheck: true };

const ORG_SLUG = 'onkwe';
const PULSE_INSTRUMENT_ID = 'HNP-PULSE';

// Question id order used by every row: cp01..cp12 then cp14
// (cp13 / cp15 are free-text and intentionally omitted from the metric matrix)
const QUESTION_IDS = [
  'cp01', 'cp02', 'cp03',
  'cp04', 'cp05', 'cp06',
  'cp07', 'cp08', 'cp09',
  'cp10', 'cp11', 'cp12',
  'cp14',
] as const;

// Boolean question ids — values stored as boolean, not number, so the
// quality scorer recognises them correctly.
const BOOLEAN_IDS = new Set(['cp03', 'cp08', 'cp12']);

interface CaseStudy {
  slug: string;                      // dept identifier on Onkwe.departments[]
  title: string;                     // human-readable
  rows: ReadonlyArray<readonly number[]>;  // each row: 13 numbers in QUESTION_IDS order
  text?: { cp13?: string; cp15?: string }[]; // optional, indexed by row
}

// ── Case 01 — Aligned & Healthy ──────────────────────────────────────────────
const CASE_01: CaseStudy = {
  slug: 'case-01-healthy',
  title: 'Case 01 — Aligned & Healthy',
  rows: [
    [9, 9, 0, 9, 9, 8, 2, 0, 1, 9, 9, 0, 9],
    [8, 9, 0, 8, 9, 9, 1, 0, 2, 9, 8, 0, 9],
    [9, 8, 0, 9, 8, 8, 2, 0, 1, 8, 9, 0, 8],
    [8, 8, 0, 8, 8, 9, 3, 0, 2, 8, 8, 0, 8],
    [9, 9, 0, 9, 9, 9, 1, 0, 1, 9, 9, 0, 9],
    [8, 9, 0, 8, 8, 8, 2, 0, 2, 8, 8, 0, 8],
    [9, 8, 0, 9, 9, 8, 2, 0, 1, 9, 9, 0, 9],
    [8, 9, 0, 8, 8, 9, 3, 0, 2, 8, 8, 0, 8],
  ],
};

// ── Case 02 — Aligned but Mediocre ───────────────────────────────────────────
const CASE_02: CaseStudy = {
  slug: 'case-02-mediocre',
  title: 'Case 02 — Aligned but Mediocre',
  rows: [
    [5, 6, 0, 5, 6, 5, 5, 0, 5, 5, 6, 0, 6],
    [6, 5, 0, 6, 5, 6, 4, 0, 4, 6, 5, 0, 5],
    [5, 6, 0, 5, 6, 5, 5, 0, 5, 5, 6, 0, 6],
    [6, 6, 0, 6, 5, 6, 5, 0, 5, 6, 5, 0, 5],
    [5, 5, 0, 5, 6, 5, 5, 1, 6, 5, 5, 0, 5],
    [6, 6, 0, 6, 6, 6, 4, 0, 5, 6, 6, 0, 6],
    [5, 5, 0, 5, 5, 6, 6, 0, 5, 5, 5, 0, 5],
    [6, 6, 0, 6, 6, 5, 5, 0, 4, 6, 6, 0, 6],
    [5, 6, 0, 6, 5, 6, 5, 1, 5, 5, 6, 0, 5],
    [6, 5, 0, 5, 6, 5, 5, 0, 5, 6, 5, 0, 6],
  ],
};

// ── Case 03 — Polarised After Merger ─────────────────────────────────────────
const CASE_03: CaseStudy = {
  slug: 'case-03-merger',
  title: 'Case 03 — Polarised After Merger',
  rows: [
    [9, 8, 0, 9, 8, 8, 2, 0, 2, 8, 9, 0, 8],
    [8, 9, 0, 8, 9, 9, 2, 0, 1, 9, 8, 0, 9],
    [9, 8, 0, 8, 8, 8, 3, 0, 2, 9, 8, 0, 8],
    [8, 9, 0, 9, 8, 9, 2, 0, 1, 8, 9, 0, 8],
    [2, 2, 1, 2, 3, 2, 8, 1, 8, 2, 2, 1, 2],
    [2, 3, 1, 2, 2, 3, 9, 1, 9, 2, 3, 1, 2],
    [3, 2, 1, 3, 2, 2, 8, 1, 8, 3, 2, 1, 3],
    [2, 2, 0, 2, 3, 2, 9, 1, 9, 2, 2, 1, 2],
  ],
};

// ── Case 04 — Two Shifts, Two Realities (subgroup-detectable) ────────────────
const CASE_04: CaseStudy = {
  slug: 'case-04-shifts',
  title: 'Case 04 — Two Shifts, Two Realities',
  rows: [
    [8, 8, 0, 8, 8, 7, 2, 0, 2, 9, 9, 0, 8],
    [9, 9, 0, 8, 9, 8, 2, 0, 1, 9, 8, 0, 9],
    [8, 8, 0, 9, 8, 8, 3, 0, 2, 8, 9, 0, 8],
    [9, 8, 0, 8, 9, 9, 2, 0, 2, 9, 9, 0, 8],
    [8, 9, 0, 8, 8, 8, 1, 0, 1, 8, 8, 0, 9],
    [9, 8, 0, 9, 9, 8, 2, 0, 2, 9, 9, 0, 8],
    [3, 3, 1, 3, 4, 3, 8, 1, 7, 2, 3, 1, 3],
    [2, 3, 1, 4, 3, 3, 7, 1, 8, 2, 2, 0, 4],
    [3, 2, 0, 3, 4, 2, 8, 1, 7, 3, 2, 1, 3],
    [4, 3, 1, 4, 3, 3, 7, 0, 8, 2, 3, 0, 3],
    [3, 4, 0, 3, 4, 3, 8, 1, 7, 3, 2, 1, 4],
    [2, 3, 1, 4, 3, 4, 7, 1, 8, 2, 3, 0, 3],
  ],
};

// ── Case 05 — Lone Whistleblower ─────────────────────────────────────────────
const CASE_05: CaseStudy = {
  slug: 'case-05-whistleblower',
  title: 'Case 05 — The Lone Whistleblower',
  rows: [
    [8, 8, 0, 8, 8, 8, 2, 0, 2, 8, 8, 0, 8],
    [9, 8, 0, 8, 9, 8, 2, 0, 1, 9, 8, 0, 8],
    [8, 9, 0, 9, 8, 9, 2, 0, 2, 8, 9, 0, 9],
    [8, 8, 0, 8, 8, 8, 3, 0, 2, 8, 8, 0, 8],
    [9, 8, 0, 8, 9, 9, 2, 0, 1, 9, 9, 0, 9],
    [8, 9, 0, 9, 8, 8, 2, 0, 2, 8, 8, 0, 8],
    [8, 8, 0, 8, 8, 8, 3, 0, 2, 8, 8, 0, 8],
    [9, 9, 0, 9, 9, 9, 1, 0, 1, 9, 9, 0, 9],
    [8, 8, 0, 8, 8, 8, 2, 0, 2, 8, 8, 0, 8],
    [1, 2, 1, 2, 1, 2, 9, 1, 9, 1, 1, 1, 1],
  ],
};

// ── Case 06 — Quiet Tension (suppression pattern) ────────────────────────────
const CASE_06: CaseStudy = {
  slug: 'case-06-suppression',
  title: 'Case 06 — Quiet Tension (suppression pattern)',
  rows: [
    [3, 4, 0, 5, 6, 5, 3, 0, 3, 5, 6, 0, 5],
    [5, 4, 0, 6, 6, 6, 3, 0, 4, 6, 5, 0, 6],
    [3, 3, 0, 5, 5, 4, 4, 0, 3, 5, 5, 0, 4],
    [6, 5, 0, 7, 6, 6, 2, 0, 3, 6, 7, 0, 6],
    [4, 4, 0, 5, 5, 5, 4, 0, 4, 5, 5, 0, 5],
    [3, 4, 0, 6, 6, 5, 3, 0, 3, 6, 6, 1, 5],
    [5, 5, 0, 6, 5, 6, 3, 0, 4, 5, 6, 0, 5],
    [4, 3, 0, 5, 5, 5, 4, 0, 3, 5, 5, 0, 4],
    [6, 6, 0, 7, 7, 6, 2, 0, 3, 7, 6, 0, 6],
    [3, 4, 0, 5, 6, 5, 3, 0, 4, 5, 5, 1, 5],
  ],
};

// ── Case 07 — The Manager Question (single-dimension fracture) ───────────────
const CASE_07: CaseStudy = {
  slug: 'case-07-manager',
  title: 'Case 07 — The Manager Question',
  rows: [
    [7, 8, 0, 7, 7, 7, 3, 0, 3, 9, 9, 0, 8],
    [8, 7, 0, 7, 8, 7, 2, 0, 2, 8, 9, 0, 7],
    [7, 7, 0, 8, 7, 8, 3, 0, 3, 9, 8, 0, 7],
    [8, 8, 0, 7, 7, 7, 2, 0, 2, 8, 9, 0, 8],
    [7, 7, 0, 7, 8, 7, 3, 0, 3, 9, 9, 0, 7],
    [8, 7, 0, 7, 7, 8, 3, 0, 2, 9, 8, 0, 7],
    [7, 7, 0, 7, 7, 7, 3, 0, 3, 2, 3, 0, 6],
    [7, 8, 0, 8, 7, 7, 2, 0, 3, 3, 2, 1, 6],
    [8, 7, 0, 7, 8, 7, 3, 0, 3, 2, 3, 0, 6],
    [7, 7, 0, 7, 7, 8, 3, 0, 2, 3, 2, 0, 6],
    [7, 8, 0, 7, 7, 7, 3, 0, 3, 2, 3, 1, 6],
    [8, 7, 0, 8, 7, 7, 2, 0, 3, 3, 2, 0, 6],
  ],
};

// ── Case 08 — Inner Circle / Outer Circle (trust stratification) ─────────────
const CASE_08: CaseStudy = {
  slug: 'case-08-trust',
  title: 'Case 08 — Inner Circle / Outer Circle',
  rows: [
    [7, 7, 0, 9, 9, 8, 3, 0, 2, 7, 7, 0, 8],
    [7, 7, 0, 9, 9, 9, 2, 0, 2, 7, 7, 0, 8],
    [7, 7, 0, 8, 9, 8, 3, 0, 3, 7, 6, 0, 7],
    [6, 7, 0, 9, 8, 9, 2, 0, 2, 7, 7, 0, 8],
    [7, 7, 0, 9, 9, 8, 3, 0, 3, 7, 7, 0, 8],
    [5, 5, 0, 3, 2, 3, 5, 0, 5, 6, 6, 0, 4],
    [5, 6, 0, 2, 3, 2, 5, 0, 5, 6, 6, 0, 5],
    [6, 5, 0, 3, 2, 3, 6, 0, 5, 5, 6, 0, 4],
    [5, 5, 0, 2, 3, 2, 5, 1, 5, 6, 5, 0, 4],
    [6, 6, 0, 3, 2, 3, 5, 0, 5, 6, 6, 0, 5],
  ],
};

// ── Case 09 — Code Red (uniformly bad, escalation-ready) ─────────────────────
const CASE_09: CaseStudy = {
  slug: 'case-09-codered',
  title: 'Case 09 — Code Red',
  rows: [
    [2, 2, 1, 2, 3, 2, 9, 1, 8, 1, 2, 1, 2],
    [3, 2, 1, 3, 2, 2, 8, 1, 9, 2, 1, 1, 3],
    [2, 3, 0, 2, 3, 3, 9, 1, 8, 2, 2, 1, 2],
    [3, 2, 1, 3, 2, 2, 8, 1, 9, 2, 2, 1, 3],
    [2, 3, 1, 2, 3, 3, 9, 1, 8, 1, 2, 0, 2],
    [2, 2, 0, 3, 2, 2, 8, 0, 9, 2, 1, 1, 3],
    [3, 3, 0, 2, 3, 3, 9, 1, 8, 1, 2, 1, 2],
    [2, 2, 1, 3, 2, 2, 8, 1, 9, 2, 2, 0, 3],
  ],
};

// ── Case 10 — Quality Filter Catches a Straightliner ─────────────────────────
// R11 is the straightliner — same value across all 13 numeric items. Quality
// scorer should naturally flag this and set acceptedInAnalysis=false.
const CASE_10: CaseStudy = {
  slug: 'case-10-straightliner',
  title: 'Case 10 — Quality Filter Catches a Straightliner',
  rows: [
    [8, 7, 0, 7, 8, 7, 3, 0, 3, 8, 7, 0, 8],
    [7, 8, 0, 8, 7, 8, 2, 0, 2, 7, 8, 0, 7],
    [8, 8, 0, 7, 8, 7, 3, 0, 3, 8, 8, 0, 8],
    [7, 7, 0, 8, 7, 7, 4, 0, 3, 7, 7, 0, 7],
    [8, 7, 0, 7, 8, 8, 3, 0, 2, 8, 7, 0, 8],
    [7, 8, 0, 8, 7, 7, 3, 0, 3, 7, 8, 0, 7],
    [8, 8, 0, 7, 7, 8, 2, 0, 3, 8, 7, 0, 8],
    [7, 7, 0, 8, 8, 7, 3, 0, 2, 7, 8, 0, 7],
    [8, 7, 0, 7, 7, 8, 4, 0, 3, 8, 7, 0, 8],
    [7, 8, 0, 8, 8, 7, 3, 0, 3, 7, 8, 0, 7],
    [5, 5, 0, 5, 5, 5, 5, 0, 5, 5, 5, 0, 5], // straightliner — boolean cp03/cp08/cp12 also "5" maps to 0/1; we send the booleans as 0 here so the matrix renders sensibly, but the variance over the 10 scale items remains zero so the long-string + low-variance flags fire
  ],
};

const ALL_CASES: CaseStudy[] = [
  CASE_01, CASE_02, CASE_03, CASE_04, CASE_05,
  CASE_06, CASE_07, CASE_08, CASE_09, CASE_10,
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);

  // Resolve org + template once.
  const org = await Organization.findOne({ slug: ORG_SLUG }).setOptions(bypass);
  if (!org) throw new Error(`Organization with slug "${ORG_SLUG}" not found`);

  const template = await SurveyTemplate.findOne({
    instrumentId: PULSE_INSTRUMENT_ID,
    $or: [{ organizationId: org._id }, { isGlobal: true }],
  }).setOptions(bypass);
  if (!template) throw new Error(`Pulse template "${PULSE_INSTRUMENT_ID}" not found for org ${ORG_SLUG}`);

  console.log(`Org: ${org.name} (${org._id})`);
  console.log(`Template: ${template.title} (${template._id})`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (onlyCase) console.log(`Filter: only case ${onlyCase}`);

  // Pick the cases to run.
  const cases = onlyCase
    ? ALL_CASES.filter((c) => c.slug.startsWith(`case-${onlyCase.padStart(2, '0')}`))
    : ALL_CASES;
  if (cases.length === 0) throw new Error(`No case matched --case ${onlyCase}`);

  // Ensure each case's department is on the org's `departments[]`.
  const newDepts = cases.map((c) => c.slug).filter((s) => !org.departments.includes(s));
  if (newDepts.length > 0) {
    console.log(`\nDepartments to add: ${newDepts.join(', ')}`);
    if (apply) {
      org.departments.push(...newDepts);
      await org.save();
    }
  }

  // Per-case: cleanup + insert.
  let totalDeleted = 0;
  let totalInserted = 0;
  let totalDroppedByQuality = 0;

  for (const c of cases) {
    // Cleanup — responses + analyses scoped to (org, dept).
    const respFilter = {
      organizationId: org._id,
      departmentId: c.slug,
    };
    const existing = await SurveyResponse.countDocuments(respFilter).setOptions(bypass);
    const existingAnalyses = await ConflictAnalysis.countDocuments(respFilter).setOptions(bypass);

    if (apply) {
      const r1 = await SurveyResponse.deleteMany(respFilter).setOptions(bypass);
      const r2 = await ConflictAnalysis.deleteMany(respFilter).setOptions(bypass);
      totalDeleted += (r1.deletedCount ?? 0) + (r2.deletedCount ?? 0);
    }

    // Build SurveyResponse documents.
    const docs: Array<Record<string, unknown>> = [];
    let droppedByQuality = 0;

    c.rows.forEach((row, idx) => {
      const responses = QUESTION_IDS.map((qid, i) => {
        const raw = row[i];
        if (BOOLEAN_IDS.has(qid)) return { questionId: qid, value: raw === 1 };
        return { questionId: qid, value: raw };
      });

      // Run the live quality scorer so case 10's straightliner is detected
      // by the actual filter rather than by a manual override.
      const q = computeQuality({ responses } as never, DEFAULT_QUALITY_POLICY);
      if (q.acceptedInAnalysis === false) droppedByQuality++;

      docs.push({
        organizationId: org._id,
        templateId: template._id,
        departmentId: c.slug,
        submissionToken: createHash('sha256')
          .update(`${c.slug}:${idx}:${randomBytes(16).toString('hex')}`)
          .digest('hex'),
        respondentLanguage: 'en',
        responses,
        isAnonymous: true,
        qualityScore: q.qualityScore,
        qualityFlags: q.qualityFlags,
        acceptedInAnalysis: q.acceptedInAnalysis,
      });
    });

    if (apply) {
      await SurveyResponse.insertMany(docs);
      totalInserted += docs.length;
    }
    totalDroppedByQuality += droppedByQuality;

    console.log(
      `${apply ? 'SEEDED' : 'WOULD SEED'}  ${c.slug.padEnd(24)}  ` +
      `${c.rows.length} rows  (existing: ${existing} resp / ${existingAnalyses} analyses)  ` +
      `quality-dropped: ${droppedByQuality}`,
    );
  }

  console.log('\n=== Summary ===');
  console.log(`Cases processed:        ${cases.length}`);
  console.log(`Responses inserted:     ${totalInserted}`);
  console.log(`Records cleaned up:     ${totalDeleted}`);
  console.log(`Quality-dropped (live): ${totalDroppedByQuality}`);
  console.log(apply ? '✓ Applied' : '(dry-run — pass --apply to write)');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

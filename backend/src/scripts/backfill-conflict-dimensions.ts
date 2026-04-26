/**
 * One-off backfill: tag the per-question `dimension` field on every existing
 * Conflict-module SurveyTemplate, using the canonical 10-dimension scheme
 * approved on 2026-04-29 (see docs/design/survey_divergence_and_truth_signals.md).
 *
 * Diagnostic templates (Bi-Weekly Pulse, Quarterly Deep-Dive, Workplace
 * Conflict Q1, Workplace Interview, Psych Safety Pulse Check) get a
 * per-question mapping. Single-construct psychometric instruments (TKI,
 * ROCI-II, HNP, Edmondson, CDP-I, de Dreu) get one dimension applied to
 * every question — except de Dreu, which is split into its three published
 * sub-constructs (Task / Relationship / Process Conflict).
 *
 * Idempotent. Dry-run by default; pass --apply to perform writes.
 *
 *   npx ts-node src/scripts/backfill-conflict-dimensions.ts          # report
 *   npx ts-node src/scripts/backfill-conflict-dimensions.ts --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

// Per-question mapping for the diagnostic-style templates. The key is the
// stable question id (`q.id`) — these are constant across translations.
const PER_QUESTION: Record<string, Record<string, string>> = {
  // Workplace Conflict Assessment Q1 2026
  '69c93dfd653713663e8345d2': {
    q1: 'Communication',
    q2: 'Conflict Frequency / Tension',
    q3: 'Psychological Safety',
    q4: 'Workload & Resources',
    q5: 'Conflict Resolution Skills',
    q6: 'Communication',
    q7: 'Role Clarity',
    q8: 'Management Effectiveness',
  },
  // Conflict Intelligence — Bi-Weekly Pulse Survey
  '69cbb17e199a884b424b1262': {
    cp01: 'Psychological Safety', cp02: 'Psychological Safety', cp03: 'Psychological Safety',
    cp04: 'Communication', cp05: 'Trust', cp06: 'Communication',
    cp07: 'Conflict Frequency / Tension', cp08: 'Conflict Frequency / Tension', cp09: 'Conflict Frequency / Tension',
    cp10: 'Management Effectiveness', cp11: 'Management Effectiveness',
    cp12: 'Escalation Intent', cp13: 'Escalation Intent',
    cp14: 'Wellbeing & Belonging', cp15: 'Wellbeing & Belonging',
  },
  // Conflict Intelligence — Quarterly Deep-Dive Analysis
  '69cbb17f199a884b424b1265': {
    cd01: 'Conflict Resolution Skills', cd02: 'Conflict Resolution Skills', cd03: 'Conflict Resolution Skills', cd04: 'Conflict Resolution Skills',
    cd05: 'Psychological Safety', cd06: 'Psychological Safety', cd07: 'Psychological Safety',
    cd08: 'Conflict Frequency / Tension', cd09: 'Trust', cd10: 'Communication',
    cd11: 'Management Effectiveness', cd12: 'Management Effectiveness', cd13: 'Trust', cd14: 'Escalation Intent',
    cd15: 'Workload & Resources', cd16: 'Workload & Resources', cd17: 'Workload & Resources',
    cd18: 'Conflict Frequency / Tension', cd19: 'Conflict Frequency / Tension',
    cd20: 'Wellbeing & Belonging', cd21: 'Wellbeing & Belonging',
  },
  // Workplace Interview (3 items, custom)
  '69d00db937add852dc388429': {
    q1775242624257_tz29: 'Communication',
    q1775242624257_5txy: 'Conflict Frequency / Tension',
    q1775242624258_9r0x: 'Psychological Safety',
  },
  // Psychological Safety Pulse Check — March 2026 Action Response
  '69e76a303ab2b44cded758e5': {
    q1: 'Psychological Safety',
    q2: 'Escalation Intent', q3: 'Escalation Intent',
    q4: 'Role Clarity',
    q5: 'Trust',
    q6: 'Management Effectiveness',
    q7: 'Conflict Resolution Skills',
    q8: 'Wellbeing & Belonging',
  },
};

// Single-construct psychometric instruments — every question gets the same tag.
const WHOLE_TEMPLATE: Record<string, string> = {
  '69d3a15d717db65c7a12d2d3': 'Conflict Style',          // TKI
  '69d3a189717db65c7a12d2ee': 'Conflict Style',          // ROCI-II
  '69d3a19b717db65c7a12d2f0': 'Conflict Behavior',       // CDP-I
  '69d3a1b1717db65c7a12d2f4': 'Psychological Safety',    // Edmondson
  '69e7acc1bef04befb78961c6': 'Conflict Style',          // HNP
};

// de Dreu Workplace Conflict Questionnaire — split into 3 sub-constructs.
const DE_DREU_ID = '69d3a1a8717db65c7a12d2f2';
const DE_DREU_MAPPING: Record<string, string> = {
  q1: 'Task Conflict', q2: 'Task Conflict', q3: 'Task Conflict', q4: 'Task Conflict',
  q5: 'Relationship Conflict', q6: 'Relationship Conflict', q7: 'Relationship Conflict', q8: 'Relationship Conflict',
  q9: 'Process Conflict', q10: 'Process Conflict', q11: 'Process Conflict',
};

async function run(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  const templates = await SurveyTemplate.find({
    moduleType: 'conflict',
    sourceTemplateId: { $exists: false },
  }).setOptions(bypass);

  let totalChanged = 0, totalUnchanged = 0, totalSkipped = 0;
  for (const t of templates) {
    const id = t._id.toString();
    let changed = 0, unchanged = 0;
    let dimensionFor: (qid: string) => string | undefined;

    if (id === DE_DREU_ID) {
      dimensionFor = (qid) => DE_DREU_MAPPING[qid];
    } else if (WHOLE_TEMPLATE[id]) {
      const tag = WHOLE_TEMPLATE[id];
      dimensionFor = () => tag;
    } else if (PER_QUESTION[id]) {
      const map = PER_QUESTION[id];
      dimensionFor = (qid) => map[qid];
    } else {
      console.log(`  SKIP   ${t.title}  [${id}]  — no mapping in script`);
      totalSkipped++;
      continue;
    }

    for (const q of t.questions) {
      const want = dimensionFor(q.id);
      if (!want) continue; // question id not in mapping
      if (q.dimension === want) { unchanged++; continue; }
      q.dimension = want;
      changed++;
    }

    if (changed > 0 && apply) {
      t.markModified('questions');
      await t.save();
    }

    console.log(`  ${changed > 0 ? (apply ? 'WRITE ' : 'WOULD ') : 'OK    '} ${t.title}  [${id}]  changed=${changed} unchanged=${unchanged}`);
    totalChanged += changed;
    totalUnchanged += unchanged;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Templates examined : ${templates.length}`);
  console.log(`  Templates skipped  : ${totalSkipped}`);
  console.log(`  Questions changed  : ${totalChanged}`);
  console.log(`  Questions OK       : ${totalUnchanged}`);
  console.log(`─────────────────────────────────────`);
  if (!apply) console.log(`\nDry-run only. Re-run with --apply to perform writes.`);

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

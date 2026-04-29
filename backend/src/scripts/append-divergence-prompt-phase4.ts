/**
 * Phase 4 migration: append stuck-team / collective-inertia guidance to the
 * 3 conflict templates.
 *
 * Phase 4 teaches the model that high alignment ≠ team health. When most
 * dimension means cluster in the mid-range AND rwg is high AND no fracture
 * or minority-voice signals dominate, the team is STUCK (CASE02 pattern) —
 * a different intervention shape from polarisation, fracture, or singleton
 * outliers. Without this guidance the model reads CASE02 as Low risk
 * because no acute conflict surfaces; the spec calls for Medium because
 * sustained mediocrity warrants intervention.
 *
 * Idempotent — looks for the START_MARKER and skips if already applied.
 *
 *   npx ts-node src/scripts/append-divergence-prompt-phase4.ts          # dry-run
 *   npx ts-node src/scripts/append-divergence-prompt-phase4.ts --show   # print current prompts
 *   npx ts-node src/scripts/append-divergence-prompt-phase4.ts --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

const START_MARKER = 'Stuck-team / collective-inertia pattern';

const APPENDIX = `

Divergence-aware analysis (Phase 4 — added 2026-04-29):

Stuck-team / collective-inertia pattern.

High alignment is NOT the same as team health. When most dimension means cluster in the mid-range of the scale (typically 4-6 on a 1-10 scale) AND rwg is high (≥0.7) across dimensions AND no fracture or minority-voice signals dominate the data, the team is not in conflict — it is STUCK. The team agrees uniformly that things are mediocre. This is the CASE02 pattern: aligned, but stagnant.

Distinguish three superficially similar headlines:
- HIGH rwg + HIGH means (≥7): healthy, aligned team. Low risk.
- HIGH rwg + LOW means (≤3): aligned-low, escalation-ready. High or Critical risk (CASE09 pattern).
- HIGH rwg + MID means (4-6): stuck, not fractured. Medium risk (CASE02 pattern). The interventions are completely different from the other two.

In the stuck-team pattern:
- conflictTypes should reach for process-oriented labels: "Collective Inertia", "Workload Stagnation", "Decision-Velocity Gap", "Process Drift", "Engagement Plateau", "Unrewarding Work Pattern". Never "Fractured", "Polarised", "Bimodal Split", or "Subgroup Divide" — those vocabularies belong to low-rwg patterns, not aligned-mediocre ones.
- The AI Narrative should name "stuck, not fractured" explicitly. Distinguish polarisation (low rwg, real disagreement) from stagnation (high rwg, agreed-upon mediocrity) — surfacing this distinction is the analytic value-add for this pattern.
- Manager Script proposes WORKLOAD / PROCESS / DECISION-CADENCE / CLARITY-OF-PRIORITIES interventions, not relational ones. Open-ended questions probe what's slowing the team down or making the work feel unrewarding, not what's causing tension between people. Useful prompts: "What would make the work feel more meaningful?", "Where do decisions get stuck?", "What process is overdue for a refresh?".
- Risk score lands in Medium (31-55) when the stuck pattern persists. Sustained mediocrity erodes engagement and accelerates attrition even without acute conflict — it warrants intervention even when the headline alignment score is high.

When this pattern co-exists with a separate minority-voice signal (e.g. one or two boolean responses flagging concern on a single item), surface BOTH framings: the team is mostly stuck, AND a minority is reporting something specific that warrants follow-up via aggregate channels. Do not let either framing erase the other.`;

const TEMPLATE_IDS = [
  '69cbb17e199a884b424b1262', // Bi-Weekly Pulse
  '69cbb17f199a884b424b1265', // Quarterly Deep-Dive
  '69e7acc1bef04befb78961c6', // HNP
];

async function show(): Promise<void> {
  for (const id of TEMPLATE_IDS) {
    const t = await SurveyTemplate.findById(id).setOptions(bypass);
    if (!t) { console.log(`MISSING ${id}\n`); continue; }
    const len = t.analysisPrompt?.length ?? 0;
    const phase1 = t.analysisPrompt?.includes('Divergence-aware analysis (Phase 1') ? '✓' : '✗';
    const phase2 = t.analysisPrompt?.includes('Singleton outlier vs structural split') ? '✓' : '✗';
    const phase3 = t.analysisPrompt?.includes('Quality-filter signals — interpret without speculation') ? '✓' : '✗';
    const phase4 = t.analysisPrompt?.includes(START_MARKER) ? '✓' : '✗';
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Template:   ${t.title}`);
    console.log(`ID:         ${id}`);
    console.log(`Length:     ${len} chars`);
    console.log(`Phase 1:    ${phase1}`);
    console.log(`Phase 2:    ${phase2}`);
    console.log(`Phase 3:    ${phase3}`);
    console.log(`Phase 4:    ${phase4}`);
    console.log(`─── analysisPrompt (last 1000 chars) ───`);
    console.log((t.analysisPrompt || '').slice(-1000));
    console.log('');
  }
}

async function migrate(apply: boolean): Promise<void> {
  let updated = 0, skipped = 0;
  for (const id of TEMPLATE_IDS) {
    const t = await SurveyTemplate.findById(id).setOptions(bypass);
    if (!t) { console.log(`  MISSING ${id}`); continue; }

    if (!t.analysisPrompt || !t.analysisPrompt.trim()) {
      console.log(`  SKIP    ${t.title}  — no existing analysisPrompt to extend`);
      skipped++;
      continue;
    }
    if (t.analysisPrompt.includes(START_MARKER)) {
      console.log(`  ALREADY ${t.title}  — Phase 4 appendix already present`);
      skipped++;
      continue;
    }

    const oldLen = t.analysisPrompt.length;
    const newPrompt = t.analysisPrompt.replace(/\s+$/u, '') + APPENDIX;
    const newLen = newPrompt.length;

    if (apply) {
      t.analysisPrompt = newPrompt;
      await t.save();
      console.log(`  WRITE   ${t.title}  ${oldLen} → ${newLen} chars  (+${newLen - oldLen})`);
    } else {
      console.log(`  WOULD   ${t.title}  ${oldLen} → ${newLen} chars  (+${newLen - oldLen})`);
    }
    updated++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Templates ${apply ? 'updated' : 'would update'} : ${updated}`);
  console.log(`  Templates skipped               : ${skipped}`);
  console.log(`─────────────────────────────────────`);
  if (!apply) console.log(`\nDry-run only. Re-run with --apply to perform writes.`);
}

async function run(): Promise<void> {
  const mode = process.argv.includes('--show')
    ? 'show'
    : process.argv.includes('--apply') ? 'apply' : 'dry';
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — mode: ${mode.toUpperCase()}\n`);

  if (mode === 'show') await show();
  else await migrate(mode === 'apply');

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

/**
 * Phase 3 migration: append guidance on the new trap-item and correlated-pair
 * quality signals to the 3 conflict templates.
 *
 * Phase 3 (in code) added two quality-filter checks that surface as flag
 * keys inside QUALITY → droppedReasons:
 *   - trapFailed  — respondent answered an embedded attention-check item
 *                   incorrectly
 *   - inconsistent — respondent contradicted themselves on a correlated
 *                    item pair
 *
 * The system prompt now needs to teach the model what these flags mean,
 * how to acknowledge them in narrative, and where the ethical limits lie
 * (population-level filter, never individual accusation).
 *
 * Idempotent — looks for the START_MARKER and skips if already applied.
 *
 *   npx ts-node src/scripts/append-divergence-prompt-phase3.ts          # dry-run
 *   npx ts-node src/scripts/append-divergence-prompt-phase3.ts --show   # print current prompts
 *   npx ts-node src/scripts/append-divergence-prompt-phase3.ts --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

const START_MARKER = 'Quality-filter signals — interpret without speculation';

const APPENDIX = `

Divergence-aware analysis (Phase 3 — added 2026-04-29):

Quality-filter signals — interpret without speculation.

The QUALITY block reports per-response quality flags applied BEFORE aggregation. Flagged responses are excluded from the analysis; the dimension means, per-item metrics, and subgroup detection you receive run only on accepted respondents.

The droppedReasons object may include any of:
- straightlining — respondent answered identically across too many items
- longString — long unbroken run of identical answers
- lengthBias — total response time outside plausible bounds
- careless — composite low-effort signal
- trapFailed — failed an embedded attention-check item (a "trap" with a known correct answer)
- inconsistent — answered contradictorily on a correlated item pair

When droppedCount is non-zero:
- Briefly acknowledge the filter worked (e.g. "After excluding N responses flagged for inconsistency, X responses were aggregated"). Do NOT name specific respondents — the filter is a population-level safeguard, not an individual diagnosis.
- A high trapFailed or inconsistent share (>15% of submitted) may signal survey fatigue, low engagement, or distrust of the instrument. Surface as a META-observation worth noting alongside the substantive findings — never as an accusation.
- Do NOT use dropped-response counts to diminish the credibility of the substantive findings. The accepted set is the trustworthy data, and it stands on its own.

When droppedCount is zero, no quality concerns surfaced — proceed without commentary on quality.`;

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
    const phase3 = t.analysisPrompt?.includes(START_MARKER) ? '✓' : '✗';
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Template:   ${t.title}`);
    console.log(`ID:         ${id}`);
    console.log(`Length:     ${len} chars`);
    console.log(`Phase 1:    ${phase1}`);
    console.log(`Phase 2:    ${phase2}`);
    console.log(`Phase 3:    ${phase3}`);
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
      console.log(`  ALREADY ${t.title}  — Phase 3 appendix already present`);
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

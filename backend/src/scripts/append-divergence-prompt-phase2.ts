/**
 * Phase 2 migration: append minority-voice / singleton-outlier guidance to the
 * 3 conflict templates that already carry the Phase 1 divergence appendix.
 *
 * Phase 1 taught the model how to read the divergence data blocks. Phase 2
 * teaches it the difference between a STRUCTURAL fracture (subgroup detector
 * fired) and a MINORITY VOICE / singleton outlier (subgroup detector did not
 * fire despite high item-level bimodality — Condorcet / Aumann case).
 *
 * Idempotent — looks for the START_MARKER and skips if already applied.
 *
 *   npx ts-node src/scripts/append-divergence-prompt-phase2.ts          # dry-run
 *   npx ts-node src/scripts/append-divergence-prompt-phase2.ts --show   # print current prompts
 *   npx ts-node src/scripts/append-divergence-prompt-phase2.ts --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

const START_MARKER = 'Singleton outlier vs structural split';

const TEAM_LEVEL_APPENDIX = `

Divergence-aware analysis (Phase 2 — added 2026-04-29):

Singleton outlier vs structural split — distinguish two superficially similar patterns.

The USER message will include a SUBGROUP STRUCTURE block. Read it carefully:

- "N distinct response patterns detected" — the subgroup detector fired. A real STRUCTURAL split has emerged along measurable lines (role, shift, tenure, recent events). Use the Phase 1 guidance — name the dimensions of fracture and propose interest-based interventions that respect each cluster's experience.

- "Subgroup detector ran but did NOT fire" — high item-level bimodality WITHOUT coherent subgroup structure. This is the Condorcet / Aumann minority-voice signature: one or a few respondents are reporting a markedly different reality from an otherwise aligned majority. It is NOT a structural split.

In the minority-voice case, do NOT use fracture, split, polarised, subgroup, bimodal-split, divided, or factional framing — neither in the AI Narrative nor in conflictTypes. Frame the pattern as a minority signal: a singleton or small group is surfacing a concern the majority has not yet acknowledged. The minority reading may be more accurate than the majority. The role of the analysis is to lift the dissenting signal to the team's attention as DATA, never as accusation.

In conflictTypes, prefer labels like "Minority voice signal", "Outlier safety concern", or "Unsurfaced grievance". Avoid "Bimodal Split", "Polarised Experience", "Subgroup-Level Divide", or "Fractured Team Experience" in this case.

In the Manager Script and Recommended Actions, propose AGGREGATE channels — anonymous follow-up surveys, skip-level conversations, ombudsperson access, exit interviews, town-hall listening sessions — never anything that would risk identifying the dissenting respondent. The defining ethical boundary of this case is non-identification.

Risk scoring in the minority-voice case follows the MAGNITUDE of the signal, not the proportion. A single respondent reporting witnessed unsafe behaviour, an unresolved conflict affecting their job, or imminent intent to escalate is a high-priority finding regardless of how many others report things are fine. Calibrate riskScore by what the minority is reporting, not by how rare the report is within the team.`;

const HNP_APPENDIX = `

Divergence-aware analysis (Phase 2 — added 2026-04-29):

Singleton outlier vs structural split in conflict-handling profile.

When SUBGROUP STRUCTURE is reported as detected, the team's collective profile has fractured along measurable lines — one cluster of collaborators alongside one of avoiders, for example. Phase 1 guidance applies.

When SUBGROUP STRUCTURE reports the detector did NOT fire despite high item-level bimodality, one team member's conflict-handling style is markedly different from an otherwise aligned majority — a single competitive personality in a collaborative team, or vice versa. Do NOT call this a structural team split. Frame it as an individual style outlier within an aligned team. Recommendations should focus on whether the outlier's style is constructive friction or a coordination cost — and propose coaching for the individual style alongside team-level facilitation, never identification.`;

const TEMPLATES: Array<{ id: string; appendix: string }> = [
  { id: '69cbb17e199a884b424b1262', appendix: TEAM_LEVEL_APPENDIX }, // Bi-Weekly Pulse
  { id: '69cbb17f199a884b424b1265', appendix: TEAM_LEVEL_APPENDIX }, // Quarterly Deep-Dive
  { id: '69e7acc1bef04befb78961c6', appendix: HNP_APPENDIX },        // HNP
];

async function show(): Promise<void> {
  for (const { id } of TEMPLATES) {
    const t = await SurveyTemplate.findById(id).setOptions(bypass);
    if (!t) { console.log(`MISSING ${id}\n`); continue; }
    const len = t.analysisPrompt?.length ?? 0;
    const phase1 = t.analysisPrompt?.includes('Divergence-aware analysis (Phase 1') ? '✓' : '✗';
    const phase2 = t.analysisPrompt?.includes(START_MARKER) ? '✓' : '✗';
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Template:   ${t.title}`);
    console.log(`ID:         ${id}`);
    console.log(`Length:     ${len} chars`);
    console.log(`Phase 1:    ${phase1}`);
    console.log(`Phase 2:    ${phase2}`);
    console.log(`─── analysisPrompt ───`);
    console.log(t.analysisPrompt || '(empty)');
    console.log('');
  }
}

async function migrate(apply: boolean): Promise<void> {
  let updated = 0, skipped = 0;
  for (const { id, appendix } of TEMPLATES) {
    const t = await SurveyTemplate.findById(id).setOptions(bypass);
    if (!t) { console.log(`  MISSING ${id}`); continue; }

    if (!t.analysisPrompt || !t.analysisPrompt.trim()) {
      console.log(`  SKIP    ${t.title}  — no existing analysisPrompt to extend`);
      skipped++;
      continue;
    }
    if (t.analysisPrompt.includes(START_MARKER)) {
      console.log(`  ALREADY ${t.title}  — Phase 2 appendix already present`);
      skipped++;
      continue;
    }

    const oldLen = t.analysisPrompt.length;
    const newPrompt = t.analysisPrompt.replace(/\s+$/u, '') + appendix;
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

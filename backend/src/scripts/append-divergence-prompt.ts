/**
 * One-off migration: append a divergence-aware analysis paragraph to the
 * 3 conflict templates that carry custom analysisPrompt overrides
 * (Bi-Weekly Pulse, Quarterly Deep-Dive, HNP). This makes each template's
 * SYSTEM prompt aware of the new QUALITY / PER-ITEM / DIMENSIONAL data blocks
 * the USER message now carries.
 *
 * Idempotent — looks for the START_MARKER in the existing prompt and skips
 * if already present. Dry-run by default; pass --apply to perform writes.
 *
 *   npx ts-node src/scripts/append-divergence-prompt.ts          # report
 *   npx ts-node src/scripts/append-divergence-prompt.ts --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';

const bypass = { bypassTenantCheck: true };

const START_MARKER = 'Divergence-aware analysis';

const TEAM_LEVEL_APPENDIX = `

Divergence-aware analysis (Phase 1 — added 2026-04-29):

The USER message you receive may include three additional data blocks: QUALITY (per-response quality summary), PER-ITEM DIVERGENCE (top items by within-group disagreement), and DIMENSIONAL DIVERGENCE (per-dimension agreement scores using the James-Demaree-Wolf rwg statistic).

When these blocks are present:
- Treat divergence as STRUCTURAL signal about how cohesively the team is experiencing the workplace, NOT as evidence of individual dysfunction. Two people answering very differently are reporting different lived experiences, not different truths.
- In the AI Narrative, name the structure of disagreement explicitly: which dimensions are aligned vs. fractured, and which specific items show the strongest split (bimodality > 0.555). A split team needs a different intervention than a uniformly-low team — surface that distinction.
- A high mean with low rwg ("the average is fine, but agreement is poor") is a stronger signal than the headline mean alone. Possible drivers include role, shift, tenure, team membership, or recent events. Suggest exploration, not attribution.
- In the Manager Script, propose interest-based questions designed to surface the structural drivers of divergence (e.g. "I notice we're not all seeing this the same way — what might be making the experience different across the team?"). Never propose questions that try to identify which respondent gave which answer.
- In Conflict Types and Recommended Actions, name structural patterns ("Role-based experience gap on Communication", "Shift-based disagreement on Workload") rather than personalising.

Minority voices in a divergent dataset frequently reflect truth the majority has not yet acknowledged. Within the Third Side framework, your job is to lift the dissenting signal to the team's attention as data, not as accusation.`;

const HNP_APPENDIX = `

Divergence-aware analysis (Phase 1 — added 2026-04-29):

This instrument is designed to profile an individual's conflict-handling style. When the analysis runs across multiple respondents (a team's collective HNP profile), the USER message will include PER-ITEM DIVERGENCE and DIMENSIONAL DIVERGENCE blocks summarising agreement across the group.

When those blocks are present:
- Frame the output as a TEAM-level conflict-handling profile rather than an individual one. Dimension scores describe the team's collective tendency.
- Where a dimension shows low agreement (rwg < 0.5), name the spread explicitly — "team members differ markedly in their approach to {dimension}; some lean toward {mode}, others toward {mode}". This is high-value coaching signal.
- Items flagged as split (bimodality > 0.555) often reveal mixed conflict-handling styles co-existing in the same team. Surface the collaboration implication.
- Recommendations should acknowledge the team's range, not assume one default mode applies to everyone.

When divergence blocks are absent (single-respondent run), treat the assessment as an individual profile per the existing instructions above.`;

const TEMPLATES: Array<{ id: string; appendix: string }> = [
  { id: '69cbb17e199a884b424b1262', appendix: TEAM_LEVEL_APPENDIX }, // Bi-Weekly Pulse
  { id: '69cbb17f199a884b424b1265', appendix: TEAM_LEVEL_APPENDIX }, // Quarterly Deep-Dive
  { id: '69e7acc1bef04befb78961c6', appendix: HNP_APPENDIX },        // HNP
];

async function run(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

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
      console.log(`  ALREADY ${t.title}  — divergence appendix already present`);
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

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

/**
 * One-off migration: set the analysisPrompt on the four external conflict
 * instruments (TKI, ROCI-II, CDP-I, PSS-Edmondson). Until now they used the
 * default system prompt; this script applies the framework-specific prompts
 * defined in external-instrument-prompts.ts.
 *
 * Looks up templates by instrumentId (the API-seeded canonical id), so this
 * works regardless of which environment we're in.
 *
 * Idempotent: running with the prompt already in place is reported as ALREADY
 * and writes nothing. Re-runs after edits to the prompt strings will overwrite
 * the existing analysisPrompt with the latest version.
 *
 *   npx ts-node src/scripts/set-external-instrument-prompts.ts          # dry-run report
 *   npx ts-node src/scripts/set-external-instrument-prompts.ts --apply  # write
 *
 * On the server, after `npm run build`:
 *   node dist/scripts/set-external-instrument-prompts.js          # dry-run
 *   node dist/scripts/set-external-instrument-prompts.js --apply  # write
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { EXTERNAL_INSTRUMENT_PROMPTS } from './external-instrument-prompts';

const bypass = { bypassTenantCheck: true };

async function run(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  let updated = 0, unchanged = 0, missing = 0;

  for (const [instrumentId, newPrompt] of Object.entries(EXTERNAL_INSTRUMENT_PROMPTS)) {
    const t = await SurveyTemplate.findOne({ instrumentId, isGlobal: true }).setOptions(bypass);

    if (!t) {
      console.log(`  MISSING  [${instrumentId}]  — no global template found`);
      missing++;
      continue;
    }

    const oldLen = (t.analysisPrompt || '').length;
    const newLen = newPrompt.length;

    if (t.analysisPrompt === newPrompt) {
      console.log(`  ALREADY  [${instrumentId}]  ${t.title}  (${newLen} chars — already current)`);
      unchanged++;
      continue;
    }

    if (apply) {
      t.analysisPrompt = newPrompt;
      await t.save();
      console.log(`  WRITE    [${instrumentId}]  ${t.title}  ${oldLen} → ${newLen} chars`);
    } else {
      console.log(`  WOULD    [${instrumentId}]  ${t.title}  ${oldLen} → ${newLen} chars`);
    }
    updated++;
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Templates ${apply ? 'updated' : 'would update'}  : ${updated}`);
  console.log(`  Templates already current        : ${unchanged}`);
  console.log(`  Templates missing                : ${missing}`);
  console.log(`─────────────────────────────────────`);
  if (!apply) console.log(`\nDry-run only. Re-run with --apply to perform writes.`);

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

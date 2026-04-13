/**
 * One-off migration: convert legacy free-text Sponsor.billingAddress
 * (string) into the new structured object { line1, ..., country }.
 *
 * Idempotent — sponsors that already have a structured address (object
 * with a 'line1' key) are skipped. Sponsors with a string get its full
 * value placed into `line1`; the rest of the structured fields stay
 * undefined and can be filled in later via the sponsor-edit dialog.
 *
 * Run on the server after build:
 *   node dist/scripts/migrate-sponsor-address.js
 */

import mongoose from 'mongoose';
import { config } from '../config/env';

async function run(): Promise<void> {
  console.log(`[migrate] Connecting to ${config.mongoUri.replace(/:[^:@]+@/, ':****@')}`);
  await mongoose.connect(config.mongoUri);

  const Sponsor = mongoose.connection.collection('sponsors');
  const cursor = Sponsor.find({ billingAddress: { $type: 'string' } });

  let scanned = 0, converted = 0;
  while (await cursor.hasNext()) {
    const s = await cursor.next();
    if (!s) continue;
    scanned++;
    const text = (s['billingAddress'] as string).trim();
    if (!text) {
      await Sponsor.updateOne({ _id: s._id }, { $unset: { billingAddress: '' } });
      continue;
    }
    await Sponsor.updateOne(
      { _id: s._id },
      { $set: { billingAddress: { line1: text } } },
    );
    converted++;
  }

  console.log('[migrate] Done.');
  console.log(`  scanned:   ${scanned}`);
  console.log(`  converted: ${converted}`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error('[migrate] failed:', err); process.exit(1); });

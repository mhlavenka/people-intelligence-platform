/**
 * One-off backfill: populate ICF-required fields on existing CoachingSession
 * documents.
 *
 *   clientType  → 'individual'   (default; coach can re-tag team/group later)
 *   paidStatus  → 'paid'         when the parent engagement has billingMode
 *                                 = 'sponsor' OR hourlyRate > 0
 *               → 'pro_bono'     otherwise
 *
 * Safe to re-run — only updates rows missing the field.
 *
 *   npm run backfill:sessionIcfFields
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { CoachingSession } from '../models/CoachingSession.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';

const bypass = { bypassTenantCheck: true };

async function run(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // 1. clientType: default 'individual' for any row missing it
  const clientTypeResult = await CoachingSession.updateMany(
    { clientType: { $exists: false } },
    { $set: { clientType: 'individual' } },
  ).setOptions(bypass);
  console.log(`  clientType backfill → ${clientTypeResult.modifiedCount} session(s)`);

  // 2. paidStatus: derive from parent engagement
  const sessionsMissingPaid = await CoachingSession
    .find({ paidStatus: { $exists: false } })
    .select('_id engagementId')
    .setOptions(bypass)
    .lean();

  console.log(`  Found ${sessionsMissingPaid.length} session(s) missing paidStatus`);

  const engagementIds = [...new Set(sessionsMissingPaid.map((s) => String(s.engagementId)))];
  const engagements = await CoachingEngagement
    .find({ _id: { $in: engagementIds } })
    .select('_id billingMode hourlyRate')
    .setOptions(bypass)
    .lean();

  const engagementMap = new Map<string, { billingMode?: string; hourlyRate?: number }>();
  for (const e of engagements) {
    engagementMap.set(String(e._id), { billingMode: (e as any).billingMode, hourlyRate: (e as any).hourlyRate });
  }

  let paidCount = 0;
  let proBonoCount = 0;
  for (const session of sessionsMissingPaid) {
    const eng = engagementMap.get(String(session.engagementId));
    const isPaid = !!eng && (eng.billingMode === 'sponsor' || (eng.hourlyRate ?? 0) > 0);
    const paidStatus = isPaid ? 'paid' : 'pro_bono';
    await CoachingSession.updateOne(
      { _id: session._id },
      { $set: { paidStatus } },
    ).setOptions(bypass);
    if (isPaid) paidCount++; else proBonoCount++;
  }

  console.log(`  paidStatus backfill → paid=${paidCount}, pro_bono=${proBonoCount}`);

  console.log(`\n─────────────────────────────────────`);
  console.log(`  Backfill complete`);
  console.log(`─────────────────────────────────────\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

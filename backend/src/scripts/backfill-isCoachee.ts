/**
 * One-off backfill: set User.isCoachee = true for every user who is either
 *   (a) already role='coachee' (legacy external coachees), or
 *   (b) referenced as coacheeId on any CoachingEngagement (internal users
 *       who are also being coached).
 *
 * Safe to re-run — idempotent.
 *
 *   npm run backfill:isCoachee
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';

const bypass = { bypassTenantCheck: true };

async function run(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // (a) Legacy external coachees
  const roleResult = await User.updateMany(
    { role: 'coachee', isCoachee: { $ne: true } },
    { $set: { isCoachee: true } },
  ).setOptions(bypass);
  console.log(`  role='coachee' → flagged ${roleResult.modifiedCount} user(s)`);

  // (b) Users with any engagement
  const engagementCoacheeIds = await CoachingEngagement.distinct('coacheeId')
    .setOptions(bypass);
  const engagementResult = await User.updateMany(
    { _id: { $in: engagementCoacheeIds }, isCoachee: { $ne: true } },
    { $set: { isCoachee: true } },
  ).setOptions(bypass);
  console.log(`  with engagement → flagged ${engagementResult.modifiedCount} user(s)`);

  const total = await User.countDocuments({ isCoachee: true }).setOptions(bypass);
  console.log(`\n─────────────────────────────────────`);
  console.log(`  Total users with isCoachee=true: ${total}`);
  console.log(`─────────────────────────────────────\n`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-off backfill: reclassify legacy `role='coachee'` users who have NEVER
 * been part of a CoachingEngagement as `role='employee', isCoachee=false`.
 * These were likely created before the 'employee' role existed and got
 * misclassified as coachees, which excludes them from the org chart.
 *
 * Users who ARE referenced on a CoachingEngagement keep `role='coachee'`
 * (intent: actual external coaching client).
 *
 * Dry-run by default; pass --apply to perform writes. Idempotent.
 * Optional --org <name-or-slug> scopes the run to a single organization.
 *
 *   npx ts-node src/scripts/backfill-employee-role.ts                          # report all orgs
 *   npx ts-node src/scripts/backfill-employee-role.ts --org "Helena Coaching"  # dry-run, scoped
 *   npx ts-node src/scripts/backfill-employee-role.ts --org helena-coaching --apply
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User.model';
import { Organization } from '../models/Organization.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';

const bypass = { bypassTenantCheck: true };

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i < process.argv.length - 1 ? process.argv[i + 1] : null;
}

async function run(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const orgArg = argValue('--org');
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB — mode: ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  let orgFilter: Record<string, unknown> = {};
  if (orgArg) {
    const escaped = orgArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const org = await Organization.findOne({
      $or: [
        { name: { $regex: `^${escaped}$`, $options: 'i' } },
        { slug: { $regex: `^${escaped}$`, $options: 'i' } },
      ],
    }).setOptions(bypass);
    if (!org) {
      console.error(`Organization not found: "${orgArg}"`);
      await mongoose.disconnect();
      process.exit(1);
    }
    orgFilter = { organizationId: org._id };
    console.log(`Scoped to org: ${org.name} (${org._id})\n`);
  }

  const coachees = await User.find({ ...orgFilter, role: 'coachee' })
    .select('_id email firstName lastName organizationId isCoachee')
    .setOptions(bypass);

  const engagementCoacheeIds = new Set(
    (await CoachingEngagement.distinct('coacheeId', orgFilter).setOptions(bypass))
      .map((id) => String(id)),
  );

  const candidates = coachees.filter((u) => !engagementCoacheeIds.has(String(u._id)));

  console.log(`role='coachee' total            : ${coachees.length}`);
  console.log(`with any CoachingEngagement     : ${coachees.length - candidates.length} (kept as coachee)`);
  console.log(`with no engagement (candidates) : ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('\nNothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  for (const u of candidates.slice(0, 25)) {
    console.log(`  → ${u.email}  (${u.firstName} ${u.lastName})  org=${u.organizationId}`);
  }
  if (candidates.length > 25) console.log(`  ... and ${candidates.length - 25} more`);

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to perform the migration.');
    await mongoose.disconnect();
    return;
  }

  const ids = candidates.map((u) => u._id);
  const result = await User.updateMany(
    { _id: { $in: ids } },
    { $set: { role: 'employee', isCoachee: false } },
  ).setOptions(bypass);
  console.log(`\nUpdated ${result.modifiedCount} user(s) → role='employee', isCoachee=false`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });

/**
 * One-off: ensure the "Kahnawake Education Centre" sponsor exists in the
 * helena-coaching org, then set sponsorId on every coachee whose email ends
 * with @kecedu.ca.
 *
 * Idempotent: re-running is a no-op (sponsor is upserted by email;
 * User.sponsorId is only updated where it isn't already pointing at the
 * correct sponsor).
 *
 * Run (server): node dist/scripts/link-kec-sponsor.js
 */
import mongoose from 'mongoose';
import { config } from '../config/env';
import { Organization } from '../models/Organization.model';
import { Sponsor } from '../models/Sponsor.model';
import { User } from '../models/User.model';

const ORG_SLUG = 'helena-coaching';
const SPONSOR_NAME = 'Kahnawake Education Centre';
const SPONSOR_EMAIL = 'info@kecedu.ca';
const EMAIL_DOMAIN_SUFFIX = '@kecedu.ca';

async function run(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  const org = await Organization.findOne({ slug: ORG_SLUG }).setOptions({ bypassTenantCheck: true });
  if (!org) {
    console.error(`[link] Organization "${ORG_SLUG}" not found. Aborting.`);
    process.exit(1);
  }
  console.log(`[link] Target org: ${org.name} (${org._id})`);

  // Upsert the sponsor (unique per org on email)
  let sponsor = await Sponsor.findOne({ organizationId: org._id, email: SPONSOR_EMAIL })
    .setOptions({ bypassTenantCheck: true });
  if (sponsor) {
    console.log(`[link] Sponsor exists: ${sponsor.name} (${sponsor._id})`);
  } else {
    sponsor = await Sponsor.create({
      organizationId: org._id,
      name: SPONSOR_NAME,
      email: SPONSOR_EMAIL,
    });
    console.log(`[link] Sponsor created: ${sponsor.name} (${sponsor._id})`);
  }

  // Match coachees by email suffix (case-insensitive) in this org only.
  const suffixRegex = new RegExp(`${EMAIL_DOMAIN_SUFFIX.replace('.', '\\.')}$`, 'i');
  const coachees = await User.find({
    organizationId: org._id,
    role: 'coachee',
    email: suffixRegex,
  }).setOptions({ bypassTenantCheck: true });

  console.log(`[link] Found ${coachees.length} coachees with emails ending in ${EMAIL_DOMAIN_SUFFIX}`);

  let updated = 0;
  let unchanged = 0;
  for (const u of coachees) {
    if (u.sponsorId && u.sponsorId.toString() === sponsor._id!.toString()) {
      console.log(`[skip]    ${u.email} — already linked`);
      unchanged++;
      continue;
    }
    u.sponsorId = sponsor._id as mongoose.Types.ObjectId;
    await u.save();
    console.log(`[linked]  ${u.email}`);
    updated++;
  }

  console.log('\n─── Summary ───');
  console.log(`sponsor id: ${sponsor._id}`);
  console.log(`coachees found:  ${coachees.length}`);
  console.log(`linked now:      ${updated}`);
  console.log(`already linked:  ${unchanged}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

/**
 * One-off migration: convert legacy CoachingEngagement.sponsorName/Email/Org
 * + rebillCoachee fields into Sponsor records and link engagement.sponsorId.
 *
 * Rules:
 *   1. If the engagement has sponsorName/sponsorEmail -> find or create a
 *      Sponsor (matched by org+email when email present, by org+name otherwise)
 *      and link it. billingMode='sponsor'.
 *   2. Else if rebillCoachee was true -> create a self-pay Sponsor from the
 *      coachee's User and link it. billingMode='sponsor'.
 *   3. Else -> billingMode='subscription', sponsorId=null. (Org's plan covers it.)
 *
 * Idempotent: re-runs are safe — sponsors found by (orgId, email) are reused.
 *
 * Run locally with ts-node:
 *   npx ts-node --project tsconfig.json src/scripts/migrate-sponsors.ts
 * On the server (after build):
 *   node dist/scripts/migrate-sponsors.js
 */

import mongoose from 'mongoose';
import { config } from '../config/env';
import { Sponsor } from '../models/Sponsor.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { User } from '../models/User.model';

interface LegacyEngagement {
  _id: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  sponsorName?: string;
  sponsorEmail?: string;
  sponsorOrg?: string;
  rebillCoachee?: boolean;
  sponsorId?: mongoose.Types.ObjectId | null;
  billingMode?: string;
}

async function run(): Promise<void> {
  console.log(`[migrate] Connecting to ${config.mongoUri.replace(/:[^:@]+@/, ':****@')}`);
  await mongoose.connect(config.mongoUri);

  // Read raw — bypass any tenant filter and grab the legacy fields even
  // though they're no longer in the TypeScript schema.
  const Engagement = mongoose.connection.collection('coachingengagements');
  const cursor = Engagement.find({}, { projection: {
    organizationId: 1, coacheeId: 1,
    sponsorName: 1, sponsorEmail: 1, sponsorOrg: 1,
    rebillCoachee: 1, sponsorId: 1, billingMode: 1,
  } });

  let scanned = 0, linkedExisting = 0, sponsorBacked = 0, selfPay = 0, subscription = 0;
  const sponsorsCreated = new Set<string>();

  while (await cursor.hasNext()) {
    const eng = (await cursor.next()) as unknown as LegacyEngagement;
    if (!eng) continue;
    scanned++;

    if (eng.sponsorId && eng.billingMode) { linkedExisting++; continue; } // already migrated

    let sponsorId: mongoose.Types.ObjectId | null = null;
    let billingMode: 'sponsor' | 'subscription' = 'subscription';

    if (eng.sponsorEmail || eng.sponsorName) {
      const email = (eng.sponsorEmail || '').toLowerCase().trim();
      const name = (eng.sponsorName || '').trim() || email || 'Unnamed sponsor';

      let sponsor = email
        ? await Sponsor.findOne({ organizationId: eng.organizationId, email })
        : await Sponsor.findOne({ organizationId: eng.organizationId, name });
      if (!sponsor) {
        sponsor = await Sponsor.create({
          organizationId: eng.organizationId,
          name,
          email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@unknown.local`,
          organization: eng.sponsorOrg,
          isActive: true,
        });
        sponsorsCreated.add(sponsor._id.toString());
      }
      sponsorId = sponsor._id;
      billingMode = 'sponsor';
      sponsorBacked++;
    } else if (eng.rebillCoachee) {
      const coachee = await User.findById(eng.coacheeId).select('firstName lastName email');
      if (!coachee) { console.warn(`[migrate] eng=${eng._id} rebillCoachee but coachee not found — leaving as subscription`); continue; }
      const email = (coachee.email || '').toLowerCase();
      let sponsor = await Sponsor.findOne({ organizationId: eng.organizationId, email });
      if (!sponsor) {
        sponsor = await Sponsor.create({
          organizationId: eng.organizationId,
          name: `${coachee.firstName} ${coachee.lastName}`.trim(),
          email,
          coacheeId: coachee._id,
          isActive: true,
        });
        sponsorsCreated.add(sponsor._id.toString());
      }
      sponsorId = sponsor._id;
      billingMode = 'sponsor';
      selfPay++;
    } else {
      subscription++;
    }

    await Engagement.updateOne(
      { _id: eng._id },
      {
        $set: { sponsorId, billingMode },
        $unset: { sponsorName: '', sponsorEmail: '', sponsorOrg: '', rebillCoachee: '' },
      },
    );
  }

  console.log('[migrate] Done.');
  console.log(`  scanned:               ${scanned}`);
  console.log(`  already migrated:      ${linkedExisting}`);
  console.log(`  sponsor-backed:        ${sponsorBacked}`);
  console.log(`  self-pay (rebill):     ${selfPay}`);
  console.log(`  subscription-covered:  ${subscription}`);
  console.log(`  new sponsors created:  ${sponsorsCreated.size}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});

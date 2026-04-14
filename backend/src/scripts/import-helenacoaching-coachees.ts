/**
 * One-off import of coachees for the helena-coaching organization.
 *
 * Idempotent — re-running skips any user whose email already exists in the
 * org. Creates role='coachee', isActive=true, with a shared placeholder
 * password the coachee must reset on first login.
 *
 * Run (local): npx ts-node src/scripts/import-helenacoaching-coachees.ts
 * Run (server): node dist/scripts/import-helenacoaching-coachees.js
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';

const ORG_SLUG = 'helena-coaching';
const PLACEHOLDER_PASSWORD = 'ChangeMe!2026';

interface Row {
  firstName: string;
  lastName: string;
  email: string;
}

// Source: client-provided contact table (April 2026). Marek / hlavenka@hotmail.com
// is intentionally excluded (already an admin user in this org). Names with
// only a first name were completed from the email local-part: Tara Cross,
// Donna MacDonald. "Dan Goldstein/Emma Hason" collapsed to primary on email.
const ROWS: Row[] = [
  { firstName: 'Marie-Helene',   lastName: 'Lussier',     email: 'mlussier@minimaxglobalsolutions.com' },
  { firstName: 'Lauren',         lastName: 'Jacco',       email: 'lauren.jacco@kecedu.ca' },
  { firstName: "Sha'teiohseriio", lastName: 'Patton',     email: 'shateiohseriio.patton@kecedu.ca' },
  { firstName: 'Tara',           lastName: 'Cross',       email: 'tara.cross@kecedu.ca' },
  { firstName: 'Meaghen',        lastName: 'Lafleur',     email: 'ieiakohtehrohon.lafleur@kecedu.ca' },
  { firstName: 'Carrie',         lastName: 'Brisson',     email: 'carrie.brisson@kecedu.ca' },
  { firstName: 'Konwenni',       lastName: 'Zachary',     email: 'konwenni.zachary@kecedu.ca' },
  { firstName: 'Leslie',         lastName: 'Morris',      email: 'leslie.morris@kecedu.ca' },
  { firstName: 'Jayme Ann',      lastName: 'Bordeau',     email: 'jaymeann.bordeau@kecedu.ca' },
  { firstName: 'Sandra-Lynn',    lastName: 'Leclaire',    email: 'sandra-lynn.leclaire@kecedu.ca' },
  { firstName: 'Amirdavarshini', lastName: 'Muralithar',  email: 'amirdavarshini.muralithar@in.ey.com' },
  { firstName: 'Bethany',        lastName: 'Douglas',     email: 'bethany.douglas@kecedu.ca' },
  { firstName: 'Shakoiehtha',    lastName: 'Phillips',    email: 'shakoiehtha.phillips@kecedu.ca' },
  { firstName: 'Paul',           lastName: 'Nicholas',    email: 'sohenrise.nicholas@kahnawake.education' },
  { firstName: 'Ryan',           lastName: 'Sargeant',    email: 'ryan.sargeant@kecedu.ca' },
  { firstName: 'Walter',         lastName: 'Jacobs',      email: 'walter.jacobs@kecedu.ca' },
  { firstName: 'Falen',          lastName: 'Jacobs',      email: 'falen.jacobs@kecedu.ca' },
  { firstName: 'Jade',           lastName: 'Hannett',     email: 'jade.hannett@kecedu.ca' },
  { firstName: 'Jason',          lastName: 'Calvert',     email: 'jason.calvert@kecedu.ca' },
  { firstName: 'Dan',            lastName: 'Goldstein',   email: 'dgoldstein@judicia.ca' },
  { firstName: 'David-Emmanuel', lastName: 'Bergeron',    email: 'david-emmanuel.bergeron@telefilm.ca' },
  { firstName: 'Joseph',         lastName: 'Forte',       email: 'eleziek@gmail.com' },
  { firstName: 'Nazih',          lastName: 'Mina',        email: 'minazih@hotmail.com' },
  { firstName: 'Donna',          lastName: 'MacDonald',   email: 'donnamacdonald@minimaxexpress.com' },
  { firstName: 'Juliette',       lastName: 'Marshall',    email: 'juliette_marshall@verizon.net' },
  { firstName: 'Mandy',          lastName: 'Matsumoto',   email: 'mandymatsumoto@gmail.com' },
  { firstName: 'Patrick',        lastName: 'Poirier',     email: 'patpoirier@minimaxexpress.com' },
  { firstName: 'Ange Lionel',    lastName: 'Ouedraogo',   email: 'alouedraogo@inoria.com' },
  { firstName: 'Joseph',         lastName: 'Forte',       email: 'jsforte@inoria.com' },
  { firstName: 'Eloise',         lastName: 'Boileau',     email: 'eboileau@inoria.com' },
  { firstName: 'Randall',        lastName: 'Cottreau',    email: 'randall@rwcconsultingltd.ca' },
  { firstName: 'Randall',        lastName: 'Cottreau',    email: 'randallcottreau@hotmail.com' },
  { firstName: 'Albert John',    lastName: 'Renaud',      email: 'albert_gaucherexcavation@hotmail.com' },
  { firstName: 'Randy',          lastName: 'Akosah',      email: 'rakosah@minimaxexpress.com' },
];

async function run(): Promise<void> {
  await mongoose.connect(config.mongoUri);

  const org = await Organization.findOne({ slug: ORG_SLUG }).setOptions({ bypassTenantCheck: true });
  if (!org) {
    console.error(`[import] Organization "${ORG_SLUG}" not found. Aborting.`);
    process.exit(1);
  }
  console.log(`[import] Target org: ${org.name} (${org._id})`);

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 12);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of ROWS) {
    const email = row.email.toLowerCase().trim();
    try {
      const existing = await User.findOne({ email, organizationId: org._id })
        .setOptions({ bypassTenantCheck: true });
      if (existing) {
        console.log(`[skip]    ${email} — already exists`);
        skipped++;
        continue;
      }

      await User.create({
        organizationId: org._id,
        email,
        passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        role: 'coachee',
        isActive: true,
      });
      console.log(`[created] ${row.firstName} ${row.lastName} <${email}>`);
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[error]   ${email} — ${msg}`);
      errors++;
    }
  }

  console.log('\n─── Summary ───');
  console.log(`created: ${created}`);
  console.log(`skipped: ${skipped}`);
  console.log(`errors:  ${errors}`);
  console.log(`total rows: ${ROWS.length}`);
  console.log(`\nTemporary password for all new accounts: ${PLACEHOLDER_PASSWORD}`);
  console.log(`Ask each coachee to change it via Profile → Change Password after logging in.`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

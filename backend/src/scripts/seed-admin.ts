/**
 * Seed the HeadSoft system-admin user.
 * Run once: npm run seed:admin
 *
 * Password defaults to ADMIN_PASSWORD env var, or 'HeadSoftAdmin2024!' if not set.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Organization } from '../models/Organization.model';
import { User } from '../models/User.model';

const bypass = { bypassTenantCheck: true };

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // 1. Ensure the HeadSoft internal org exists
  let org = await Organization
    .findOne({ slug: 'headsoft-internal' })
    .setOptions(bypass);

  if (!org) {
    org = await Organization.create({
      name:         'HeadSoft Internal',
      slug:         'headsoft-internal',
      billingEmail: 'admin@headsoft.net',
      plan:         'enterprise',
      modules:      ['conflict', 'neuroinclusion', 'succession'],
      isActive:     true,
      maxUsers:     10,
    });
    console.log('✓ Created HeadSoft Internal organisation');
  } else {
    console.log('✓ HeadSoft Internal organisation already exists');
  }

  // 2. Create or update the system-admin user
  const password = process.env['ADMIN_PASSWORD'] || 'HeadSoftAdmin2024!';
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User
    .findOne({ email: 'admin@headsoft.net' })
    .setOptions(bypass);

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = 'system_admin';
    await existing.save({ validateModifiedOnly: true });
    console.log('✓ Updated admin@headsoft.net (password reset)');
  } else {
    await User.create({
      organizationId: org._id,
      email:          'admin@headsoft.net',
      passwordHash,
      role:           'system_admin',
      firstName:      'HeadSoft',
      lastName:       'Admin',
    });
    console.log('✓ Created admin@headsoft.net');
  }

  console.log('\n─────────────────────────────────────');
  console.log('  System-admin credentials');
  console.log('  Email   : admin@headsoft.net');
  console.log(`  Password: ${password}`);
  console.log('─────────────────────────────────────\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
import { Plan } from '../models/Plan.model';

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
    console.log('✓ Created HeadSoft Internal organization');
  } else {
    console.log('✓ HeadSoft Internal organization already exists');
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

  // 3. Seed default subscription plans (upsert by key)
  const defaultPlans = [
    {
      key: 'starter',
      name: 'Starter',
      description: 'Perfect for small teams getting started.',
      priceMonthly: 29900,
      overagePriceCents: 1500,
      maxUsers: 10,
      features: ['Up to 10 users', 'Conflict Intelligence module', 'Email support', 'Basic reporting'],
      isActive: true,
      sortOrder: 1,
    },
    {
      key: 'growth',
      name: 'Growth',
      description: 'For growing organizations.',
      priceMonthly: 59900,
      overagePriceCents: 1500,
      maxUsers: 50,
      features: ['Up to 50 users', 'All modules included', 'Priority email support', 'Advanced analytics'],
      isActive: true,
      sortOrder: 2,
    },
    {
      key: 'professional',
      name: 'Professional',
      description: 'For larger organizations needing full capabilities.',
      priceMonthly: 99900,
      overagePriceCents: 1200,
      maxUsers: 200,
      features: ['Up to 200 users', 'All modules + API access', 'Phone & email support', 'Custom reports', 'Dedicated CSM'],
      isActive: true,
      sortOrder: 3,
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      description: 'Fully custom for large enterprises.',
      priceMonthly: 149900,
      overagePriceCents: 1000,
      maxUsers: 500,
      features: ['500+ users', 'All modules + white-label', '24/7 support', 'SLA guarantee', 'Custom integrations', 'Dedicated coaching days'],
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const planData of defaultPlans) {
    await Plan.findOneAndUpdate(
      { key: planData.key },
      { $setOnInsert: planData },
      { upsert: true, new: true }
    );
  }
  console.log('✓ Default subscription plans seeded');

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

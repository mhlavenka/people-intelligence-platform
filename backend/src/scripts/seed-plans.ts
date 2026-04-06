/**
 * Seed subscription plans to match the billing page plan grid.
 * Run: npm run seed:plans
 *
 * Drops all existing plans and recreates from scratch.
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Plan } from '../models/Plan.model';

const plans = [
  // ── Conflict Intelligence™ ───────────────────────────────────────────────
  {
    key: 'starter',
    name: 'Conflict Intelligence — Starter',
    description: 'Conflict Intelligence™ for teams up to 50 employees.',
    priceMonthly: 59900,          // CAD $599/mo
    overagePriceCents: 1500,
    maxUsers: 50,
    modules: ['conflict'],
    limits: { maxAIAnalyses: 10, maxSurveyResponses: 500, maxCoachingSessions: 0, maxFileStorageMB: 500 },
    features: [
      'Up to 50 employees',
      'Conflict Intelligence™ module',
      '10 AI analyses per month',
      'Manager conversation guides',
      'Email support',
    ],
    isActive: true,
    sortOrder: 10,
  },
  {
    key: 'professional',
    name: 'Conflict Intelligence — Professional',
    description: 'Conflict Intelligence™ for organizations up to 200 employees.',
    priceMonthly: 119900,         // CAD $1,199/mo
    overagePriceCents: 1200,
    maxUsers: 200,
    modules: ['conflict'],
    limits: { maxAIAnalyses: 50, maxSurveyResponses: 2000, maxCoachingSessions: 0, maxFileStorageMB: 2000 },
    features: [
      'Up to 200 employees',
      'Conflict Intelligence™ module',
      '50 AI analyses per month',
      'Manager conversation guides',
      'Escalation workflow',
      'Priority support',
    ],
    isActive: true,
    sortOrder: 11,
  },
  {
    key: 'enterprise',
    name: 'Conflict Intelligence — Enterprise',
    description: 'Conflict Intelligence™ for large enterprises (200–500+ employees). Custom pricing.',
    priceMonthly: 0,              // Custom — quoted separately
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['conflict'],
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 0 },
    features: [
      '200–500+ employees',
      'Conflict Intelligence™ module',
      'Unlimited AI analyses',
      'Full platform access',
      'Dedicated success manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    isActive: true,
    sortOrder: 12,
  },

  // ── Neuro-Inclusion Compass™ ─────────────────────────────────────────────
  {
    key: 'neuroinc-assessment',
    name: 'Neuro-Inclusion — Assessment + Report',
    description: 'One-time full-org neuro-inclusion assessment and comprehensive report.',
    priceMonthly: 250000,         // CAD $2,500 one-time (stored as monthly for invoicing)
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['neuroinclusion'],
    limits: { maxAIAnalyses: 1, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 500 },
    features: [
      'One-time, full organization',
      'Neuro-Inclusion Compass™ assessment',
      '7-dimension analysis',
      '1 AI analysis report',
      'Comprehensive PDF report',
      'Actionable recommendations',
    ],
    isActive: true,
    sortOrder: 20,
  },
  {
    key: 'neuroinc-subscription',
    name: 'Neuro-Inclusion — Compass Subscription',
    description: 'Annual continuous neuro-inclusion monitoring across your organization.',
    priceMonthly: 70000,          // CAD $8,400/yr ÷ 12 = $700/mo
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['neuroinclusion'],
    limits: { maxAIAnalyses: 10, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 1000 },
    features: [
      'Annual subscription',
      'Continuous monitoring',
      '10 AI analyses per month',
      'Quarterly re-assessments',
      'Trend analytics dashboard',
      'Inclusion maturity tracking',
    ],
    isActive: true,
    sortOrder: 21,
  },
  {
    key: 'neuroinc-implementation',
    name: 'Neuro-Inclusion — Implementation Program',
    description: '3-month guided implementation add-on for the Compass assessment.',
    priceMonthly: 600000,         // CAD $6,000 one-time
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['neuroinclusion'],
    limits: { maxAIAnalyses: 5, maxSurveyResponses: 0, maxCoachingSessions: 4, maxFileStorageMB: 1000 },
    features: [
      '3-month guided program',
      'Add-on to Compass Subscription',
      '5 AI analyses per month',
      'Facilitated workshops',
      'Manager coaching sessions',
      'Action plan development',
    ],
    isActive: true,
    sortOrder: 22,
  },
  {
    key: 'neuroinc-enterprise',
    name: 'Neuro-Inclusion — Enterprise',
    description: 'Multi-department or white-label neuro-inclusion program. Custom pricing.',
    priceMonthly: 0,              // Custom
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['neuroinclusion'],
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 0 },
    features: [
      'Multi-department deployment',
      'Unlimited AI analyses',
      'White-label option',
      'Custom assessment dimensions',
      'Dedicated analyst',
      'Executive reporting',
    ],
    isActive: true,
    sortOrder: 23,
  },

  // ── Leadership & Succession Hub™ ─────────────────────────────────────────
  {
    key: 'succession-starter',
    name: 'Leadership & Succession — Starter',
    description: 'Leadership succession planning for up to 5 successors.',
    priceMonthly: 40000,          // CAD $4,800/yr ÷ 12 = $400/mo
    overagePriceCents: 0,
    maxUsers: 5,
    modules: ['succession'],
    limits: { maxAIAnalyses: 10, maxSurveyResponses: 100, maxCoachingSessions: 0, maxFileStorageMB: 500 },
    features: [
      'Up to 5 successors',
      'AI-generated IDPs (GROW model)',
      '10 AI analyses per month',
      'Milestone tracking',
      'EQ-i score integration',
      'Coaching session logs',
    ],
    isActive: true,
    sortOrder: 30,
  },
  {
    key: 'succession-team',
    name: 'Leadership & Succession — Leadership Team',
    description: 'Leadership succession planning for up to 15 leaders.',
    priceMonthly: 80000,          // CAD $9,600/yr ÷ 12 = $800/mo
    overagePriceCents: 0,
    maxUsers: 15,
    modules: ['succession'],
    limits: { maxAIAnalyses: 30, maxSurveyResponses: 500, maxCoachingSessions: 0, maxFileStorageMB: 1000 },
    features: [
      'Up to 15 leaders',
      'AI-generated IDPs (GROW model)',
      '30 AI analyses per month',
      'Milestone tracking',
      'Team succession dashboard',
      'Progress reporting',
    ],
    isActive: true,
    sortOrder: 31,
  },
  {
    key: 'succession-full',
    name: 'Leadership & Succession — Full Program',
    description: 'Unlimited successors plus 4 Helena coaching sessions per year.',
    priceMonthly: 150000,         // CAD $18,000/yr ÷ 12 = $1,500/mo
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['succession'],
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 4, maxFileStorageMB: 5000 },
    features: [
      'Unlimited successors',
      '4 Helena coaching sessions/yr',
      'Unlimited AI analyses',
      'AI-generated IDPs (GROW model)',
      'Full analytics suite',
      'Priority support',
    ],
    isActive: true,
    sortOrder: 32,
  },
  {
    key: 'succession-idp',
    name: 'Leadership & Succession — IDP-Only',
    description: 'Standalone per-person IDP. Billed per individual.',
    priceMonthly: 120000,         // CAD $1,200/person
    overagePriceCents: 0,
    maxUsers: 1,
    modules: ['succession'],
    limits: { maxAIAnalyses: 2, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 100 },
    features: [
      'Standalone per-person plan',
      '2 AI analyses',
      'Single AI-generated IDP',
      'GROW model framework',
      'Milestone tracking',
    ],
    isActive: true,
    sortOrder: 33,
  },

  // ── All-Platform Bundle ───────────────────────────────────────────────────
  {
    key: 'bundle-all',
    name: 'All-Platform Bundle',
    description: 'All three modules plus 2 Helena coaching days/year. Bundle saves 25%.',
    priceMonthly: 200000,         // CAD $24,000/yr ÷ 12 = $2,000/mo
    overagePriceCents: 0,
    maxUsers: 999,
    modules: ['conflict', 'neuroinclusion', 'succession'],
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 2, maxFileStorageMB: 0 },
    features: [
      'Conflict Intelligence™',
      'Neuro-Inclusion Compass™',
      'Leadership & Succession Hub™',
      'Unlimited AI analyses',
      '2 Helena coaching days/year',
      'Bundle saves 25%',
      'Dedicated success manager',
    ],
    isActive: true,
    sortOrder: 40,
  },
];

async function seed(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Drop all existing plans and reseed from scratch
  const deleted = await Plan.deleteMany({});
  console.log(`  → Removed ${deleted.deletedCount} existing plan(s)`);

  for (const planData of plans) {
    await Plan.create(planData);
    console.log(`  ✓ ${planData.name}  (${planData.priceMonthly === 0 ? 'Custom' : `CAD $${(planData.priceMonthly / 100).toFixed(0)}`})`);
  }

  console.log(`\n  Total: ${plans.length} plans seeded.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

import mongoose, { Document, Schema } from 'mongoose';

export interface IOrgTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;     // cards
  panelColor: string;       // sections / panels (wraps cards)
  headingFont: string;
  bodyFont: string;
  borderRadius: 'sharp' | 'rounded' | 'pill';
}

export interface IBillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;      // state / region / province
  postalCode?: string;
  country?: string;    // ISO 3166-1 alpha-2, e.g. 'US', 'DE', 'NL'
}

export interface IOrganization extends Document {
  name: string;
  slug: string;
  plan: string;
  modules: string[];
  billingEmail: string;
  billingAddress?: IBillingAddress;
  taxId?: string;          // VAT number, EIN, etc.
  taxExempt: boolean;      // e.g. Indigenous organizations
  stripeCustomerId?: string;
  employeeCount?: number;
  industry?: string;
  theme?: IOrgTheme;
  logoUrl?: string;        // base64 Data URL or external URL
  departments: string[];   // org-defined department list
  isActive: boolean;
  trialEndsAt?: Date;
  // Trial snapshot: when a system-admin upgrades the org as a trial, the
  // pre-trial plan/modules/maxUsers are saved here so the nightly cron
  // (or an explicit DELETE /trial) can revert cleanly.
  previousPlan?: string;
  previousModules?: string[];
  previousMaxUsers?: number;
  maxUsers: number;
  notes?: string;
  coachingRebill: boolean;
  defaultCoachRate?: number;
  coacheeCanChooseCoach: boolean;   // org default: may a coachee pick their own coach when booking? per-user override on User.canChooseCoach
  defaultLanguage: string;
  supportedLanguages: string[];
  aiGenerationsUsed: number;
  aiGenerationsResetAt?: Date;
  suspendedAt?: Date;
  suspensionReason?: string;

  // Per-org tunables for the survey-divergence quality filter (Layer 1).
  // Conservative permissive defaults — flag-but-include, never auto-reject.
  surveyQualityPolicy?: {
    qualityThreshold?: number;        // default 0.35  (responses below this drop out)
    longStringMaxFraction?: number;   // default 0.80  (≥80% same answer ⇒ flag)
    minSubgroupN?: number;            // default 3     (Phase 2 — subgroup detection)
    showSubgroupAnalysis?: boolean;   // default true
    speedingMsPerItemFloor?: number;  // default 2000  (per-response hard implausibility floor, ms)
    speedingGroupZThreshold?: number; // default -3.5  (cohort modified-Z; lower = stricter)
    speedingMinCohortN?: number;      // default 10    (cohort-Z gate; below this, only the floor fires)
  };

  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: {
      type: String,
      default: 'starter',
    },
    modules: [{ type: String }],
    billingEmail: { type: String, required: true, lowercase: true },
    billingAddress: {
      type: new Schema({
        line1:      { type: String, trim: true },
        line2:      { type: String, trim: true },
        city:       { type: String, trim: true },
        state:      { type: String, trim: true },
        postalCode: { type: String, trim: true },
        country:    { type: String, trim: true, uppercase: true, maxlength: 2 },
      }, { _id: false }),
    },
    taxId: { type: String, trim: true },
    taxExempt: { type: Boolean, default: false },
    stripeCustomerId: { type: String },
    employeeCount: { type: Number },
    industry: { type: String },
    isActive:         { type: Boolean, default: true },
    trialEndsAt:      { type: Date },
    previousPlan:     { type: String },
    previousModules:  [{ type: String }],
    previousMaxUsers: { type: Number },
    maxUsers:         { type: Number, default: 100 },
    notes:            { type: String, trim: true },
    coachingRebill:   { type: Boolean, default: false },
    defaultCoachRate: { type: Number, min: 0 },
    coacheeCanChooseCoach: { type: Boolean, default: true },
    defaultLanguage:    { type: String, default: 'en' },
    supportedLanguages: { type: [String], default: ['en'] },
    aiGenerationsUsed:   { type: Number, default: 0, min: 0 },
    aiGenerationsResetAt: { type: Date },
    suspendedAt:      { type: Date },
    suspensionReason: { type: String, trim: true },

    surveyQualityPolicy: {
      type: new Schema({
        qualityThreshold:        { type: Number, min: 0, max: 1, default: 0.35 },
        longStringMaxFraction:   { type: Number, min: 0, max: 1, default: 0.80 },
        minSubgroupN:            { type: Number, min: 1, default: 3 },
        showSubgroupAnalysis:    { type: Boolean, default: true },
        speedingMsPerItemFloor:  { type: Number, min: 0, default: 2000 },
        speedingGroupZThreshold: { type: Number, max: 0, default: -3.5 },
        speedingMinCohortN:      { type: Number, min: 3, default: 10 },
      }, { _id: false }),
    },
    logoUrl:     { type: String },
    departments: [{ type: String, trim: true }],
    theme: {
      type: new Schema({
        primaryColor:    { type: String, default: '#1B2A47' },
        accentColor:     { type: String, default: '#3A9FD6' },
        backgroundColor: { type: String, default: '#EBF5FB' },
        surfaceColor:    { type: String, default: '#ffffff' },
        panelColor:      { type: String, default: '#ffffff' },
        headingFont:     { type: String, default: 'Inter' },
        bodyFont:        { type: String, default: 'Inter' },
        borderRadius:    { type: String, enum: ['sharp', 'rounded', 'pill'], default: 'rounded' },
      }, { _id: false }),
      default: () => ({}),
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);

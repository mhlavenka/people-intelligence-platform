import mongoose, { Document, Schema } from 'mongoose';

export interface IOrgTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
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
  plan: 'starter' | 'professional' | 'enterprise';
  modules: string[];
  billingEmail: string;
  billingAddress?: IBillingAddress;
  taxId?: string;          // VAT number, EIN, etc.
  stripeCustomerId?: string;
  employeeCount?: number;
  industry?: string;
  theme?: IOrgTheme;
  logoUrl?: string;        // base64 Data URL or external URL
  isActive: boolean;
  trialEndsAt?: Date;
  maxUsers: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
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
    stripeCustomerId: { type: String },
    employeeCount: { type: Number },
    industry: { type: String },
    isActive:    { type: Boolean, default: true },
    trialEndsAt: { type: Date },
    maxUsers:    { type: Number, default: 100 },
    notes:       { type: String, trim: true },
    logoUrl:     { type: String },   // base64 Data URL or external URL
    theme: {
      type: new Schema({
        primaryColor:    { type: String, default: '#1B2A47' },
        accentColor:     { type: String, default: '#3A9FD6' },
        backgroundColor: { type: String, default: '#EBF5FB' },
        surfaceColor:    { type: String, default: '#ffffff' },
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

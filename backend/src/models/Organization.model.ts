import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  modules: string[];
  billingEmail: string;
  stripeCustomerId?: string;
  employeeCount?: number;
  industry?: string;
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
    stripeCustomerId: { type: String },
    employeeCount: { type: Number },
    industry: { type: String },
  },
  { timestamps: true }
);

OrganizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = mongoose.model<IOrganization>('Organization', OrganizationSchema);

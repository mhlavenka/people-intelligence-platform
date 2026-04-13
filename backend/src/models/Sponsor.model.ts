import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/**
 * Sponsor — the billing target for coaching engagements.
 *
 * Sponsors are reusable across engagements. Email is unique per organization
 * (case-insensitive) so the same sponsor record is reused if you create the
 * same email twice. When a coachee pays for their own coaching, a Sponsor is
 * created with `coacheeId` set so the relationship is explicit.
 */
export interface ISponsor extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  organization?: string;
  phone?: string;
  billingAddress?: string;
  defaultHourlyRate?: number;
  notes?: string;
  coacheeId?: mongoose.Types.ObjectId;  // set when sponsor IS a coachee (self-pay)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SponsorSchema = new Schema<ISponsor>(
  {
    organizationId:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name:              { type: String, required: true, trim: true },
    email:             { type: String, required: true, trim: true, lowercase: true },
    organization:      { type: String, trim: true },
    phone:             { type: String, trim: true },
    billingAddress:    { type: String, trim: true },
    defaultHourlyRate: { type: Number, min: 0 },
    notes:             { type: String },
    coacheeId:         { type: Schema.Types.ObjectId, ref: 'User', index: true },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true },
);

SponsorSchema.plugin(tenantFilterPlugin);
SponsorSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const Sponsor = mongoose.model<ISponsor>('Sponsor', SponsorSchema);

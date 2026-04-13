import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/** Structured billing address mirrored from Organization.model. */
export interface ISponsorBillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;       // ISO 3166-2:CA province code (ON, BC, QC, ...) for Canadian taxes
  postalCode?: string;
  country?: string;     // ISO 3166-1 alpha-2 (CA, US, ...)
}

/**
 * Sponsor — the billing target for coaching engagements.
 *
 * Sponsors are reusable across engagements. Email is unique per organization
 * (case-insensitive) so the same sponsor record is reused if you create the
 * same email twice. When a coachee pays for their own coaching, a Sponsor is
 * created with `coacheeId` set so the relationship is explicit.
 *
 * billingAddress + taxId + taxExempt drive the per-invoice tax calculation
 * (mirrors the Organization.model fields used by system-admin billing).
 */
export interface ISponsor extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  organization?: string;
  phone?: string;
  billingAddress?: ISponsorBillingAddress;
  taxId?: string;
  taxExempt?: boolean;
  defaultHourlyRate?: number;
  notes?: string;
  coacheeId?: mongoose.Types.ObjectId;  // set when sponsor IS a coachee (self-pay)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BillingAddressSchema = new Schema<ISponsorBillingAddress>({
  line1:      { type: String, trim: true },
  line2:      { type: String, trim: true },
  city:       { type: String, trim: true },
  state:      { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country:    { type: String, trim: true },
}, { _id: false });

const SponsorSchema = new Schema<ISponsor>(
  {
    organizationId:    { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name:              { type: String, required: true, trim: true },
    email:             { type: String, required: true, trim: true, lowercase: true },
    organization:      { type: String, trim: true },
    phone:             { type: String, trim: true },
    billingAddress:    { type: BillingAddressSchema, default: undefined },
    taxId:             { type: String, trim: true },
    taxExempt:         { type: Boolean, default: false },
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

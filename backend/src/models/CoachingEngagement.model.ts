import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type EngagementStatus = 'prospect' | 'contracted' | 'active' | 'paused' | 'completed' | 'alumni';

/**
 * Billing mode:
 *   - 'sponsor'      -> sponsorId is required; sessions are billed to the sponsor
 *   - 'subscription' -> sponsorId is null; cost is covered by the org's
 *                       subscription plan (no per-session billing)
 */
export type BillingMode = 'sponsor' | 'subscription';

export interface ICoachingEngagement extends Document {
  organizationId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  sponsorId?: mongoose.Types.ObjectId;
  billingMode: BillingMode;
  status: EngagementStatus;
  sessionsPurchased: number;
  sessionsUsed: number;
  sessionFormat?: string;           // default: video / phone / in-person
  cadence?: string;                 // weekly / biweekly / monthly
  startDate?: Date;
  targetEndDate?: Date;
  completedAt?: Date;
  goals: string[];
  contractUrl?: string;
  notes?: string;                   // coach's private engagement notes
  hourlyRate?: number;              // per-engagement rate; falls back to sponsor.defaultHourlyRate
  createdAt: Date;
  updatedAt: Date;
}

const CoachingEngagementSchema = new Schema<ICoachingEngagement>(
  {
    organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coacheeId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coachId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sponsorId:       { type: Schema.Types.ObjectId, ref: 'Sponsor', index: true },
    billingMode: {
      type: String,
      enum: ['sponsor', 'subscription'],
      default: 'subscription',
      required: true,
    },
    status: {
      type: String,
      enum: ['prospect', 'contracted', 'active', 'paused', 'completed', 'alumni'],
      default: 'prospect',
    },
    sessionsPurchased: { type: Number, default: 0 },
    sessionsUsed:      { type: Number, default: 0 },
    sessionFormat:     { type: String },
    cadence:           { type: String },
    startDate:         { type: Date },
    targetEndDate:     { type: Date },
    completedAt:       { type: Date },
    goals:             [{ type: String }],
    contractUrl:       { type: String },
    notes:             { type: String },
    hourlyRate:        { type: Number, min: 0 },
  },
  { timestamps: true }
);

CoachingEngagementSchema.plugin(tenantFilterPlugin);
CoachingEngagementSchema.index({ organizationId: 1, coacheeId: 1 });
CoachingEngagementSchema.index({ organizationId: 1, status: 1 });

// Keep User.isCoachee in sync — once a user is attached to an engagement
// they're marked as a coachee, independently of their org role. We only
// flip to true here; clearing the flag is a manual admin action to avoid
// false negatives when engagements are archived vs. truly ended.
CoachingEngagementSchema.post('save', async function (doc) {
  try {
    const { User } = await import('./User.model');
    await User.updateOne(
      { _id: doc.coacheeId, isCoachee: { $ne: true } },
      { $set: { isCoachee: true } },
    ).setOptions({ bypassTenantCheck: true });
  } catch (err) {
    console.warn('[CoachingEngagement] Failed to sync isCoachee flag:', err);
  }
});

export const CoachingEngagement = mongoose.model<ICoachingEngagement>('CoachingEngagement', CoachingEngagementSchema);

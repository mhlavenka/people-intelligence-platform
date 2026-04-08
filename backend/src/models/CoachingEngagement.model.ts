import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type EngagementStatus = 'prospect' | 'contracted' | 'active' | 'paused' | 'completed' | 'alumni';

export interface ICoachingEngagement extends Document {
  organizationId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  sponsorName?: string;
  sponsorEmail?: string;
  sponsorOrg?: string;
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
  rebillCoachee: boolean;           // bill the coachee for sessions
  hourlyRate?: number;              // per-engagement rate (defaults from org)
  createdAt: Date;
  updatedAt: Date;
}

const CoachingEngagementSchema = new Schema<ICoachingEngagement>(
  {
    organizationId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coacheeId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coachId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sponsorName:     { type: String, trim: true },
    sponsorEmail:    { type: String, trim: true },
    sponsorOrg:      { type: String, trim: true },
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
    rebillCoachee:     { type: Boolean, default: false },
    hourlyRate:        { type: Number, min: 0 },
  },
  { timestamps: true }
);

CoachingEngagementSchema.plugin(tenantFilterPlugin);
CoachingEngagementSchema.index({ organizationId: 1, coacheeId: 1 });
CoachingEngagementSchema.index({ organizationId: 1, status: 1 });

export const CoachingEngagement = mongoose.model<ICoachingEngagement>('CoachingEngagement', CoachingEngagementSchema);

import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type SessionClientType = 'individual' | 'team' | 'group';
export type SessionPaidStatus = 'paid' | 'pro_bono';

export interface ICoachingSession extends Document {
  organizationId: mongoose.Types.ObjectId;
  engagementId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  date: Date;
  duration: number;                  // minutes
  format: 'video' | 'phone' | 'in_person';
  growFocus: string[];               // GROW phases explored: goal / reality / options / will
  frameworks: string[];              // coaching models used
  coachNotes: string;                // private — NEVER shared with coachee
  sharedNotes: string;               // visible to coachee in their portal
  preSessionRating?: number;         // coachee energy/mood 1-10
  postSessionRating?: number;        // coachee session rating 1-5
  topics: string[];
  status: SessionStatus;
  clientType: SessionClientType;     // ICF-required: individual / team / group
  paidStatus: SessionPaidStatus;     // ICF-required: paid / pro_bono
  /** Complimentary chemistry call before contracting. Does NOT consume the
   *  engagement's session quota. Always pro_bono. Typically the only session
   *  that can exist on a 'prospect' engagement. */
  isChemistryCall: boolean;
  googleEventId?: string;
  googleMeetLink?: string;
  bookingId?: mongoose.Types.ObjectId;  // paired Booking row, if any
  createdVia: 'coach' | 'coachee_booking';
  preSessionIntakeTemplateId?: mongoose.Types.ObjectId;
  preSessionIntakeSentAt?: Date;
  postSessionIntakeTemplateId?: mongoose.Types.ObjectId;
  postSessionIntakeSentAt?: Date;
  lateCancellation?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CoachingSessionSchema = new Schema<ICoachingSession>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    engagementId:   { type: Schema.Types.ObjectId, ref: 'CoachingEngagement', required: true },
    coacheeId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coachId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date:           { type: Date, required: true },
    duration:       { type: Number, default: 60 },
    format:         { type: String, enum: ['video', 'phone', 'in_person'], default: 'video' },
    growFocus:      [{ type: String }],
    frameworks:     [{ type: String }],
    coachNotes:     { type: String, default: '' },
    sharedNotes:    { type: String, default: '' },
    preSessionRating:  { type: Number, min: 1, max: 10 },
    postSessionRating: { type: Number, min: 1, max: 5 },
    topics:         [{ type: String }],
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
    },
    clientType: {
      type: String,
      enum: ['individual', 'team', 'group'],
      default: 'individual',
    },
    paidStatus: {
      type: String,
      enum: ['paid', 'pro_bono'],
      default: 'paid',
    },
    isChemistryCall: { type: Boolean, default: false },
    googleEventId: { type: String },
    googleMeetLink: { type: String },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    createdVia: {
      type: String,
      enum: ['coach', 'coachee_booking'],
      default: 'coach',
    },
    preSessionIntakeTemplateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate' },
    preSessionIntakeSentAt: { type: Date },
    postSessionIntakeTemplateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate' },
    postSessionIntakeSentAt: { type: Date },
    lateCancellation: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CoachingSessionSchema.plugin(tenantFilterPlugin);
CoachingSessionSchema.index({ organizationId: 1, engagementId: 1, date: -1 });

export const CoachingSession = mongoose.model<ICoachingSession>('CoachingSession', CoachingSessionSchema);

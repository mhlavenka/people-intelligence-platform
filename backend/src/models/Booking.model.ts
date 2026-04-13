import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IReminderRecord {
  type: string;
  sentAt: Date;
}

export interface IRescheduleRecord {
  from: Date;
  to: Date;
  by: string;
  at: Date;
}

export interface IBooking extends Document {
  coachId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  eventTypeId?: mongoose.Types.ObjectId;
  eventTypeName?: string;
  // Internal coaching links — populated when an authenticated coachee booked.
  coacheeId?: mongoose.Types.ObjectId;
  engagementId?: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  topic?: string;
  startTime: Date;
  endTime: Date;
  clientTimezone: string;
  coachTimezone: string;
  googleEventId?: string;
  googleMeetLink?: string;
  cancelToken?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  remindersSent: IReminderRecord[];
  rescheduledAt?: Date;
  rescheduledBy?: string;
  rescheduleHistory: IRescheduleRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const ReminderRecordSchema = new Schema({
  type:   { type: String, required: true },
  sentAt: { type: Date, required: true },
}, { _id: false });

const RescheduleRecordSchema = new Schema({
  from: { type: Date, required: true },
  to:   { type: Date, required: true },
  by:   { type: String, required: true },
  at:   { type: Date, required: true },
}, { _id: false });

const BookingSchema = new Schema<IBooking>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    eventTypeId: { type: Schema.Types.ObjectId, ref: 'AvailabilityConfig' },
    eventTypeName: { type: String, trim: true },
    coacheeId:    { type: Schema.Types.ObjectId, ref: 'User', index: true },
    engagementId: { type: Schema.Types.ObjectId, ref: 'CoachingEngagement', index: true },
    sessionId:    { type: Schema.Types.ObjectId, ref: 'CoachingSession', index: true },
    clientName:  { type: String, required: true, trim: true },
    clientEmail: { type: String, required: true, lowercase: true, trim: true },
    clientPhone: { type: String, trim: true },
    topic:       { type: String, trim: true },
    startTime:   { type: Date, required: true },
    endTime:     { type: Date, required: true },
    clientTimezone: { type: String, default: 'UTC' },
    coachTimezone:  { type: String, default: 'America/Toronto' },
    googleEventId:  { type: String },
    googleMeetLink: { type: String },
    cancelToken:    { type: String },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
    },
    cancelledAt:         { type: Date },
    cancelledBy:         { type: String },
    cancellationReason:  { type: String },
    remindersSent:       [ReminderRecordSchema],
    rescheduledAt:       { type: Date },
    rescheduledBy:       { type: String },
    rescheduleHistory:   { type: [RescheduleRecordSchema], default: [] },
  },
  { timestamps: true },
);

BookingSchema.plugin(tenantFilterPlugin);
BookingSchema.index({ coachId: 1, startTime: 1 });
BookingSchema.index({ clientEmail: 1, startTime: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);

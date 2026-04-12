import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IWeeklySlot {
  dayOfWeek: number;   // 0 = Sunday … 6 = Saturday
  startTime: string;   // "HH:MM" in coach timezone
  endTime: string;     // "HH:MM" in coach timezone
  enabled: boolean;
}

export interface IDateOverride {
  date: Date;
  startTime: string;
  endTime: string;
  isUnavailable: boolean;
}

export interface IAvailabilityConfig extends Document {
  coachId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  coachSlug: string;
  timezone: string;
  appointmentDuration: number;
  bufferTime: number;
  maxBookingsPerDay: number | null;
  minNoticeHours: number;
  maxAdvanceDays: number;
  weeklySchedule: IWeeklySlot[];
  dateOverrides: IDateOverride[];
  scheduleMode: 'shared' | 'custom';
  targetCalendarId: string;
  conflictCalendarIds: string[];
  googleMeetEnabled: boolean;
  bookingPageTitle: string;
  bookingPageDesc: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WeeklySlotSchema = new Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true },
  endTime:   { type: String, required: true },
  enabled:   { type: Boolean, default: true },
}, { _id: false });

const DateOverrideSchema = new Schema({
  date:          { type: Date, required: true },
  startTime:     { type: String },
  endTime:       { type: String },
  isUnavailable: { type: Boolean, default: false },
}, { _id: false });

const AvailabilityConfigSchema = new Schema<IAvailabilityConfig>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Coaching Session',
    },
    color: {
      type: String,
      default: '#3A9FD6',
    },
    coachSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    timezone:            { type: String, required: true, default: 'America/Toronto' },
    appointmentDuration: { type: Number, default: 60 },
    bufferTime:          { type: Number, default: 0 },
    maxBookingsPerDay:   { type: Number, default: null },
    minNoticeHours:      { type: Number, default: 24 },
    maxAdvanceDays:       { type: Number, default: 60 },
    weeklySchedule:      [WeeklySlotSchema],
    dateOverrides:       [DateOverrideSchema],
    scheduleMode:        { type: String, enum: ['shared', 'custom'], default: 'shared' },
    targetCalendarId:    { type: String, default: '' },
    conflictCalendarIds: [{ type: String }],
    googleMeetEnabled:   { type: Boolean, default: true },
    bookingPageTitle:    { type: String, default: '' },
    bookingPageDesc:     { type: String, default: '' },
    isActive:            { type: Boolean, default: true },
  },
  { timestamps: true },
);

AvailabilityConfigSchema.plugin(tenantFilterPlugin);

export const AvailabilityConfig = mongoose.model<IAvailabilityConfig>(
  'AvailabilityConfig',
  AvailabilityConfigSchema,
);

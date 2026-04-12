import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';
import { IWeeklySlot, IDateOverride } from './AvailabilityConfig.model';

export interface IBookingSettings extends Document {
  coachId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  timezone: string;
  weeklySchedule: IWeeklySlot[];
  dateOverrides: IDateOverride[];
  targetCalendarId: string;
  conflictCalendarIds: string[];
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

const BookingSettingsSchema = new Schema<IBookingSettings>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    timezone:            { type: String, required: true, default: 'America/Toronto' },
    weeklySchedule:      [WeeklySlotSchema],
    dateOverrides:       [DateOverrideSchema],
    targetCalendarId:    { type: String, default: '' },
    conflictCalendarIds: [{ type: String }],
  },
  { timestamps: true },
);

BookingSettingsSchema.plugin(tenantFilterPlugin);

export const BookingSettings = mongoose.model<IBookingSettings>(
  'BookingSettings',
  BookingSettingsSchema,
);

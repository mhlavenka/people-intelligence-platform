import mongoose, { Schema, Document } from 'mongoose';

/**
 * Recurrence schedule for a SurveyAssignment.
 *
 * When present, the surveyScheduler cron will dispatch the assignment to its
 * recipients on the configured cadence — re-resolving department membership
 * fresh each fire so a member added later still gets the survey, and
 * snapping to dayOfWeek + hourOfDay when those are set.
 *
 * Stop conditions (whichever fires first):
 *   - endsAt date passes
 *   - occurrencesFired >= maxOccurrences
 *   - paused = true (pauses indefinitely; clearing resumes from where it was)
 */
export interface IAssignmentRecurrence {
  intervalWeeks: number;          // cadence in weeks (>=1)
  /** 0 = Sunday … 6 = Saturday. When set, fires snap to this weekday. */
  dayOfWeek?: number;
  /** 0-23, server timezone. Default 9 (09:00). */
  hourOfDay?: number;
  /** First fire time. Defaults to assignment.createdAt at creation time. */
  startsAt: Date;
  /** Hard stop date. Empty = no end date. */
  endsAt?: Date;
  /** Max number of cycles to fire. Empty = unlimited. */
  maxOccurrences?: number;
  /** Counter advanced by the cron after each successful fire. */
  occurrencesFired: number;
  /** When true the cron skips this assignment until cleared. */
  paused: boolean;
  /** Cron-managed: when to fire next. Computed after each fire. */
  nextFireAt?: Date;
  /** Cron-managed: when the most recent fire completed. */
  lastFiredAt?: Date;
}

export interface ISurveyAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  userIds: mongoose.Types.ObjectId[];
  departments: string[];
  message?: string;
  recurrence?: IAssignmentRecurrence;
  createdAt: Date;
}

const RecurrenceSchema = new Schema<IAssignmentRecurrence>({
  intervalWeeks:    { type: Number, required: true, min: 1 },
  dayOfWeek:        { type: Number, min: 0, max: 6 },
  hourOfDay:        { type: Number, min: 0, max: 23, default: 9 },
  startsAt:         { type: Date, required: true },
  endsAt:           { type: Date },
  maxOccurrences:   { type: Number, min: 1 },
  occurrencesFired: { type: Number, default: 0 },
  paused:           { type: Boolean, default: false },
  nextFireAt:       { type: Date },
  lastFiredAt:      { type: Date },
}, { _id: false });

const SurveyAssignmentSchema = new Schema<ISurveyAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    departments: [{ type: String }],
    message: { type: String },
    recurrence: { type: RecurrenceSchema },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SurveyAssignmentSchema.index({ templateId: 1, organizationId: 1 });
// Surface assignments due for a fire to the cron without a full scan.
SurveyAssignmentSchema.index({ 'recurrence.nextFireAt': 1, 'recurrence.paused': 1 });

export const SurveyAssignment = mongoose.model<ISurveyAssignment>('SurveyAssignment', SurveyAssignmentSchema);

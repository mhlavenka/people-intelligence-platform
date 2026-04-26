import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IResponseItem {
  questionId: string;
  value: string | number | boolean;
}

export interface ISurveyResponse extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  respondentId?: mongoose.Types.ObjectId; // only stored when isAnonymous = false
  coachId?: mongoose.Types.ObjectId;      // set when a coach conducts on behalf of a coachee
  sessionFormat?: 'individual' | 'team' | 'group';
  targetName?: string;                    // free-text target identifier for coach-led sessions
  sessionId?: mongoose.Types.ObjectId;    // linked CoachingSession when this response is a pre-session intake
  submissionToken: string;               // SHA-256(userId + templateId [+ sessionId]) — used for dedup
  departmentId?: string;
  respondentLanguage?: string;
  responses: IResponseItem[];
  submittedAt: Date;
  isAnonymous: boolean;

  // ── Response-quality signals (Layer 1 of the divergence analysis) ────
  // 0..1 composite score from straightlining + long-string + (when timing is
  // captured) speeding. Computed on submit. Pre-existing rows have undefined,
  // which the analyzer treats as "always accepted" for backward compatibility.
  qualityScore?: number;
  qualityFlags?: string[];               // e.g. ['straightlining', 'longString']
  acceptedInAnalysis?: boolean;          // false = excluded by quality filter
  timingMsPerItem?: number[];            // optional per-item answer time

  createdAt: Date;
  updatedAt: Date;
}

const ResponseItemSchema = new Schema<IResponseItem>(
  {
    questionId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const SurveyResponseSchema = new Schema<ISurveyResponse>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate', required: true },
    respondentId: { type: Schema.Types.ObjectId, ref: 'User' }, // optional — omitted when anonymous
    coachId: { type: Schema.Types.ObjectId, ref: 'User' },      // set for coach-led sessions
    sessionFormat: { type: String, enum: ['individual', 'team', 'group'] },
    targetName: { type: String },
    sessionId: { type: Schema.Types.ObjectId, ref: 'CoachingSession', index: true },
    submissionToken: { type: String, required: true },          // one-way hash, always present
    departmentId: { type: String },
    respondentLanguage: { type: String, enum: ['en', 'fr', 'es', 'sk'] },
    responses: [ResponseItemSchema],
    submittedAt: { type: Date, default: Date.now },
    isAnonymous: { type: Boolean, default: true },

    qualityScore:        { type: Number, min: 0, max: 1 },
    qualityFlags:        [{ type: String }],
    acceptedInAnalysis:  { type: Boolean, default: true },
    timingMsPerItem:     [{ type: Number }],
  },
  { timestamps: true }
);

SurveyResponseSchema.plugin(tenantFilterPlugin);
SurveyResponseSchema.index({ organizationId: 1, templateId: 1 });
// Unique index on token prevents duplicate submissions at the DB level
SurveyResponseSchema.index({ submissionToken: 1 }, { unique: true });

export const SurveyResponse = mongoose.model<ISurveyResponse>('SurveyResponse', SurveyResponseSchema);

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
  submissionToken: string;               // SHA-256(userId + templateId) — used for dedup
  departmentId?: string;
  responses: IResponseItem[];
  submittedAt: Date;
  isAnonymous: boolean;
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
    submissionToken: { type: String, required: true },          // one-way hash, always present
    departmentId: { type: String },
    responses: [ResponseItemSchema],
    submittedAt: { type: Date, default: Date.now },
    isAnonymous: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SurveyResponseSchema.plugin(tenantFilterPlugin);
SurveyResponseSchema.index({ organizationId: 1, templateId: 1 });
// Unique index on token prevents duplicate submissions at the DB level
SurveyResponseSchema.index({ submissionToken: 1 }, { unique: true });

export const SurveyResponse = mongoose.model<ISurveyResponse>('SurveyResponse', SurveyResponseSchema);

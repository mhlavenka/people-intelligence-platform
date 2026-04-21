import mongoose, { Schema, Document } from 'mongoose';

export interface ISurveyAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  userIds: mongoose.Types.ObjectId[];
  departments: string[];
  message?: string;
  createdAt: Date;
}

const SurveyAssignmentSchema = new Schema<ISurveyAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    departments: [{ type: String }],
    message: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

SurveyAssignmentSchema.index({ templateId: 1, organizationId: 1 });

export const SurveyAssignment = mongoose.model<ISurveyAssignment>('SurveyAssignment', SurveyAssignmentSchema);

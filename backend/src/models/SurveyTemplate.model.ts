import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IQuestion {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean';
  category: string;
}

export interface ISurveyTemplate extends Document {
  organizationId?: mongoose.Types.ObjectId;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  intakeType: 'survey' | 'interview' | 'assessment';
  title: string;
  questions: IQuestion[];
  isActive: boolean;
  isGlobal: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['scale', 'text', 'boolean'], required: true },
    category: { type: String, required: true },
  },
  { _id: false }
);

const SurveyTemplateSchema = new Schema<ISurveyTemplate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: false,
      index: true,
    },
    moduleType: {
      type: String,
      enum: ['conflict', 'neuroinclusion', 'succession'],
      required: true,
    },
    intakeType: {
      type: String,
      enum: ['survey', 'interview', 'assessment'],
      default: 'survey',
    },
    title: { type: String, required: true, trim: true },
    questions: [QuestionSchema],
    isActive: { type: Boolean, default: true },
    isGlobal: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true }
);

SurveyTemplateSchema.plugin(tenantFilterPlugin);
SurveyTemplateSchema.index({ organizationId: 1, moduleType: 1 });

export const SurveyTemplate = mongoose.model<ISurveyTemplate>('SurveyTemplate', SurveyTemplateSchema);

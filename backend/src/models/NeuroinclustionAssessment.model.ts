import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IDimension {
  name: string;
  score: number;
  responses: Record<string, unknown>;
}

export interface INeuroinclustionAssessment extends Document {
  organizationId: mongoose.Types.ObjectId;
  respondentRole: string;
  dimensions: IDimension[];
  overallMaturityScore: number;
  aiGapAnalysis: string;
  actionRoadmap: string[];
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DimensionSchema = new Schema<IDimension>(
  {
    name: { type: String, required: true },
    score: { type: Number, required: true },
    responses: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const NeuroinclustionAssessmentSchema = new Schema<INeuroinclustionAssessment>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    respondentRole: { type: String, required: true },
    dimensions: [DimensionSchema],
    overallMaturityScore: { type: Number, required: true },
    aiGapAnalysis: { type: String, required: true },
    actionRoadmap: [{ type: String }],
    completedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

NeuroinclustionAssessmentSchema.plugin(tenantFilterPlugin);
NeuroinclustionAssessmentSchema.index({ organizationId: 1, completedAt: -1 });

export const NeuroinclustionAssessment = mongoose.model<INeuroinclustionAssessment>(
  'NeuroinclustionAssessment',
  NeuroinclustionAssessmentSchema
);

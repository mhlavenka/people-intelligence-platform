import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type EscalationStatus = 'pending' | 'in_progress' | 'resolved' | 'escalated';

export interface IConflictAnalysis extends Document {
  organizationId: mongoose.Types.ObjectId;
  intakeTemplateId?: mongoose.Types.ObjectId;
  name: string;
  departmentId?: string;
  parentId?: mongoose.Types.ObjectId;
  focusConflictType?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  recommendedActions?: {
    immediateActions?: { title: string; description: string; owner: string; priority: string }[];
    shortTermActions?: { title: string; description: string; owner: string; priority: string; timeframe?: string }[];
    longTermActions?: { title: string; description: string; owner: string; priority: string; timeframe?: string }[];
    preventiveMeasures?: string[];
  };
  completedActions?: Record<string, number[]>;
  generatedIntakeIds?: Record<string, string>;
  escalationRequested: boolean;
  escalationStatus?: EscalationStatus;
  escalatedToCoachId?: mongoose.Types.ObjectId;
  escalationMessage?: string;
  professionalReview?: {
    status: 'pending' | 'in_progress' | 'completed';
    notes?: string;
    recommendations?: string;
    reviewedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConflictAnalysisSchema = new Schema<IConflictAnalysis>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    intakeTemplateId: { type: Schema.Types.ObjectId, ref: 'SurveyTemplate' },
    name: { type: String, required: true },
    departmentId: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'ConflictAnalysis', index: true },
    focusConflictType: { type: String },
    riskScore: { type: Number, min: 0, max: 100, required: true },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    conflictTypes: [{ type: String }],
    aiNarrative: { type: String, required: true },
    managerScript: { type: String, required: true },
    recommendedActions: { type: Schema.Types.Mixed },
    completedActions: { type: Schema.Types.Mixed, default: {} },
    generatedIntakeIds: { type: Schema.Types.Mixed, default: {} },
    escalationRequested: { type: Boolean, default: false },
    escalationStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'escalated'],
    },
    escalatedToCoachId: { type: Schema.Types.ObjectId, ref: 'User' },
    escalationMessage: { type: String },
    professionalReview: {
      type: new Schema({
        status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
        notes: String,
        recommendations: String,
        reviewedAt: Date,
      }, { _id: false }),
    },
  },
  { timestamps: true }
);

ConflictAnalysisSchema.plugin(tenantFilterPlugin);
ConflictAnalysisSchema.index({ organizationId: 1, createdAt: -1 });

export const ConflictAnalysis = mongoose.model<IConflictAnalysis>(
  'ConflictAnalysis',
  ConflictAnalysisSchema
);

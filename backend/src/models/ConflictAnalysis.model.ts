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
  escalationRequested: boolean;
  escalationStatus?: EscalationStatus;
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
    escalationRequested: { type: Boolean, default: false },
    escalationStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'escalated'],
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

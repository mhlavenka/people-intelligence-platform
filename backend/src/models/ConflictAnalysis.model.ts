import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type EscalationStatus = 'pending' | 'in_progress' | 'resolved' | 'escalated';

// ─── Layer 1–3 divergence metrics, persisted with each ConflictAnalysis ──
// All optional so legacy analyses keep rendering. The frontend guards on
// presence and falls back to the existing aiNarrative + risk score view.

export interface IResponseQuality {
  totalSubmitted: number;
  acceptedCount: number;
  droppedCount: number;
  droppedReasons: {
    straightlining?: number;
    longString?: number;
    speeding?: number;
    trapFailed?: number;
  };
}

export interface IItemMetric {
  questionId: string;
  text?: string;
  dimension?: string;
  mean: number;
  median: number;
  sd: number;
  iqr: number;
  bimodalityCoef: number;        // BC > 0.555 ⇒ likely bimodal ("split")
  entropy: number;               // Shannon, base e
  rwg: number;                   // James-Demaree-Wolf within-group agreement
  outlierCount: number;          // respondents flagged via modified-Z > 3.5
  scaleMin?: number;
  scaleMax?: number;
}

export interface IDimensionMetric {
  dimension: string;             // 'Psychological Safety', 'Trust', ... or 'Ungrouped'
  itemCount: number;
  mean: number;
  rwg: number;
  disagreementScore: number;     // 0-100 (100 = max disagreement)
  mostDivergentItemIds: string[];
}

export interface IClusterStat {
  label: string;                              // 'A', 'B', 'C'
  size: number;                               // ≥ minSubgroupN, never publishes IDs
  meanByDimension: Record<string, number>;    // per-dimension mean for this cluster
  distinguishingItemIds: string[];            // items where this cluster differs most
}

export interface ISubgroupAnalysis {
  k: number;                                  // chosen cluster count (2 or 3)
  silhouette: number;                         // ≥0.5 to be considered significant
  clusters: IClusterStat[];
}

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

  // Layer 1–3 divergence metrics (all optional — legacy analyses render fine)
  responseQuality?: IResponseQuality;
  itemMetrics?: IItemMetric[];
  dimensionMetrics?: IDimensionMetric[];
  teamAlignmentScore?: number;       // 0-100, Layer 5 dashboard tile

  // Layer 4 subgroup analysis (Phase 2). Present only when N≥10, the chosen
  // k yields silhouette ≥0.5, AND every cluster has ≥3 members. Absence is
  // rendered in the UI as "no significant subgroups detected".
  subgroupAnalysis?: ISubgroupAnalysis;

  // Audit view (§8.4): the same metric blocks recomputed on ALL submitted
  // responses, ignoring per-response quality and cohort speeders. Persisted
  // only when at least one response was filtered out (otherwise the audit
  // view would be identical to the filtered view, and the toggle hides).
  // The AI narrative is generated once from the filtered set — never from
  // this view — so this is admin audit only.
  unfilteredMetrics?: {
    responseQuality: IResponseQuality;
    itemMetrics: IItemMetric[];
    dimensionMetrics: IDimensionMetric[];
    teamAlignmentScore: number;
    subgroupAnalysis?: ISubgroupAnalysis;
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

    // Stored as Mixed so we don't pay schema-validation overhead on every
    // numeric field; the controller is the single writer and the shape is
    // pinned by IItemMetric / IDimensionMetric / IResponseQuality interfaces.
    responseQuality:    { type: Schema.Types.Mixed },
    itemMetrics:        { type: [Schema.Types.Mixed], default: undefined },
    dimensionMetrics:   { type: [Schema.Types.Mixed], default: undefined },
    teamAlignmentScore: { type: Number, min: 0, max: 100 },
    subgroupAnalysis:   { type: Schema.Types.Mixed },
    unfilteredMetrics:  { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ConflictAnalysisSchema.plugin(tenantFilterPlugin);
ConflictAnalysisSchema.index({ organizationId: 1, createdAt: -1 });

export const ConflictAnalysis = mongoose.model<IConflictAnalysis>(
  'ConflictAnalysis',
  ConflictAnalysisSchema
);

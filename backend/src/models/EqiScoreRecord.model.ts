import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IEqiScoreRecord extends Document {
  organizationId: mongoose.Types.ObjectId;
  importId: string;
  privacyMode: 'IDENTIFIED' | 'PSEUDONYMIZED' | 'ANONYMIZED';
  // Identity fields (Mode A only — encrypted at rest)
  clientName?: string;
  clientEmail?: string;
  clientRole?: string;
  clientOrganization?: string;
  // Pseudonymized (Mode B)
  clientCode?: string;
  // Shared metadata
  roleLevel?: string;
  industrySector?: string;
  coachingGoals?: string[];
  reportType: string;
  assessmentYear: number | null;
  normGroup?: string;
  // Scores
  subscaleScores: Record<string, number>;
  compositeScores: Record<string, number>;
  totalEI: number | null;
  wellBeingIndicator: number | null;
  // 360 observer scores (if applicable)
  observerCompositeScores?: Record<string, number>;
  // Consent (Mode A)
  consentObtained: boolean;
  consentDate?: Date;
  consentMethod?: string;
  // Status
  requiresManualReview: boolean;
  reviewReasons: string[];
  createdAt: Date;
  updatedAt: Date;
}

const EqiScoreRecordSchema = new Schema<IEqiScoreRecord>(
  {
    organizationId:         { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    importId:               { type: String, required: true },
    privacyMode:            { type: String, required: true, enum: ['IDENTIFIED', 'PSEUDONYMIZED', 'ANONYMIZED'] },
    clientName:             { type: String },
    clientEmail:            { type: String },
    clientRole:             { type: String },
    clientOrganization:     { type: String },
    clientCode:             { type: String },
    roleLevel:              { type: String },
    industrySector:         { type: String },
    coachingGoals:          [{ type: String }],
    reportType:             { type: String },
    assessmentYear:         { type: Number },
    normGroup:              { type: String },
    subscaleScores:         { type: Schema.Types.Mixed, default: {} },
    compositeScores:        { type: Schema.Types.Mixed, default: {} },
    totalEI:                { type: Number },
    wellBeingIndicator:     { type: Number },
    observerCompositeScores:{ type: Schema.Types.Mixed },
    consentObtained:        { type: Boolean, default: false },
    consentDate:            { type: Date },
    consentMethod:          { type: String },
    requiresManualReview:   { type: Boolean, default: false },
    reviewReasons:          [{ type: String }],
  },
  { timestamps: true }
);

EqiScoreRecordSchema.plugin(tenantFilterPlugin);
EqiScoreRecordSchema.index({ organizationId: 1, importId: 1 });

export const EqiScoreRecord = mongoose.model<IEqiScoreRecord>('EqiScoreRecord', EqiScoreRecordSchema);

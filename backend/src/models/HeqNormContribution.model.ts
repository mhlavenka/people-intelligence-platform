import mongoose, { Document, Schema } from 'mongoose';

export interface IHeqNormContribution extends Document {
  contributionId: string;
  source: 'mhs_imported' | 'heq_native';
  assessmentYear: number;
  industrySector: string;
  roleLevel: string;
  normGroup: string;
  subscaleScores: Record<string, number>;
  compositeScores: Record<string, number>;
  totalEI: number;
  wellBeingIndicator: number;
  createdAt: Date;
}

const HeqNormContributionSchema = new Schema<IHeqNormContribution>(
  {
    contributionId:    { type: String, required: true, unique: true },
    source:            { type: String, required: true, enum: ['mhs_imported', 'heq_native'] },
    assessmentYear:    { type: Number },
    industrySector:    { type: String },
    roleLevel:         { type: String },
    normGroup:         { type: String },
    subscaleScores:    { type: Schema.Types.Mixed, default: {} },
    compositeScores:   { type: Schema.Types.Mixed, default: {} },
    totalEI:           { type: Number },
    wellBeingIndicator:{ type: Number },
  },
  { timestamps: true }
);

// No organizationId — fully anonymized, no tenant linkage
// No tenantFilterPlugin — intentionally global

export const HeqNormContribution = mongoose.model<IHeqNormContribution>('HeqNormContribution', HeqNormContributionSchema);

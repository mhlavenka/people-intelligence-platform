import mongoose, { Document, Schema } from 'mongoose';

export interface IPlanLimits {
  maxAIAnalyses: number;         // AI analyses per month (0 = unlimited)
  maxSurveyResponses: number;    // survey responses per month (0 = unlimited)
  maxCoachingSessions: number;   // coaching sessions included per year (0 = unlimited)
  maxFileStorageMB: number;      // file storage in MB (0 = unlimited)
}

export interface IPlan extends Document {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;          // cents / month
  overagePriceCents: number;     // cents per extra user / month
  maxUsers: number;              // included seats
  modules: string[];             // included module keys: 'conflict', 'neuroinclusion', 'succession'
  limits: IPlanLimits;           // usage caps
  features: string[];            // display feature list
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanLimitsSchema = new Schema({
  maxAIAnalyses:       { type: Number, default: 0, min: 0 },
  maxSurveyResponses:  { type: Number, default: 0, min: 0 },
  maxCoachingSessions: { type: Number, default: 0, min: 0 },
  maxFileStorageMB:    { type: Number, default: 0, min: 0 },
}, { _id: false });

const PlanSchema = new Schema<IPlan>(
  {
    key:               { type: String, required: true, unique: true, trim: true, lowercase: true },
    name:              { type: String, required: true, trim: true },
    description:       { type: String, default: '' },
    priceMonthly:      { type: Number, required: true, min: 0 },
    overagePriceCents: { type: Number, required: true, min: 0, default: 1500 },
    maxUsers:          { type: Number, required: true, min: 1, default: 10 },
    modules:           { type: [String], default: [] },
    limits:            { type: PlanLimitsSchema, default: () => ({}) },
    features:          { type: [String], default: [] },
    isActive:          { type: Boolean, default: true },
    sortOrder:         { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);

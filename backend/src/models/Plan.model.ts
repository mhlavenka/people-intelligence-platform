import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;        // cents / month
  overagePriceCents: number;   // cents per extra user / month
  maxUsers: number;            // included seats
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    key:               { type: String, required: true, unique: true, trim: true, lowercase: true },
    name:              { type: String, required: true, trim: true },
    description:       { type: String, default: '' },
    priceMonthly:      { type: Number, required: true, min: 0 },
    overagePriceCents: { type: Number, required: true, min: 0, default: 1500 },
    maxUsers:          { type: Number, required: true, min: 1, default: 10 },
    features:          { type: [String], default: [] },
    isActive:          { type: Boolean, default: true },
    sortOrder:         { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);

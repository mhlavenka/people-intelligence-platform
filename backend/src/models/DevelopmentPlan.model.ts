import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IMilestone {
  _id?: mongoose.Types.ObjectId;
  title: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

export interface IDevelopmentPlan extends Document {
  organizationId: mongoose.Types.ObjectId;
  coacheeId: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;
  goal: string;
  currentReality: string;
  options: string[];
  willDoActions: string[];
  milestones: IMilestone[];
  eqiScores: Record<string, number>;
  competencyGaps: string[];
  aiGeneratedContent: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
  },
  notes: { type: String },
});

const DevelopmentPlanSchema = new Schema<IDevelopmentPlan>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    coacheeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    coachId: { type: Schema.Types.ObjectId, ref: 'User' },
    goal: { type: String, required: true },
    currentReality: { type: String, default: '' },
    options: [{ type: String }],
    willDoActions: [{ type: String }],
    milestones: [MilestoneSchema],
    eqiScores: { type: Schema.Types.Mixed, default: {} },
    competencyGaps: [{ type: String }],
    aiGeneratedContent: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

DevelopmentPlanSchema.plugin(tenantFilterPlugin);
DevelopmentPlanSchema.index({ organizationId: 1, coacheeId: 1 });

export const DevelopmentPlan = mongoose.model<IDevelopmentPlan>(
  'DevelopmentPlan',
  DevelopmentPlanSchema
);

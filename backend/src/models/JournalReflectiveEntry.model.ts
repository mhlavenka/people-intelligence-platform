import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type JournalMood = 'energized' | 'reflective' | 'challenged' | 'inspired' | 'depleted';

export interface IJournalReflectiveEntry extends Document {
  organizationId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  entryDate: Date;
  title: string;
  body: string;
  mood: JournalMood;
  tags: string[];
  linkedEngagementIds: mongoose.Types.ObjectId[];
  isSupervisionReady: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JournalReflectiveEntrySchema = new Schema<IJournalReflectiveEntry>(
  {
    organizationId:     { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    coachId:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entryDate:          { type: Date, required: true },
    title:              { type: String, required: true, trim: true },
    body:               { type: String, default: '' },
    mood: {
      type: String,
      enum: ['energized', 'reflective', 'challenged', 'inspired', 'depleted'],
      default: 'reflective',
    },
    tags:                [{ type: String }],
    linkedEngagementIds: [{ type: Schema.Types.ObjectId, ref: 'CoachingEngagement' }],
    isSupervisionReady:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

JournalReflectiveEntrySchema.plugin(tenantFilterPlugin);
JournalReflectiveEntrySchema.index({ organizationId: 1, coachId: 1, entryDate: -1 });

export const JournalReflectiveEntry = mongoose.model<IJournalReflectiveEntry>('JournalReflectiveEntry', JournalReflectiveEntrySchema);

import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IJournalEntry extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;        // who wrote the entry
  idpId?: mongoose.Types.ObjectId;        // optional link to an IDP
  prompt?: string;                        // AI-generated or preset prompt
  content: string;                        // the journal text
  mood?: number;                          // 1-10 self-rating
  tags?: string[];                        // user-defined or auto-detected themes
  createdAt: Date;
  updatedAt: Date;
}

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    idpId:          { type: Schema.Types.ObjectId, ref: 'DevelopmentPlan' },
    prompt:         { type: String },
    content:        { type: String, required: true },
    mood:           { type: Number, min: 1, max: 10 },
    tags:           [{ type: String, trim: true }],
  },
  { timestamps: true }
);

JournalEntrySchema.plugin(tenantFilterPlugin);
JournalEntrySchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

export const JournalEntry = mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);

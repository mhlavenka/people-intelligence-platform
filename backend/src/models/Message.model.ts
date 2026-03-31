import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface IMessage extends Document {
  organizationId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fromUserId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content:        { type: String, required: true, trim: true, maxlength: 4000 },
    isRead:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.plugin(tenantFilterPlugin);
MessageSchema.index({ organizationId: 1, toUserId: 1, isRead: 1 });
MessageSchema.index({ organizationId: 1, fromUserId: 1, toUserId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

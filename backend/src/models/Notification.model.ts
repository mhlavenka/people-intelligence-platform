import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type NotificationType =
  | 'idp_generated'
  | 'survey_response'
  | 'conflict_alert'
  | 'message'
  | 'system';

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;        // recipient
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;                          // frontend route to navigate to on click
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type:           {
      type: String,
      enum: ['idp_generated', 'survey_response', 'conflict_alert', 'message', 'system'],
      required: true,
    },
    title:  { type: String, required: true, trim: true },
    body:   { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    link:   { type: String },
  },
  { timestamps: true }
);

NotificationSchema.plugin(tenantFilterPlugin);
NotificationSchema.index({ organizationId: 1, userId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

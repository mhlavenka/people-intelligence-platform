import mongoose, { Document, Schema } from 'mongoose';

/**
 * One document per coach × watched calendar. Tracks the Google push
 * notification channel we registered so we can renew it before expiry
 * and stop it when the coach disconnects.
 *
 * Intentionally NOT tenant-scoped — webhook lookups by channelId must
 * work without a tenant context (Google calls us directly).
 */
export interface IWebhookState extends Document {
  coachId: mongoose.Types.ObjectId;
  calendarId: string;
  channelId: string;       // our opaque id sent to Google (X-Goog-Channel-ID on callbacks)
  resourceId: string;      // Google's opaque resource id (returned from watch())
  expiration: Date;        // channel TTL (Google caps around 30 days, default ~7d)
  lastProcessedAt: Date;   // last time we synced events.list(updatedMin=...)
  createdAt: Date;
  updatedAt: Date;
}

const WebhookStateSchema = new Schema<IWebhookState>(
  {
    coachId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    calendarId:      { type: String, required: true },
    channelId:       { type: String, required: true, unique: true, index: true },
    resourceId:      { type: String, required: true, index: true },
    expiration:      { type: Date, required: true, index: true },
    lastProcessedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

WebhookStateSchema.index({ coachId: 1, calendarId: 1 }, { unique: true });

export const WebhookState = mongoose.model<IWebhookState>('WebhookState', WebhookStateSchema);

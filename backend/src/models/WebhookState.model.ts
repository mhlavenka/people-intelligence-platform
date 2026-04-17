import mongoose, { Document, Schema } from 'mongoose';

/**
 * One document per coach × watched calendar. Tracks push notification
 * channels (Google) or subscriptions (Microsoft) so we can renew before
 * expiry and stop when the coach disconnects.
 *
 * Intentionally NOT tenant-scoped — webhook lookups by channelId must
 * work without a tenant context (providers call us directly).
 */
export interface IWebhookState extends Document {
  coachId: mongoose.Types.ObjectId;
  calendarId: string;
  provider: 'google' | 'microsoft';
  channelId: string;           // Google: our opaque id; Microsoft: Graph subscription id
  resourceId: string;          // Google: resourceId from watch(); Microsoft: not used (empty string)
  expiration: Date;            // Google caps ~30 days; Microsoft caps ~3 days
  lastProcessedAt: Date;       // Google: updatedMin anchor; Microsoft: deltaLink anchor
  deltaLink?: string;          // Microsoft only: delta token for incremental sync
  createdAt: Date;
  updatedAt: Date;
}

const WebhookStateSchema = new Schema<IWebhookState>(
  {
    coachId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    calendarId:      { type: String, required: true },
    provider:        { type: String, enum: ['google', 'microsoft'], default: 'google' },
    channelId:       { type: String, required: true, unique: true, index: true },
    resourceId:      { type: String, required: true, index: true },
    expiration:      { type: Date, required: true, index: true },
    lastProcessedAt: { type: Date, default: () => new Date() },
    deltaLink:       { type: String },
  },
  { timestamps: true },
);

WebhookStateSchema.index({ coachId: 1, calendarId: 1 }, { unique: true });

export const WebhookState = mongoose.model<IWebhookState>('WebhookState', WebhookStateSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface ILoginSession extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  sessionId: string;
  tokenHash: string;
  device: string;
  ip: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoginSessionSchema = new Schema<ILoginSession>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    sessionId:      { type: String, required: true },
    tokenHash:      { type: String, required: true },
    device:         { type: String, default: 'Unknown device' },
    ip:             { type: String, default: '' },
    lastActiveAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LoginSessionSchema.index({ userId: 1, sessionId: 1 });
LoginSessionSchema.index({ organizationId: 1 });
LoginSessionSchema.index({ tokenHash: 1 });
// TTL index — initial value matches the AppSettings.sessionPolicy default
// (autoLogoutMinutes = 30). Synced at startup and on settings change via
// syncLoginSessionTTL() which uses collMod to update expireAfterSeconds in
// place without dropping/recreating the index.
LoginSessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 30 * 60 });

export const LoginSession = mongoose.model<ILoginSession>('LoginSession', LoginSessionSchema);

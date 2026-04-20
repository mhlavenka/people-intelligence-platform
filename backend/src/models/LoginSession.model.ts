import mongoose, { Document, Schema } from 'mongoose';

export interface ILoginSession extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
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
    tokenHash:      { type: String, required: true },
    device:         { type: String, default: 'Unknown device' },
    ip:             { type: String, default: '' },
    lastActiveAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LoginSessionSchema.index({ userId: 1 });
LoginSessionSchema.index({ organizationId: 1 });
LoginSessionSchema.index({ tokenHash: 1 }, { unique: true });
LoginSessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const LoginSession = mongoose.model<ILoginSession>('LoginSession', LoginSessionSchema);

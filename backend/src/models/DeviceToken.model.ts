import mongoose, { Document, Schema } from 'mongoose';

export interface IDeviceToken extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  token: string;
  platform: 'android' | 'ios' | 'web';
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    token:          { type: String, required: true },
    platform:       { type: String, enum: ['android', 'ios', 'web'], required: true },
  },
  { timestamps: true }
);

DeviceTokenSchema.index({ userId: 1 });
DeviceTokenSchema.index({ token: 1 }, { unique: true });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);

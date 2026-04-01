import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type UserRole = 'admin' | 'hr_manager' | 'manager' | 'coachee' | 'coach' | 'system_admin';

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  department?: string;
  managerId?: mongoose.Types.ObjectId;
  lastLoginAt?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'hr_manager', 'manager', 'coachee', 'coach', 'system_admin'],
      required: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    department: { type: String, trim: true, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date },
    twoFactorSecret:  { type: String, select: false }, // never returned in normal queries
    twoFactorEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.plugin(tenantFilterPlugin);
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);

import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export type UserRole = 'admin' | 'hr_manager' | 'manager' | 'coachee' | 'coach' | 'system_admin';

export interface IPasskeyCredential {
  credentialId: string;           // base64url-encoded credential ID
  publicKey: string;              // base64url-encoded public key
  counter: number;                // signature counter for replay detection
  deviceType: string;             // 'singleDevice' | 'multiDevice'
  transports?: string[];          // e.g. ['usb', 'ble', 'nfc', 'internal']
  createdAt: Date;
  label?: string;                 // user-friendly name, e.g. "MacBook Touch ID"
}

export interface IOAuthAccount {
  provider: 'google' | 'microsoft';
  providerId: string;             // unique ID from provider
  email: string;                  // email from OAuth profile
  linkedAt: Date;
}

export interface IGoogleCalendar {
  connected: boolean;
  calendarId?: string;
  calendarName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  customRoleId?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  isActive: boolean;
  department?: string;
  managerId?: mongoose.Types.ObjectId;
  lastLoginAt?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  passkeys: IPasskeyCredential[];
  oauthAccounts: IOAuthAccount[];
  profilePicture?: string;
  googleCalendar?: IGoogleCalendar;
  createdAt: Date;
  updatedAt: Date;
}

const PasskeyCredentialSchema = new Schema({
  credentialId: { type: String, required: true },
  publicKey:    { type: String, required: true },
  counter:      { type: Number, default: 0 },
  deviceType:   { type: String, default: 'multiDevice' },
  transports:   [{ type: String }],
  createdAt:    { type: Date, default: Date.now },
  label:        { type: String },
}, { _id: false });

const OAuthAccountSchema = new Schema({
  provider:   { type: String, required: true, enum: ['google', 'microsoft'] },
  providerId: { type: String, required: true },
  email:      { type: String, required: true },
  linkedAt:   { type: Date, default: Date.now },
}, { _id: false });

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
    customRoleId: { type: Schema.Types.ObjectId, ref: 'CustomRole', default: null },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    department: { type: String, trim: true, default: null },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastLoginAt: { type: Date },
    profilePicture:   { type: String },
    twoFactorSecret:  { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    passkeys:      [PasskeyCredentialSchema],
    oauthAccounts: [OAuthAccountSchema],
    googleCalendar: {
      connected:    { type: Boolean, default: false },
      calendarId:   { type: String },
      calendarName: { type: String },
      accessToken:  { type: String, select: false },
      refreshToken: { type: String, select: false },
      tokenExpiry:  { type: Date },
    },
  },
  { timestamps: true }
);

UserSchema.plugin(tenantFilterPlugin);
UserSchema.index({ organizationId: 1, email: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);

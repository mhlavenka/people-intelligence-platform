import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export interface ILoginPolicy {
  maxLoginAttempts: number;           // 0 = unlimited
  lockoutDurationMinutes: number;     // after max attempts
  twoFactorEnforced: boolean;         // force all users to enable 2FA
}

export interface ISessionPolicy {
  autoLogoutMinutes: number;          // inactivity timeout (0 = disabled)
  showLogoutWarning: boolean;         // show warning before auto-logout
  logoutWarningSeconds: number;       // how many seconds before logout to warn
  maxConcurrentSessions: number;      // 0 = unlimited
}

export interface ITokenPolicy {
  accessTokenExpiresIn: string;       // e.g. '15m', '1h'
  refreshTokenExpiresIn: string;      // e.g. '7d', '30d'
}

export interface IGeneralSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultTimezone: string;
  dataRetentionDays: number;          // 0 = indefinite
  maxFileUploadMB: number;
}

export interface IAppSettings extends Document {
  passwordPolicy: IPasswordPolicy;
  loginPolicy: ILoginPolicy;
  sessionPolicy: ISessionPolicy;
  tokenPolicy: ITokenPolicy;
  general: IGeneralSettings;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const PasswordPolicySchema = new Schema({
  minLength:            { type: Number,  default: 8 },
  requireUppercase:     { type: Boolean, default: true },
  requireLowercase:     { type: Boolean, default: true },
  requireNumbers:       { type: Boolean, default: true },
  requireSpecialChars:  { type: Boolean, default: false },
}, { _id: false });

const LoginPolicySchema = new Schema({
  maxLoginAttempts:       { type: Number,  default: 5 },
  lockoutDurationMinutes: { type: Number,  default: 15 },
  twoFactorEnforced:      { type: Boolean, default: false },
}, { _id: false });

const SessionPolicySchema = new Schema({
  autoLogoutMinutes:      { type: Number,  default: 30 },
  showLogoutWarning:      { type: Boolean, default: true },
  logoutWarningSeconds:   { type: Number,  default: 120 },
  maxConcurrentSessions:  { type: Number,  default: 0 },
}, { _id: false });

const TokenPolicySchema = new Schema({
  accessTokenExpiresIn:   { type: String, default: '15m' },
  refreshTokenExpiresIn:  { type: String, default: '7d' },
}, { _id: false });

const GeneralSettingsSchema = new Schema({
  maintenanceMode:    { type: Boolean, default: false },
  maintenanceMessage: { type: String,  default: 'The platform is currently undergoing maintenance. Please try again shortly.' },
  defaultTimezone:    { type: String,  default: 'UTC' },
  dataRetentionDays:  { type: Number,  default: 0 },
  maxFileUploadMB:    { type: Number,  default: 10 },
}, { _id: false });

const AppSettingsSchema = new Schema(
  {
    passwordPolicy: { type: PasswordPolicySchema, default: () => ({}) },
    loginPolicy:    { type: LoginPolicySchema,    default: () => ({}) },
    sessionPolicy:  { type: SessionPolicySchema,  default: () => ({}) },
    tokenPolicy:    { type: TokenPolicySchema,    default: () => ({}) },
    general:        { type: GeneralSettingsSchema, default: () => ({}) },
    updatedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

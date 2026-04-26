import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/**
 * Per-org overrides for system role permissions.
 * If an override exists for a role, it replaces the default SYSTEM_ROLE_PERMISSIONS.
 * If no override exists, the defaults from permissions.ts are used.
 */
export interface ISystemRoleOverride extends Document {
  organizationId: mongoose.Types.ObjectId;
  role: string;                // 'admin' | 'hr_manager' | 'manager' | 'coach' | 'employee' | 'coachee'
  permissions: string[];       // overridden permission keys
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SystemRoleOverrideSchema = new Schema<ISystemRoleOverride>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    role:           { type: String, required: true },
    permissions:    [{ type: String }],
    updatedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SystemRoleOverrideSchema.plugin(tenantFilterPlugin);
SystemRoleOverrideSchema.index({ organizationId: 1, role: 1 }, { unique: true });

export const SystemRoleOverride = mongoose.model<ISystemRoleOverride>('SystemRoleOverride', SystemRoleOverrideSchema);

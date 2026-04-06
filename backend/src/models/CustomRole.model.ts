import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

export interface ICustomRole extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  color?: string;        // hex color for UI display, e.g. "#3A9FD6"
  baseRole: string;      // system role used for requireRole() compatibility
  permissions: string[]; // fine-grained PERMISSION_KEYS this role grants
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomRoleSchema = new Schema<ICustomRole>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    color:       { type: String, default: '#5a6a7e' },
    baseRole: {
      type: String,
      enum: ['admin', 'hr_manager', 'manager', 'coach', 'coachee'],
      required: true,
    },
    permissions: [{ type: String }],
    createdBy:   { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

CustomRoleSchema.plugin(tenantFilterPlugin);
CustomRoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const CustomRole = mongoose.model<ICustomRole>('CustomRole', CustomRoleSchema);

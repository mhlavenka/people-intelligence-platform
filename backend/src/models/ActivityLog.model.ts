import mongoose, { Document, Schema } from 'mongoose';
import { tenantFilterPlugin } from './plugins/tenantFilter.plugin';

/**
 * Append-only org activity log. Captures events that don't leave a trace
 * elsewhere — auth (login / logout / password change / 2FA), permission /
 * role flips, lifecycle changes (deactivate, suspend), email sends, and
 * any setting edit that would otherwise just bump an updatedAt timestamp.
 *
 * Domain CRUD that already produces a record in its own collection
 * (SurveyResponse, ConflictAnalysis, CoachingSession, …) is still
 * surfaced through the read-time aggregator on /dashboard/activity —
 * we don't double-write those.
 *
 * Always per-org. System-admin actions targeting another org are written
 * to the **target** org's log, not the actor's home org.
 */
export interface IActivityLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  actorUserId?: mongoose.Types.ObjectId;     // null for system / webhook events
  type: string;                              // free-form key, e.g. 'auth.login', 'survey.template.deleted'
  label: string;                             // human readable headline ("Survey template deleted")
  detail?: string;                           // optional context ("HNP Pulse — by Marek H.")
  refModel?: string;                         // optional pointer model ("SurveyTemplate")
  refId?: mongoose.Types.ObjectId;           // optional pointer id
  metadata?: Record<string, unknown>;        // optional structured extras (ip, planKey, amountCents…)
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    actorUserId:    { type: Schema.Types.ObjectId, ref: 'User' },
    type:           { type: String, required: true, trim: true, index: true },
    label:          { type: String, required: true, trim: true },
    detail:         { type: String, trim: true },
    refModel:       { type: String, trim: true },
    refId:          { type: Schema.Types.ObjectId },
    metadata:       { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActivityLogSchema.plugin(tenantFilterPlugin);
ActivityLogSchema.index({ organizationId: 1, createdAt: -1 });
ActivityLogSchema.index({ organizationId: 1, type: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);

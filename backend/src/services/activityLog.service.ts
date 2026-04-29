import mongoose from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.model';

export interface LogActivityInput {
  /** Org the event belongs to. For system-admin actions on another org,
   *  this MUST be the *target* org, not the actor's home org. Required. */
  org: mongoose.Types.ObjectId | string;
  /** User who triggered the action. Omit for unauthenticated / system /
   *  webhook events (Stripe payment, calendar sync, cron job). */
  actor?: mongoose.Types.ObjectId | string | null;
  /** Free-form event key. Convention: domain.action — e.g. 'auth.login',
   *  'survey.template.deleted', 'org.settings.updated'. */
  type: string;
  /** Human-readable headline shown in the activity feed. */
  label: string;
  /** Optional context line. Keep short (~80 chars). */
  detail?: string;
  /** Optional reference to the affected document. */
  refModel?: string;
  refId?: mongoose.Types.ObjectId | string | null;
  /** Optional structured extras (ip, planKey, amountCents, …). */
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity logger. **Never throws** — a logging failure
 * must not break the underlying write. Errors are swallowed and emitted
 * as console.error so a misconfigured call surfaces in PM2 logs without
 * impacting the request path.
 *
 * Always per-org: every entry carries organizationId. The collection
 * has the tenantFilter plugin so reads are also tenant-scoped.
 */
export function logActivity(input: LogActivityInput): void {
  // Validate cheaply — bad input shouldn't throw, just no-op.
  if (!input.org || !input.type || !input.label) {
    console.error('[activityLog] missing required field', { input });
    return;
  }

  const doc = {
    organizationId: toObjectId(input.org),
    actorUserId: input.actor ? toObjectId(input.actor) : undefined,
    type: input.type,
    label: input.label,
    detail: input.detail,
    refModel: input.refModel,
    refId: input.refId ? toObjectId(input.refId) : undefined,
    metadata: input.metadata,
  };

  // Don't await — caller never blocks on the log write.
  ActivityLog.create(doc).catch((err) => {
    console.error('[activityLog] write failed', { type: input.type, err: err?.message });
  });
}

function toObjectId(v: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  return typeof v === 'string' ? new mongoose.Types.ObjectId(v) : v;
}

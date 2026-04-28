/**
 * Shared dispatch logic for SurveyAssignment.
 *
 * Used by:
 *   - POST /surveys/templates/:id/assign     — initial fire on creation
 *   - cron job surveyScheduler.job.ts        — recurring fires
 *
 * Re-resolves department membership at fire time so additions to the
 * department since the assignment was created automatically receive the
 * survey. Sends a hub notification + email per recipient. Cycle-aware:
 * when a `cycle` stamp is provided, the intake link includes ?cycle=<stamp>
 * so each cycle's submissions are dedup'd independently from prior cycles.
 */

import mongoose from 'mongoose';
import { ISurveyAssignment } from '../models/SurveyAssignment.model';
import { ISurveyTemplate } from '../models/SurveyTemplate.model';
import { User } from '../models/User.model';
import { createHubNotification } from '../services/hubNotification.service';
import { sendEmail } from '../services/email.service';
import { config } from '../config/env';

export interface DispatchOptions {
  /** When set, identifies the recurring cycle (used in token + link). */
  cycle?: string;
  /** Whether to send email in addition to the hub notification. Default true. */
  sendEmail?: boolean;
}

export interface DispatchResult {
  recipientCount: number;
  notifiedCount: number;
  emailedCount: number;
}

export async function dispatchAssignment(
  assignment: ISurveyAssignment,
  template: Pick<ISurveyTemplate, '_id' | 'title' | 'organizationId'>,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const orgId = assignment.organizationId;
  const userIds = (assignment.userIds ?? []).map((id) => id.toString());
  const departments = assignment.departments ?? [];

  // Re-resolve department members fresh — capture users who joined the
  // department after the assignment was first created.
  const recipientSet = new Set<string>(userIds);
  if (departments.length > 0) {
    const deptUsers = await User.find({
      organizationId: orgId,
      department: { $in: departments },
    }).select('_id firstName email preferredLanguage').lean();
    for (const u of deptUsers) recipientSet.add(u._id.toString());
  }

  // For email recipients, fetch user contact info once.
  const recipientIds = Array.from(recipientSet).map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find({ _id: { $in: recipientIds } })
    .select('_id email firstName preferredLanguage')
    .lean();

  const cycleParam = options.cycle ? `?cycle=${encodeURIComponent(options.cycle)}` : '';
  const intakePath = `/intake/${template._id}${cycleParam}`;
  const intakeUrl = `${config.frontendUrl}${intakePath}`;

  const wantsEmail = options.sendEmail !== false;
  const message = assignment.message;
  const title = template.title;

  let notifiedCount = 0;
  let emailedCount = 0;

  await Promise.allSettled(
    users.map(async (u) => {
      // Hub notification (always)
      try {
        await createHubNotification({
          userId: u._id.toString(),
          organizationId: orgId,
          type: 'survey_response',
          title,
          body: message || `You have been assigned a new intake: ${title}`,
          link: intakePath,
          category: 'surveyAssigned',
        });
        notifiedCount++;
      } catch (err) {
        console.warn('[SurveyDispatch] Hub notification failed:', err);
      }

      // Email (when enabled and address present)
      if (wantsEmail && u.email) {
        try {
          await sendEmail({
            to: u.email,
            subject: title,
            html: `<h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">${title}</h2>
                   <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
                     Hi ${u.firstName ?? ''}, you've been asked to complete this intake.
                   </p>
                   ${message ? `<p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">${message}</p>` : ''}
                   <a href="${intakeUrl}"
                      style="display:inline-block;background:#3A9FD6;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
                     Open intake
                   </a>`,
            language: u.preferredLanguage || 'en',
          });
          emailedCount++;
        } catch (err) {
          console.warn(`[SurveyDispatch] Email to ${u.email} failed:`, err);
        }
      }
    }),
  );

  return {
    recipientCount: recipientSet.size,
    notifiedCount,
    emailedCount,
  };
}

// ─── Cron-side helpers ──────────────────────────────────────────────────────

/**
 * Compute the next fire time given a recurrence config and a base date
 * (typically the just-fired moment, or the assignment startsAt for the
 * first calculation).
 *
 *   - Without dayOfWeek: simply base + intervalWeeks * 7 days (same time-of-day)
 *   - With dayOfWeek + hourOfDay: snap to that weekday + hour, then advance
 *     intervalWeeks weeks if the snap landed in the past
 */
export function computeNextFireAt(
  base: Date,
  intervalWeeks: number,
  dayOfWeek?: number,
  hourOfDay?: number,
): Date {
  const next = new Date(base);

  if (typeof dayOfWeek === 'number') {
    // Snap to the next configured weekday at hourOfDay.
    const targetHour = typeof hourOfDay === 'number' ? hourOfDay : 9;
    next.setHours(targetHour, 0, 0, 0);
    // Days to add to reach target weekday (0 if already on it but past hour).
    const daysAhead = (dayOfWeek - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + daysAhead);
    // If we landed in the past (same day, past hour), bump one week.
    if (next.getTime() <= base.getTime()) {
      next.setDate(next.getDate() + 7);
    }
    // Now advance the configured interval - 1 (we already moved to "next week").
    if (intervalWeeks > 1) {
      next.setDate(next.getDate() + (intervalWeeks - 1) * 7);
    }
  } else {
    next.setTime(base.getTime() + intervalWeeks * 7 * 24 * 60 * 60 * 1000);
  }

  return next;
}

import cron from 'node-cron';
import { SurveyAssignment } from '../models/SurveyAssignment.model';
import { SurveyTemplate } from '../models/SurveyTemplate.model';
import { dispatchAssignment, computeNextFireAt } from '../services/surveyDispatch.service';

/**
 * Hourly sweep that fires recurring SurveyAssignments whose nextFireAt has
 * passed. Runs at 5 minutes past the hour to avoid contention with other
 * top-of-hour jobs.
 *
 * For each due assignment:
 *   - Skip if paused, past endsAt, or hit maxOccurrences
 *   - Re-resolve recipients fresh (department members at fire time)
 *   - Dispatch hub notification + email per recipient with a unique cycle stamp
 *   - Advance occurrencesFired, lastFiredAt, nextFireAt
 *
 * If maxOccurrences was reached or endsAt has passed, nextFireAt is cleared
 * so the assignment naturally drops out of the cron filter.
 */
export function startSurveySchedulerJob(): void {
  cron.schedule('5 * * * *', () => {
    runSurveyScheduler().catch((err) =>
      console.error('[SurveyScheduler] Sweep failed:', err),
    );
  });
  console.log('[SurveyScheduler] Hourly recurring-assignment job started (HH:05)');
}

export async function runSurveyScheduler(now: Date = new Date()): Promise<void> {
  const due = await SurveyAssignment.find({
    'recurrence.nextFireAt':  { $lte: now },
    'recurrence.paused':      { $ne: true },
  }).setOptions({ bypassTenantCheck: true } as any);

  if (due.length === 0) return;
  console.log(`[SurveyScheduler] ${due.length} due assignment(s)`);

  for (const assignment of due) {
    const r = assignment.recurrence;
    if (!r) continue;

    // End conditions
    if (r.endsAt && r.endsAt.getTime() <= now.getTime()) {
      r.nextFireAt = undefined;
      await assignment.save();
      console.log(`[SurveyScheduler] ${assignment._id} reached endsAt, schedule closed`);
      continue;
    }
    if (typeof r.maxOccurrences === 'number' && r.occurrencesFired >= r.maxOccurrences) {
      r.nextFireAt = undefined;
      await assignment.save();
      console.log(`[SurveyScheduler] ${assignment._id} reached maxOccurrences, schedule closed`);
      continue;
    }

    const template = await SurveyTemplate.findById(assignment.templateId)
      .select('_id title organizationId')
      .setOptions({ bypassTenantCheck: true });
    if (!template) {
      console.warn(`[SurveyScheduler] template ${assignment.templateId} missing, skipping`);
      continue;
    }

    // Cycle stamp = the fire time as ISO date (yyyy-mm-dd). Stable for the
    // duration of this fire so the submissionToken collisions don't happen
    // within the same cycle but DO between cycles.
    const cycleStamp = (r.nextFireAt ?? now).toISOString().slice(0, 10);

    try {
      const result = await dispatchAssignment(assignment, template, {
        cycle: cycleStamp,
        sendEmail: true,
      });
      console.log(
        `[SurveyScheduler] fired ${assignment._id} cycle=${cycleStamp} ` +
        `recipients=${result.recipientCount} notified=${result.notifiedCount} ` +
        `emailed=${result.emailedCount}`,
      );
    } catch (err) {
      console.error(`[SurveyScheduler] dispatch failed for ${assignment._id}:`, err);
      continue;  // leave nextFireAt unchanged so the next sweep retries
    }

    // Advance state — even if we hit the cap with this fire, we record it.
    r.occurrencesFired = (r.occurrencesFired ?? 0) + 1;
    r.lastFiredAt = now;

    // Determine if more cycles remain.
    const hitMax = typeof r.maxOccurrences === 'number' && r.occurrencesFired >= r.maxOccurrences;
    const next = computeNextFireAt(now, r.intervalWeeks, r.dayOfWeek, r.hourOfDay);
    const beyondEnd = r.endsAt && next.getTime() > r.endsAt.getTime();

    if (hitMax || beyondEnd) {
      r.nextFireAt = undefined;
    } else {
      r.nextFireAt = next;
    }
    await assignment.save();
  }
}

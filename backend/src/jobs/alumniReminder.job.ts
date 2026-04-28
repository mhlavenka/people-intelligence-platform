import cron from 'node-cron';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { User } from '../models/User.model';
import { sendEmail } from '../services/email.service';
import { createHubNotification } from '../services/hubNotification.service';
import { config } from '../config/env';

const THREE_MONTHS_DAYS = 90;
const SIX_MONTHS_DAYS = 180;

/**
 * Daily alumni follow-up sweep. Runs at 03:00 server time.
 *
 * For every engagement that is `completed` or `alumni`, completedAt is set,
 * alumniReminders.disabled is not true, and the engagement was not
 * reactivated:
 *
 *   - If completedAt is >= 90 days ago and threeMonthSentAt is null:
 *     send the 3-month follow-up to the coachee, then mark sent.
 *   - If completedAt is >= 180 days ago and sixMonthSentAt is null:
 *     send the 6-month follow-up + auto-transition completed -> alumni,
 *     then mark sent.
 *
 * The send is best-effort: a hub notification is also written so the
 * coachee sees the message even if email fails.
 */
export function startAlumniReminderJob(): void {
  cron.schedule('0 3 * * *', () => {
    runAlumniSweep().catch((err) =>
      console.error('[Alumni] Reminder sweep failed:', err),
    );
  });

  console.log('[Alumni] Daily alumni-reminder job started (03:00)');
}

export async function runAlumniSweep(now: Date = new Date()): Promise<void> {
  const threeMonthCutoff = new Date(now);
  threeMonthCutoff.setDate(threeMonthCutoff.getDate() - THREE_MONTHS_DAYS);

  const sixMonthCutoff = new Date(now);
  sixMonthCutoff.setDate(sixMonthCutoff.getDate() - SIX_MONTHS_DAYS);

  // Candidates: engagements that are completed or alumni, completedAt set,
  // not opted out, and either reminder is still pending.
  const candidates = await CoachingEngagement.find({
    status: { $in: ['completed', 'alumni'] },
    completedAt: { $exists: true, $ne: null, $lte: threeMonthCutoff },
    'alumniReminders.disabled': { $ne: true },
    $or: [
      { 'alumniReminders.threeMonthSentAt': { $exists: false } },
      { 'alumniReminders.threeMonthSentAt': null },
      { 'alumniReminders.sixMonthSentAt': { $exists: false } },
      { 'alumniReminders.sixMonthSentAt': null },
    ],
  })
    .populate('coacheeId', 'firstName lastName email preferredLanguage')
    .populate('coachId', 'firstName lastName')
    .setOptions({ bypassTenantCheck: true });

  let threeSent = 0;
  let sixSent = 0;

  for (const eng of candidates) {
    const coachee = eng.coacheeId as any;
    const coach = eng.coachId as any;
    if (!coachee?.email || !coach) continue;

    const completedAt = eng.completedAt!;
    const reminders = eng.alumniReminders ?? {};
    const lang = coachee.preferredLanguage || 'en';

    // 6-month takes precedence — if both are due (engagement was missed by
    // an earlier sweep), the 6-month subsumes the 3-month.
    if (completedAt <= sixMonthCutoff && !reminders.sixMonthSentAt) {
      await sendReminder(eng, coachee, coach, '6_month', lang);
      eng.alumniReminders = {
        ...reminders,
        threeMonthSentAt: reminders.threeMonthSentAt || new Date(),
        sixMonthSentAt: new Date(),
      };
      // Auto-transition to alumni so the coachee surface goes read-only.
      if (eng.status === 'completed') eng.status = 'alumni';
      await eng.save();
      sixSent++;
      continue;
    }

    if (completedAt <= threeMonthCutoff && !reminders.threeMonthSentAt) {
      await sendReminder(eng, coachee, coach, '3_month', lang);
      eng.alumniReminders = { ...reminders, threeMonthSentAt: new Date() };
      await eng.save();
      threeSent++;
    }
  }

  console.log(
    `[Alumni] Sweep complete: ${threeSent} 3-month, ${sixSent} 6-month reminders sent`,
  );
}

async function sendReminder(
  eng: any,
  coachee: { firstName: string; lastName: string; email: string; _id: any },
  coach: { firstName: string; lastName: string },
  kind: '3_month' | '6_month',
  language: string,
): Promise<void> {
  const coachName = `${coach.firstName} ${coach.lastName}`;
  const subject = kind === '3_month'
    ? `Checking in — 3 months on from your coaching with ${coachName}`
    : `Half a year on — how are things going since coaching with ${coachName}?`;

  const body = kind === '3_month'
    ? `<h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">It's been three months</h2>
       <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
         Hi ${coachee.firstName}, it's been about three months since you wrapped up your coaching engagement with <strong>${coachName}</strong>.
       </p>
       <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
         How are things going? You're welcome to revisit your development plan and session notes any time.
       </p>
       <a href="${config.frontendUrl}/coaching/${eng._id}"
          style="display:inline-block;background:#3A9FD6;color:#ffffff;
                 padding:14px 28px;border-radius:6px;text-decoration:none;
                 font-weight:600;font-size:15px;">
         View my engagement
       </a>`
    : `<h2 style="color:#1B2A47;margin:0 0 12px;font-size:22px;">Half a year on</h2>
       <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
         Hi ${coachee.firstName}, it's been about six months since the close of your coaching engagement with <strong>${coachName}</strong>.
       </p>
       <p style="color:#5a6a7e;margin:0 0 16px;line-height:1.6;">
         If you'd like a refresher session or want to set new goals, ${coach.firstName} would love to hear from you. Your past development plan and session summaries remain available read-only on your dashboard.
       </p>
       <a href="${config.frontendUrl}/coaching/${eng._id}"
          style="display:inline-block;background:#3A9FD6;color:#ffffff;
                 padding:14px 28px;border-radius:6px;text-decoration:none;
                 font-weight:600;font-size:15px;">
         View my engagement
       </a>`;

  await sendEmail({
    to: coachee.email,
    subject,
    html: body,
    language,
  }).catch((err) => console.error(`[Alumni] Email failed for ${coachee.email}:`, err));

  await createHubNotification({
    userId: coachee._id,
    organizationId: eng.organizationId,
    type: 'system',
    title: kind === '3_month'
      ? '3-month follow-up from your coach'
      : '6-month follow-up from your coach',
    body: kind === '3_month'
      ? `${coachName} sent a check-in. Open your engagement to see your development plan and notes.`
      : `${coachName} sent a half-year follow-up. Your engagement is now in alumni mode — past materials remain available read-only.`,
    link: `/coaching/${eng._id}`,
    category: 'engagementCreated',
  }).catch((err) => console.error('[Alumni] Hub notification failed:', err));
}

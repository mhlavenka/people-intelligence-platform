import cron from 'node-cron';
import { Booking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { sendReminder, shouldSuppressBookingEmail } from '../services/bookingNotification.service';
import { notifyBookingReminder } from '../services/hubNotification.service';

const WINDOW_MS = 30 * 60 * 1000; // 30-minute window

export function startReminderJob(): void {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in1h = new Date(now.getTime() + 60 * 60 * 1000);

      const upcomingBookings = await Booking.find({
        status: 'confirmed',
        startTime: { $gte: now },
      }).setOptions({ bypassTenantCheck: true });

      for (const booking of upcomingBookings) {
        // B7 defense-in-depth: the Mongo filter above is time-sensitive, so a
        // booking whose startTime slipped into the past between query and
        // processing must be skipped here too.
        if (booking.startTime <= new Date()) continue;

        const startMs = booking.startTime.getTime();
        const sentTypes = booking.remindersSent.map((r) => r.type);

        const coach = await User.findById(booking.coachId).select('firstName lastName');
        if (!coach) continue;
        const coachName = `${coach.firstName} ${coach.lastName}`;

        // 24h reminder
        if (
          !sentTypes.includes('24h') &&
          startMs >= in24h.getTime() - WINDOW_MS &&
          startMs <= in24h.getTime() + WINDOW_MS
        ) {
          try {
            const suppress = await shouldSuppressBookingEmail(booking);
            if (!suppress) await sendReminder(booking, coachName, '24h');
            notifyBookingReminder({
              coacheeId: booking.coacheeId,
              engagementId: booking.engagementId,
              organizationId: booking.organizationId,
              coachName,
              startTime: booking.startTime,
              type: '24h',
            }).catch((err) => console.error('[Reminder] Hub notification failed:', err));
            booking.remindersSent.push({ type: '24h', sentAt: now });
            await booking.save();
            console.log(`[Reminder] Sent 24h reminder for booking ${booking._id}`);
          } catch (err) {
            console.error(`[Reminder] Failed 24h reminder for ${booking._id}:`, err);
          }
        }

        // 1h reminder
        if (
          !sentTypes.includes('1h') &&
          startMs >= in1h.getTime() - WINDOW_MS &&
          startMs <= in1h.getTime() + WINDOW_MS
        ) {
          try {
            const suppress1h = await shouldSuppressBookingEmail(booking);
            if (!suppress1h) await sendReminder(booking, coachName, '1h');
            notifyBookingReminder({
              coacheeId: booking.coacheeId,
              engagementId: booking.engagementId,
              organizationId: booking.organizationId,
              coachName,
              startTime: booking.startTime,
              type: '1h',
            }).catch((err) => console.error('[Reminder] Hub notification failed:', err));
            booking.remindersSent.push({ type: '1h', sentAt: now });
            await booking.save();
            console.log(`[Reminder] Sent 1h reminder for booking ${booking._id}`);
          } catch (err) {
            console.error(`[Reminder] Failed 1h reminder for ${booking._id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Reminder] Job failed:', err);
    }
  });

  console.log('[Reminder] Booking reminder job started (every 15 min)');
}

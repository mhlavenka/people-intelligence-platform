/**
 * Cross-module integration between the public Booking flow and the
 * internal Coaching (Engagement / Session) data model. Lives outside
 * both modules to avoid circular service imports.
 *
 * Two-way mirror:
 *   coachee books   → linkBookingToCoaching   creates Engagement (if missing)
 *                                              + CoachingSession, links both
 *   coach sessions  → mirrorSessionToBooking  creates a paired Booking row
 *
 * Status / time / deletion changes propagate via the propagate* helpers,
 * called from the existing route handlers.
 */

import mongoose from 'mongoose';
import { Booking, IBooking } from '../models/Booking.model';
import { CoachingSession, ICoachingSession } from '../models/CoachingSession.model';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { User } from '../models/User.model';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';

// ─── Quota check (called before createBooking) ──────────────────────────────

export interface QuotaCheckResult {
  /** false → block the booking; the route should respond 409 with `reason`. */
  allowed: boolean;
  /** Human-readable reason when allowed is false. */
  reason?: string;
  /** When a finite quota applies, how many sessions remain after this booking. */
  remaining?: number;
}

/**
 * Check whether an authenticated coachee can create a new booking with a
 * given coach (identified by their event-type slug). Returns allowed=true
 * when:
 *   - no engagement exists yet (will be auto-created), or
 *   - engagement.sessionsPurchased is 0 (treated as unlimited), or
 *   - active+scheduled+completed sessions < sessionsPurchased.
 */
export async function precheckBookingQuota(
  coachSlug: string,
  coacheeId: string,
): Promise<QuotaCheckResult> {
  const cfg = await AvailabilityConfig.findOne({ coachSlug, isActive: true })
    .setOptions({ bypassTenantCheck: true });
  if (!cfg) return { allowed: true }; // route will 404 anyway

  const coachee = await User.findById(coacheeId).select('_id organizationId role');
  if (!coachee || coachee.role !== 'coachee') return { allowed: true };
  if (coachee.organizationId.toString() !== cfg.organizationId.toString()) return { allowed: true };

  const engagement = await CoachingEngagement.findOne({
    organizationId: cfg.organizationId,
    coacheeId: coachee._id,
    coachId: cfg.coachId,
  });

  // No engagement yet → the auto-created one will start at 0/0 (unlimited).
  if (!engagement) return { allowed: true };

  // 0 means unlimited — same semantics as the engagement editor's hint.
  if (!engagement.sessionsPurchased) return { allowed: true };

  // Count sessions that count against quota: scheduled + completed.
  const used = await CoachingSession.countDocuments({
    engagementId: engagement._id,
    status: { $in: ['scheduled', 'completed'] },
  }).setOptions({ bypassTenantCheck: true });

  if (used >= engagement.sessionsPurchased) {
    return {
      allowed: false,
      reason: `This engagement has used all ${engagement.sessionsPurchased} purchased sessions.`,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: engagement.sessionsPurchased - used - 1,
  };
}

// ─── Booking → Coaching ─────────────────────────────────────────────────────

/** When a coachee books via the public flow, link the resulting Booking
 *  back into the coaching data model. No-op when the booker is anonymous
 *  or not a coachee in the same org as the coach. */
export async function linkBookingToCoaching(
  booking: IBooking,
  coacheeId: string,
): Promise<void> {
  const coachee = await User.findById(coacheeId).select(
    '_id organizationId role firstName lastName',
  );
  if (!coachee) return;
  if (coachee.role !== 'coachee') return;
  if (coachee.organizationId.toString() !== booking.organizationId.toString()) return;

  // Find or create the engagement.
  // setOptions(bypassTenantCheck) silences the tenant-filter warning;
  // the filter itself is explicit in the query.
  const engagementFilter = {
    organizationId: booking.organizationId,
    coacheeId: coachee._id,
    coachId: booking.coachId,
  };
  let engagement = await CoachingEngagement
    .findOne(engagementFilter)
    .setOptions({ bypassTenantCheck: true });

  if (!engagement) {
    console.info(
      `[BookingSync] No engagement for coachee=${coachee._id} coach=${booking.coachId} ` +
      `org=${booking.organizationId} — creating new`,
    );
    engagement = await CoachingEngagement.create({
      organizationId: booking.organizationId,
      coacheeId: coachee._id,
      coachId: booking.coachId,
      status: 'active',
      sessionsPurchased: 0,
      sessionsUsed: 0,
      goals: [],
      rebillCoachee: false,
    });
  } else {
    console.info(`[BookingSync] Linking booking to existing engagement ${engagement._id}`);
  }

  // Create the paired CoachingSession
  const session = await CoachingSession.create({
    organizationId: booking.organizationId,
    engagementId: engagement._id,
    coacheeId: coachee._id,
    coachId: booking.coachId,
    date: booking.startTime,
    duration: Math.round((booking.endTime.getTime() - booking.startTime.getTime()) / 60_000),
    format: 'video',
    growFocus: [],
    frameworks: [],
    coachNotes: '',
    sharedNotes: booking.topic || '',
    topics: booking.topic ? [booking.topic] : [],
    status: 'scheduled',
    googleEventId: booking.googleEventId,
    googleMeetLink: booking.googleMeetLink,
    bookingId: booking._id,
    createdVia: 'coachee_booking',
  });

  booking.coacheeId = coachee._id as mongoose.Types.ObjectId;
  booking.engagementId = engagement._id as mongoose.Types.ObjectId;
  booking.sessionId = session._id as mongoose.Types.ObjectId;
  await booking.save();
}

/** Booking was cancelled → cancel the linked CoachingSession (if any). */
export async function propagateBookingCancel(booking: IBooking): Promise<void> {
  if (!booking.sessionId) return;
  await CoachingSession.findByIdAndUpdate(
    booking.sessionId,
    { status: 'cancelled' },
  ).setOptions({ bypassTenantCheck: true });
}

/** Booking was rescheduled → move the linked CoachingSession.date too. */
export async function propagateBookingReschedule(
  booking: IBooking,
  newStart: Date,
  newEnd: Date,
): Promise<void> {
  if (!booking.sessionId) return;
  const duration = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000);
  await CoachingSession.findByIdAndUpdate(
    booking.sessionId,
    { date: newStart, duration },
  ).setOptions({ bypassTenantCheck: true });
}

// ─── Coaching → Booking ─────────────────────────────────────────────────────

/** When a coach creates a CoachingSession via the admin UI, mirror it
 *  into a Booking row so it shows up in booking dashboards, gets webhook
 *  sync, and shares the same client-cancel flow. */
export async function mirrorSessionToBooking(session: ICoachingSession): Promise<void> {
  if (session.bookingId) return; // already mirrored

  const coachee = await User.findById(session.coacheeId).select(
    'firstName lastName email',
  );
  if (!coachee) return;

  const start = session.date;
  const end = new Date(start.getTime() + (session.duration || 60) * 60_000);

  const booking = await Booking.create({
    coachId: session.coachId,
    organizationId: session.organizationId,
    coacheeId: session.coacheeId,
    engagementId: session.engagementId,
    sessionId: session._id,
    clientName: `${coachee.firstName} ${coachee.lastName}`.trim(),
    clientEmail: coachee.email,
    topic: session.sharedNotes || undefined,
    startTime: start,
    endTime: end,
    clientTimezone: 'UTC',
    coachTimezone: 'UTC',
    googleEventId: session.googleEventId,
    googleMeetLink: session.googleMeetLink,
    status: session.status === 'cancelled' ? 'cancelled' : 'confirmed',
    remindersSent: [],
    rescheduleHistory: [],
  });

  session.bookingId = booking._id as mongoose.Types.ObjectId;
  await session.save();
}

/** Coach updated a CoachingSession → mirror date / status changes to its
 *  paired Booking. Does NOT touch GCal — the coaching route already does
 *  that for its own session events. */
export async function propagateSessionUpdate(
  session: ICoachingSession,
  prev: { date: Date; status: string },
): Promise<void> {
  if (!session.bookingId) return;
  const update: Record<string, unknown> = {};

  if (session.date.getTime() !== prev.date.getTime()) {
    update.startTime = session.date;
    update.endTime = new Date(session.date.getTime() + (session.duration || 60) * 60_000);
  }

  if (session.status !== prev.status) {
    if (session.status === 'cancelled') update.status = 'cancelled';
    else if (session.status === 'completed') update.status = 'completed';
  }

  if (Object.keys(update).length === 0) return;

  await Booking.findByIdAndUpdate(session.bookingId, update)
    .setOptions({ bypassTenantCheck: true });
}

/** Coach deleted a CoachingSession → cancel the linked Booking. */
export async function propagateSessionDelete(session: ICoachingSession): Promise<void> {
  if (!session.bookingId) return;
  await Booking.findByIdAndUpdate(
    session.bookingId,
    { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'coach' },
  ).setOptions({ bypassTenantCheck: true });
}

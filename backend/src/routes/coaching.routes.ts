import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { CoachingEngagement } from '../models/CoachingEngagement.model';
import { CoachingSession } from '../models/CoachingSession.model';
import { User } from '../models/User.model';
import * as gcal from '../services/googleCalendar.service';
import {
  mirrorSessionToBooking,
  propagateSessionUpdate,
} from '../services/bookingCoachingSync.service';
import { cancelBooking } from '../services/booking.service';

const router = Router();
router.use(authenticateToken, tenantResolver);

/** Resolve coachee name + email for calendar event details. */
async function resolveCoachee(coacheeId: string): Promise<{ name: string; email?: string }> {
  const coachee = await User.findById(coacheeId).select('firstName lastName email');
  return coachee
    ? { name: `${coachee.firstName} ${coachee.lastName}`, email: coachee.email }
    : { name: 'Unknown' };
}

/** Check if a coach has Google Calendar connected. */
async function isCalendarConnected(coachId: string): Promise<boolean> {
  const coach = await User.findById(coachId).select('googleCalendar.connected');
  return coach?.googleCalendar?.connected === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGAGEMENTS
// ═══════════════════════════════════════════════════════════════════════════

/** Per-role scoping for coaching reads.
 *  - admin / hr_manager: see everything in the org
 *  - coach:              see only engagements/sessions where they are the coach
 *  - coachee:            see only engagements/sessions where they are the coachee
 */
function scopeCoachingFilter(req: AuthRequest, base: Record<string, unknown> = {}): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...base, organizationId: req.user!.organizationId };
  if (req.user!.role === 'coach') filter['coachId'] = req.user!.userId;
  if (req.user!.role === 'coachee') filter['coacheeId'] = req.user!.userId;
  return filter;
}

/** List engagements — scoped per role. */
router.get('/engagements', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filter = scopeCoachingFilter(req);
    const engagements = await CoachingEngagement.find(filter)
      .populate('coacheeId', 'firstName lastName email department profilePicture')
      .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization')
      .sort({ createdAt: -1 });
    console.info(
      `[Coaching] /engagements role=${req.user!.role} userId=${req.user!.userId} ` +
      `filter=${JSON.stringify(filter)} returned=${engagements.length}`,
    );
    res.json(engagements);
  } catch (e) { next(e); }
});

/** Get single engagement (scoped per role). */
router.get('/engagements/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const engagement = await CoachingEngagement.findOne(
      scopeCoachingFilter(req, { _id: req.params['id'] }),
    )
      .populate('coacheeId', 'firstName lastName email department profilePicture')
      .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization');
    if (!engagement) { res.status(404).json({ error: 'Engagement not found' }); return; }
    res.json(engagement);
  } catch (e) { next(e); }
});

/** Create engagement. */
router.post(
  '/engagements',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const engagement = await CoachingEngagement.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        coachId: req.body.coachId || req.user!.userId,
      });
      const populated = await engagement.populate([
        { path: 'coacheeId', select: 'firstName lastName email department profilePicture' },
        { path: 'coachId', select: 'firstName lastName' },
      ]);
      res.status(201).json(populated);
    } catch (e) { next(e); }
  }
);

/** Update engagement. */
router.put(
  '/engagements/:id',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const engagement = await CoachingEngagement.findOneAndUpdate(
        { _id: req.params['id'], organizationId: req.user!.organizationId },
        req.body,
        { new: true, runValidators: true }
      )
        .populate('coacheeId', 'firstName lastName email department profilePicture')
        .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization');
      if (!engagement) { res.status(404).json({ error: 'Engagement not found' }); return; }
      res.json(engagement);
    } catch (e) { next(e); }
  }
);

/** Delete engagement (admin/hr_manager any; coach only their own). */
router.delete(
  '/engagements/:id',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      };
      // Coaches can only delete engagements they own.
      if (req.user!.role === 'coach') filter['coachId'] = req.user!.userId;

      const engagement = await CoachingEngagement.findOneAndDelete(filter);
      if (!engagement) { res.status(404).json({ error: 'Engagement not found' }); return; }

      // Cascade: delete every session under this engagement and cancel the
      // paired Booking + GCal event for each one. cancelBooking handles
      // GCal delete + email + cache invalidation for booking-paired
      // sessions; standalone sessions get a direct GCal delete fallback.
      const sessions = await CoachingSession.find({
        engagementId: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      for (const session of sessions) {
        if (session.bookingId) {
          await cancelBooking(session.bookingId.toString(), 'coach', 'Engagement deleted')
            .catch((err) => console.error('[BookingSync] cascade cancelBooking failed:', err));
        } else if (session.googleEventId) {
          if (await isCalendarConnected(session.coachId.toString())) {
            await gcal.deleteCalendarEvent(session.coachId.toString(), session.googleEventId)
              .catch((calErr) => console.warn('[GCal] cascade delete failed:', calErr));
          }
        }
      }
      await CoachingSession.deleteMany({
        engagementId: req.params['id'],
        organizationId: req.user!.organizationId,
      });

      res.json({ message: 'Engagement and sessions deleted' });
    } catch (e) { next(e); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

/** List sessions — scoped per role. Coachees see shared notes only. */
router.get('/sessions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const base: Record<string, unknown> = {};
    if (req.query['engagementId']) base['engagementId'] = req.query['engagementId'];
    const filter = scopeCoachingFilter(req, base);

    const selectFields = req.user!.role === 'coachee'
      ? '-coachNotes'   // NEVER expose private coach notes to coachees
      : undefined;

    const sessions = await CoachingSession.find(filter)
      .select(selectFields as string)
      .populate('coacheeId', 'firstName lastName profilePicture')
      .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization')
      .sort({ date: -1 });
    res.json(sessions);
  } catch (e) { next(e); }
});

/** Get single session (scoped per role). */
router.get('/sessions/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const selectFields = req.user!.role === 'coachee' ? '-coachNotes' : undefined;
    const session = await CoachingSession.findOne(
      scopeCoachingFilter(req, { _id: req.params['id'] }),
    )
      .select(selectFields as string)
      .populate('coacheeId', 'firstName lastName profilePicture')
      .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization');
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(session);
  } catch (e) { next(e); }
});

/** Create session. */
router.post(
  '/sessions',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const session = await CoachingSession.create({
        ...req.body,
        organizationId: req.user!.organizationId,
        coachId: req.body.coachId || req.user!.userId,
      });

      // Increment sessionsUsed on the engagement if session is completed
      if (session.status === 'completed') {
        await CoachingEngagement.findByIdAndUpdate(session.engagementId, { $inc: { sessionsUsed: 1 } });
      }

      // Google Calendar sync (creates Google Meet link)
      try {
        if (await isCalendarConnected(session.coachId.toString())) {
          const coachee = await resolveCoachee(session.coacheeId.toString());
          const { eventId, meetLink } = await gcal.createCalendarEvent(session.coachId.toString(), {
            date: session.date,
            duration: session.duration,
            coacheeName: coachee.name,
            coacheeEmail: coachee.email,
            sharedNotes: session.sharedNotes,
          });
          session.googleEventId = eventId;
          if (meetLink) session.googleMeetLink = meetLink;
          await session.save();
        }
      } catch (calErr) {
        console.warn('[GCal] Failed to create event:', calErr);
      }

      // Mirror this coach-created session into a Booking row so it shows
      // in booking dashboards and webhook sync covers it. Best-effort —
      // a failure here must not fail the session create.
      await mirrorSessionToBooking(session).catch((err) =>
        console.error('[BookingSync] Failed to mirror session to booking:', err),
      );

      const populated = await session.populate([
        { path: 'coacheeId', select: 'firstName lastName profilePicture' },
        { path: 'coachId', select: 'firstName lastName' },
      ]);
      res.status(201).json(populated);
    } catch (e) { next(e); }
  }
);

/** Update session (notes, status, ratings). */
router.put(
  '/sessions/:id',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const existing = await CoachingSession.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!existing) { res.status(404).json({ error: 'Session not found' }); return; }

      const wasNotCompleted = existing.status !== 'completed';
      const prev = { date: existing.date, status: existing.status };
      Object.assign(existing, req.body);
      await existing.save();

      // Mirror date / status changes into the linked Booking
      await propagateSessionUpdate(existing, prev).catch((err) =>
        console.error('[BookingSync] Failed to propagate session update:', err),
      );

      // If status changed to completed, increment engagement counter
      if (wasNotCompleted && existing.status === 'completed') {
        await CoachingEngagement.findByIdAndUpdate(existing.engagementId, { $inc: { sessionsUsed: 1 } });
      }

      // Google Calendar sync
      try {
        if (existing.googleEventId && await isCalendarConnected(existing.coachId.toString())) {
          const coachee = await resolveCoachee(existing.coacheeId.toString());
          await gcal.updateCalendarEvent(existing.coachId.toString(), existing.googleEventId, {
            date: existing.date,
            duration: existing.duration,
            coacheeName: coachee.name,
            coacheeEmail: coachee.email,
            sharedNotes: existing.sharedNotes,
            status: existing.status,
          });
        }
      } catch (calErr) {
        console.warn('[GCal] Failed to update event:', calErr);
      }

      await existing.populate([
        { path: 'coacheeId', select: 'firstName lastName profilePicture' },
        { path: 'coachId', select: 'firstName lastName' },
      ]);
      res.json(existing);
    } catch (e) { next(e); }
  }
);

/** Delete session. */
router.delete(
  '/sessions/:id',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const session = await CoachingSession.findOneAndDelete({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

      // If the session has a paired Booking, cancel through cancelBooking()
      // so GCal delete + cancellation email + cache invalidation all run.
      // For sessions without a paired Booking (manually created, no public
      // flow), fall back to deleting the GCal event directly.
      if (session.bookingId) {
        try {
          await cancelBooking(session.bookingId.toString(), 'coach', 'Session deleted');
        } catch (err) {
          console.error('[BookingSync] cancelBooking on session delete failed:', err);
          // Best-effort fallback: at least attempt the GCal delete.
          if (session.googleEventId && await isCalendarConnected(session.coachId.toString())) {
            await gcal.deleteCalendarEvent(session.coachId.toString(), session.googleEventId)
              .catch((calErr) => console.warn('[GCal] fallback delete failed:', calErr));
          }
        }
      } else {
        try {
          if (session.googleEventId && await isCalendarConnected(session.coachId.toString())) {
            await gcal.deleteCalendarEvent(session.coachId.toString(), session.googleEventId);
          }
        } catch (calErr) {
          console.warn('[GCal] Failed to delete event:', calErr);
        }
      }

      res.json({ message: 'Session deleted' });
    } catch (e) { next(e); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filter = scopeCoachingFilter(req);

    const [engagements, sessions] = await Promise.all([
      CoachingEngagement.find(filter).lean(),
      CoachingSession.find(filter).lean(),
    ]);

    const activeEngagements = engagements.filter((e) => e.status === 'active').length;
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const totalHours = sessions
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + (s.duration || 60) / 60, 0);

    // Upcoming sessions (next 30 days)
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const upcoming = sessions.filter((s) =>
      s.status === 'scheduled' && new Date(s.date) >= now && new Date(s.date) <= in30Days
    ).length;

    res.json({
      activeEngagements,
      totalEngagements: engagements.length,
      completedSessions,
      totalHours: Math.round(totalHours * 10) / 10,
      upcomingSessions: upcoming,
      byStatus: {
        prospect: engagements.filter((e) => e.status === 'prospect').length,
        contracted: engagements.filter((e) => e.status === 'contracted').length,
        active: activeEngagements,
        paused: engagements.filter((e) => e.status === 'paused').length,
        completed: engagements.filter((e) => e.status === 'completed').length,
        alumni: engagements.filter((e) => e.status === 'alumni').length,
      },
    });
  } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// COACHEE BILLING
// ═══════════════════════════════════════════════════════════════════════════

/** Billing summary for a coachee across all rebillable engagements. */
router.get(
  '/billing/coachee/:coacheeId',
  requireRole('admin', 'hr_manager', 'coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.organizationId;
      const coacheeId = req.params['coacheeId'];

      const billingFilter: Record<string, unknown> = {
        organizationId: orgId,
        coacheeId,
        billingMode: 'sponsor',
      };
      // Coaches can only see billing for engagements they own.
      if (req.user!.role === 'coach') billingFilter['coachId'] = req.user!.userId;

      const engagements = await CoachingEngagement.find(billingFilter)
        .populate('coachId', 'firstName lastName email profilePicture')
      .populate('sponsorId', 'name email organization')
        .lean();

      const engagementIds = engagements.map((e) => e._id);

      const sessions = await CoachingSession.find({
        organizationId: orgId,
        engagementId: { $in: engagementIds },
      })
        .select('-coachNotes')
        .sort({ date: -1 })
        .lean();

      // Build per-engagement billing summary
      // Billing is based on the full engagement (sessionsPurchased), not just completed sessions.
      const items = engagements.map((eng) => {
        const engSessions = sessions.filter(
          (s) => s.engagementId.toString() === eng._id.toString()
        );
        const completed = engSessions.filter((s) => s.status === 'completed');
        const rate = eng.hourlyRate ?? 0;
        const billedHours = eng.sessionsPurchased ?? 0;
        const totalAmount = billedHours * rate;
        const completedHours = completed.reduce((sum, s) => sum + (s.duration || 60), 0) / 60;

        return {
          engagementId: eng._id,
          coach: eng.coachId,
          status: eng.status,
          hourlyRate: rate,
          sessionsPurchased: eng.sessionsPurchased,
          sessionsUsed: eng.sessionsUsed,
          sessionsCompleted: completed.length,
          sessionsTotal: engSessions.length,
          billedHours,
          completedHours: Math.round(completedHours * 100) / 100,
          totalAmount: Math.round(totalAmount * 100) / 100,
          sessions: engSessions.map((s) => ({
            _id: s._id,
            date: s.date,
            duration: s.duration,
            status: s.status,
            format: s.format,
          })),
        };
      });

      const grandTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);
      const grandHours = items.reduce((sum, i) => sum + i.billedHours, 0);

      // Get coachee info
      const coachee = await User.findById(coacheeId).select('firstName lastName email department profilePicture');

      res.json({
        coachee,
        engagements: items,
        summary: {
          totalEngagements: items.length,
          totalHours: Math.round(grandHours * 100) / 100,
          totalAmount: Math.round(grandTotal * 100) / 100,
        },
      });
    } catch (e) { next(e); }
  }
);

export default router;

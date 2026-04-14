import { Router, Response, NextFunction, Request } from 'express';
import rateLimit from 'express-rate-limit';
import {
  authenticateToken, optionalAuth, requireRole, AuthRequest,
} from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { AvailabilityConfig, IAvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { Booking } from '../models/Booking.model';
import { User } from '../models/User.model';
import {
  getAvailableSlots,
  getPublicCoachInfo,
  invalidateSlotCache,
} from '../services/availability.service';
import {
  createBooking, cancelBooking, clientCancelBooking, rescheduleBooking,
} from '../services/booking.service';
import { registerGoogleWebhook } from '../services/calendarWebhook.service';
import * as bookingImport from '../controllers/booking-import.controller';
import {
  linkBookingToCoaching,
  precheckBookingQuota,
} from '../services/bookingCoachingSync.service';

// ─── Slug helper ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const filter: Record<string, unknown> = { coachSlug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await AvailabilityConfig.findOne(filter).setOptions({ bypassTenantCheck: true });
    if (!existing) return candidate;
    suffix++;
  }
}

// ─── Public routes (no auth) ────────────────────────────────────────────────

export const publicBookingRouter = Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later' },
});

publicBookingRouter.use(publicLimiter);

// Get coach info for booking page
publicBookingRouter.get('/:coachSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await getPublicCoachInfo(req.params['coachSlug']);
    if (!info) { res.status(404).json({ error: 'Booking page not found' }); return; }
    res.json(info);
  } catch (e) { next(e); }
});

// Get available slots
publicBookingRouter.get('/:coachSlug/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { coachSlug } = req.params;
    const from = req.query['from'] as string;
    const to = req.query['to'] as string;
    const tz = req.query['tz'] as string || 'UTC';

    if (!from || !to) {
      res.status(400).json({ error: 'from and to query params required' });
      return;
    }

    const slots = await getAvailableSlots(coachSlug, from, to, tz);
    res.json(slots);
  } catch (e) { next(e); }
});

// Create booking. optionalAuth attaches req.user when an authenticated
// coachee posts here from the in-app flow; for anonymous clients it's
// a transparent no-op.
publicBookingRouter.post(
  '/:coachSlug',
  optionalAuth,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { coachSlug } = req.params;
      const { startTime, endTime, clientName, clientEmail, clientPhone, topic, clientTimezone } = req.body;

      if (!startTime || !endTime || !clientName || !clientEmail) {
        res.status(400).json({ error: 'startTime, endTime, clientName, and clientEmail are required' });
        return;
      }

      // Engagement quota check (only meaningful for authenticated coachees).
      // Runs BEFORE createBooking so a quota-exhausted booking never produces
      // a Booking row or a GCal event.
      if (req.user && req.user.role === 'coachee') {
        const quota = await precheckBookingQuota(coachSlug, req.user.userId);
        if (!quota.allowed) {
          res.status(409).json({ error: quota.reason ?? 'Booking quota exhausted' });
          return;
        }
      }

      const booking = await createBooking(coachSlug, {
        startTime, endTime, clientName, clientEmail, clientPhone, topic, clientTimezone,
      });

      // If the booker is an authenticated coachee in the same org, link
      // the booking to a CoachingSession (and create the Engagement if
      // one doesn't yet exist). Anonymous bookers fall through unchanged.
      if (req.user && req.user.role === 'coachee') {
        try {
          await linkBookingToCoaching(booking, req.user.userId);
        } catch (linkErr) {
          console.error('[BookingSync] Failed to link booking to coaching:', linkErr);
        }
      }

      res.status(201).json({
        _id: booking._id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientTimezone: booking.clientTimezone,
        coachTimezone: booking.coachTimezone,
        googleMeetLink: booking.googleMeetLink,
        status: booking.status,
      });
    } catch (e) { next(e); }
  },
);

// Get booking confirmation details (public, limited fields)
publicBookingRouter.get('/:coachSlug/confirmation/:bookingId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await Booking.findById(req.params['bookingId'])
      .setOptions({ bypassTenantCheck: true });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

    const cfg = await AvailabilityConfig.findOne({ coachSlug: req.params['coachSlug'], coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });

    const coach = await User.findById(booking.coachId).select('firstName lastName');
    const coachName = coach ? `${coach.firstName} ${coach.lastName}` : '';
    const duration = cfg?.appointmentDuration ?? Math.round(
      (booking.endTime.getTime() - booking.startTime.getTime()) / 60_000,
    );

    res.json({
      booking: {
        _id: booking._id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientTimezone: booking.clientTimezone,
        coachTimezone: booking.coachTimezone,
        googleMeetLink: booking.googleMeetLink,
        status: booking.status,
      },
      coachName,
      duration,
      clientEmail: booking.clientEmail,
    });
  } catch (e) { next(e); }
});

// Client cancellation via token
publicBookingRouter.get('/:coachSlug/cancel/:bookingId/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await clientCancelBooking(req.params['bookingId'], req.params['token']);
    res.json({ message: 'Booking cancelled successfully' });
  } catch (e) { next(e); }
});

// ─── Public coach landing page ──────────────────────────────────────────────

export const publicCoachRouter = Router();
publicCoachRouter.use(publicLimiter);

async function ensureUserPublicSlug(user: {
  _id: unknown; firstName: string; lastName: string; publicSlug?: string;
}): Promise<string> {
  if (user.publicSlug) return user.publicSlug;
  const base = slugify(`${user.firstName} ${user.lastName}`) || String(user._id);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    const existing = await User.findOne({ publicSlug: candidate })
      .setOptions({ bypassTenantCheck: true });
    if (!existing) {
      await User.findByIdAndUpdate(user._id, { publicSlug: candidate })
        .setOptions({ bypassTenantCheck: true });
      return candidate;
    }
    suffix++;
  }
}

publicCoachRouter.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params['slug']?.toLowerCase();
    const coach = await User.findOne({ publicSlug: slug, isActive: true })
      .setOptions({ bypassTenantCheck: true })
      .select('_id firstName lastName profilePicture bio publicSlug');
    if (!coach) { res.status(404).json({ error: 'Coach page not found' }); return; }

    const eventTypes = await AvailabilityConfig.find({ coachId: coach._id, isActive: true })
      .setOptions({ bypassTenantCheck: true })
      .select('name color coachSlug appointmentDuration bookingPageTitle bookingPageDesc googleMeetEnabled')
      .sort({ createdAt: 1 });

    res.json({
      coach: {
        firstName: coach.firstName,
        lastName: coach.lastName,
        profilePicture: coach.profilePicture ?? null,
        bio: coach.bio ?? '',
        slug: coach.publicSlug,
      },
      eventTypes: eventTypes.map((et) => ({
        _id: et._id,
        name: et.name,
        color: et.color,
        coachSlug: et.coachSlug,
        duration: et.appointmentDuration,
        title: et.bookingPageTitle || et.name,
        description: et.bookingPageDesc || '',
        googleMeetEnabled: et.googleMeetEnabled,
      })),
    });
  } catch (e) { next(e); }
});

export { ensureUserPublicSlug };

// ─── Admin routes (JWT protected) ───────────────────────────────────────────

const router = Router();
router.use(authenticateToken, tenantResolver);

// ── Shared Booking Settings (per-coach) ─────────────────────────────────────

// Get shared settings
router.get(
  '/settings',
  requireRole('coach', 'admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await BookingSettings.findOne({
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      res.json(settings || null);
    } catch (e) { next(e); }
  },
);

// Upsert shared settings
router.put(
  '/settings',
  requireRole('coach', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = req.user!.userId;
      const organizationId = req.user!.organizationId;

      // B8: ensure conflictCalendarIds always contains targetCalendarId and
      // that duplicate ids are folded out before we persist them.
      const body = { ...req.body };
      if (body.targetCalendarId) {
        const ids = Array.isArray(body.conflictCalendarIds) ? body.conflictCalendarIds : [];
        body.conflictCalendarIds = Array.from(
          new Set([body.targetCalendarId, ...ids].filter(Boolean) as string[]),
        );
      }

      const existing = await BookingSettings.findOne({ coachId, organizationId });
      const prevTarget = existing?.targetCalendarId;
      if (existing) {
        const updateData = { ...body };
        delete updateData.coachId;
        delete updateData.organizationId;
        Object.assign(existing, updateData);
        await existing.save();

        // Invalidate cache for all of this coach's event types
        const eventTypes = await AvailabilityConfig.find({ coachId, organizationId });
        for (const et of eventTypes) invalidateSlotCache(et.coachSlug);

        // If the watched calendar changed, re-register the push channel.
        if (body.targetCalendarId && body.targetCalendarId !== prevTarget) {
          registerGoogleWebhook(coachId).catch((err) =>
            console.error('[Webhook] re-register after settings save failed:', err),
          );
        }

        res.json(existing);
      } else {
        const settings = await BookingSettings.create({
          ...body,
          coachId,
          organizationId,
        });
        if (body.targetCalendarId) {
          registerGoogleWebhook(coachId).catch((err) =>
            console.error('[Webhook] register after first settings save failed:', err),
          );
        }
        res.status(201).json(settings);
      }
    } catch (e) { next(e); }
  },
);

// ── Event Types CRUD ────────────────────────────────────────────────────────

// List all event types for the coach
router.get(
  '/event-types',
  requireRole('coach', 'admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const eventTypes = await AvailabilityConfig.find({
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      }).sort({ createdAt: 1 });
      res.json(eventTypes);
    } catch (e) { next(e); }
  },
);

// Get single event type
router.get(
  '/event-types/:id',
  requireRole('coach', 'admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cfg = await AvailabilityConfig.findOne({
        _id: req.params['id'],
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      if (!cfg) { res.status(404).json({ error: 'Event type not found' }); return; }
      res.json(cfg);
    } catch (e) { next(e); }
  },
);

// Create new event type
router.post(
  '/event-types',
  requireRole('coach', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coachId = req.user!.userId;
      const organizationId = req.user!.organizationId;

      // Slug format: "{coach-name}-{event-name}" so links stay readable and
      // self-identifying. Event-name portion is regenerated on rename.
      const coach = await User.findById(coachId).select('firstName lastName');
      const coachNameSlug = coach
        ? slugify(`${coach.firstName}-${coach.lastName}`)
        : 'coach';
      const eventNameSlug = slugify(req.body.name || 'session') || 'session';
      const baseSlug = `${coachNameSlug}-${eventNameSlug}`;
      const coachSlug = await generateUniqueSlug(baseSlug);

      const cfg = await AvailabilityConfig.create({
        ...req.body,
        coachId,
        organizationId,
        coachSlug,
      });
      res.status(201).json(cfg);
    } catch (e) { next(e); }
  },
);

// Update event type
router.put(
  '/event-types/:id',
  requireRole('coach', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cfg = await AvailabilityConfig.findOne({
        _id: req.params['id'],
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      if (!cfg) { res.status(404).json({ error: 'Event type not found' }); return; }

      // Slug is managed server-side (derived from name). Strip client-supplied
      // values so a stale UI can't force a conflicting slug.
      const updateData = { ...req.body };
      delete updateData.coachSlug;
      delete updateData.coachId;
      delete updateData.organizationId;

      const oldSlug = cfg.coachSlug;

      // Regenerate slug when the event-type name changes so the shared link
      // always reflects the current name. This intentionally invalidates any
      // previously-shared link for this event type.
      if (updateData.name && slugify(updateData.name) !== slugify(cfg.name)) {
        const coach = await User.findById(cfg.coachId).select('firstName lastName');
        const coachNameSlug = coach
          ? slugify(`${coach.firstName}-${coach.lastName}`)
          : 'coach';
        const eventNameSlug = slugify(updateData.name) || 'session';
        const baseSlug = `${coachNameSlug}-${eventNameSlug}`;
        updateData.coachSlug = await generateUniqueSlug(baseSlug, String(cfg._id));
      }

      Object.assign(cfg, updateData);
      await cfg.save();
      invalidateSlotCache(oldSlug);
      if (cfg.coachSlug !== oldSlug) invalidateSlotCache(cfg.coachSlug);
      res.json(cfg);
    } catch (e) { next(e); }
  },
);

// Delete event type
router.delete(
  '/event-types/:id',
  requireRole('coach', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cfg = await AvailabilityConfig.findOne({
        _id: req.params['id'],
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      });
      if (!cfg) { res.status(404).json({ error: 'Event type not found' }); return; }

      // Check if there are future confirmed bookings
      const futureBookings = await Booking.countDocuments({
        eventTypeId: cfg._id,
        status: 'confirmed',
        startTime: { $gte: new Date() },
        organizationId: req.user!.organizationId,
      });
      if (futureBookings > 0) {
        res.status(400).json({
          error: `Cannot delete: ${futureBookings} upcoming booking(s) exist. Cancel them first.`,
        });
        return;
      }

      invalidateSlotCache(cfg.coachSlug);
      await cfg.deleteOne();
      res.json({ message: 'Event type deleted' });
    } catch (e) { next(e); }
  },
);

// ── Bookings ────────────────────────────────────────────────────────────────

// List bookings (paginated)
router.get(
  '/bookings',
  requireRole('coach', 'admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 20;
      const status = req.query['status'] as string;
      const tab = req.query['tab'] as string;
      const eventTypeId = req.query['eventTypeId'] as string;

      const filter: Record<string, unknown> = {
        coachId: req.user!.userId,
        organizationId: req.user!.organizationId,
      };

      if (eventTypeId) filter.eventTypeId = eventTypeId;

      const now = new Date();
      if (tab === 'upcoming') {
        filter.status = 'confirmed';
        filter.startTime = { $gte: now };
      } else if (tab === 'past') {
        filter.$or = [
          { status: 'completed' },
          { status: 'confirmed', startTime: { $lt: now } },
        ];
      } else if (tab === 'cancelled') {
        filter.status = 'cancelled';
      } else if (status) {
        filter.status = status;
      }

      const [bookings, total] = await Promise.all([
        Booking.find(filter)
          .sort({ startTime: tab === 'upcoming' ? 1 : -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Booking.countDocuments(filter),
      ]);

      res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
    } catch (e) { next(e); }
  },
);

// Get single booking
router.get(
  '/bookings/:id',
  requireRole('coach', 'admin', 'hr_manager'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await Booking.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
      res.json(booking);
    } catch (e) { next(e); }
  },
);

// Available reschedule slots for an existing booking — uses the same
// availability engine as the public flow, gated to participants in the
// booking. Coachees may only query their own bookings.
router.get(
  '/bookings/:id/slots',
  requireRole('coach', 'admin', 'hr_manager', 'coachee'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await Booking.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

      if (req.user!.role === 'coachee') {
        if (!booking.coacheeId || String(booking.coacheeId) !== String(req.user!.userId)) {
          res.status(403).json({ error: 'Not your booking.' });
          return;
        }
      }

      // Prefer the event type the booking was made against; fall back to the
      // coach's primary AvailabilityConfig.
      let cfg: IAvailabilityConfig | null = null;
      if (booking.eventTypeId) {
        cfg = await AvailabilityConfig.findOne({ _id: booking.eventTypeId })
          .setOptions({ bypassTenantCheck: true });
      }
      if (!cfg) {
        cfg = await AvailabilityConfig.findOne({
          coachId: booking.coachId,
          organizationId: booking.organizationId,
          isActive: true,
        }).setOptions({ bypassTenantCheck: true });
      }
      if (!cfg) { res.status(404).json({ error: 'No availability found for this coach.' }); return; }

      const from = req.query['from'] as string;
      const to   = req.query['to']   as string;
      const tz   = (req.query['tz'] as string) || 'UTC';
      if (!from || !to) { res.status(400).json({ error: 'from and to query params required' }); return; }

      const slots = await getAvailableSlots(cfg.coachSlug, from, to, tz);
      res.json(slots);
    } catch (e) { next(e); }
  },
);

// Cancel booking — coach/admin can cancel any booking in their org; a
// coachee may only cancel a booking linked to them (booking.coacheeId === me).
router.delete(
  '/bookings/:id',
  requireRole('coach', 'admin', 'coachee'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await Booking.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

      if (req.user!.role === 'coachee') {
        if (!booking.coacheeId || String(booking.coacheeId) !== String(req.user!.userId)) {
          res.status(403).json({ error: 'You can only cancel your own bookings.' });
          return;
        }
      }

      const cancelledBy: 'client' | 'coach' =
        req.user!.role === 'coachee' ? 'client' : 'coach';

      const result = await cancelBooking(
        req.params['id'],
        cancelledBy,
        req.body?.reason,
      );
      res.json(result);
    } catch (e) { next(e); }
  },
);

// Reschedule booking — coach/admin can reschedule any booking in their
// org; coachees may only reschedule their own. Optional note flows into
// the reschedule confirmation email.
router.patch(
  '/bookings/:id/reschedule',
  requireRole('coach', 'admin', 'coachee'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { newStartTime, note } = req.body as { newStartTime?: string; note?: string };
      if (!newStartTime) {
        res.status(400).json({ error: 'newStartTime is required' }); return;
      }
      const newStart = new Date(newStartTime);
      if (isNaN(newStart.getTime())) {
        res.status(400).json({ error: 'newStartTime is not a valid date' }); return;
      }

      const booking = await Booking.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

      if (req.user!.role === 'coachee') {
        if (!booking.coacheeId || String(booking.coacheeId) !== String(req.user!.userId)) {
          res.status(403).json({ error: 'You can only reschedule your own bookings.' });
          return;
        }
      }

      const durationMs = booking.endTime.getTime() - booking.startTime.getTime();
      const newEnd = new Date(newStart.getTime() + durationMs);

      const triggeredBy: 'admin' | 'coachee' =
        req.user!.role === 'coachee' ? 'coachee' : 'admin';

      const updated = await rescheduleBooking(
        req.params['id'], newStart, newEnd, triggeredBy, note,
      );
      res.json(updated);
    } catch (e) { next(e); }
  },
);

// ── Calendar import ────────────────────────────────────────────────────────
router.get('/import/preview',  requireRole('coach', 'admin'), bookingImport.preview);
router.post('/import/execute', requireRole('coach', 'admin'), bookingImport.execute);

export default router;

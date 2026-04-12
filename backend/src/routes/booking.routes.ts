import { Router, Response, NextFunction, Request } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { Booking } from '../models/Booking.model';
import { User } from '../models/User.model';
import {
  getAvailableSlots,
  getPublicCoachInfo,
  invalidateSlotCache,
} from '../services/availability.service';
import { createBooking, cancelBooking, clientCancelBooking } from '../services/booking.service';

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

// Create booking
publicBookingRouter.post('/:coachSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { coachSlug } = req.params;
    const { startTime, endTime, clientName, clientEmail, clientPhone, topic, clientTimezone } = req.body;

    if (!startTime || !endTime || !clientName || !clientEmail) {
      res.status(400).json({ error: 'startTime, endTime, clientName, and clientEmail are required' });
      return;
    }

    const booking = await createBooking(coachSlug, {
      startTime, endTime, clientName, clientEmail, clientPhone, topic, clientTimezone,
    });

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
});

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

      const existing = await BookingSettings.findOne({ coachId, organizationId });
      if (existing) {
        const updateData = { ...req.body };
        delete updateData.coachId;
        delete updateData.organizationId;
        Object.assign(existing, updateData);
        await existing.save();

        // Invalidate cache for all of this coach's event types
        const eventTypes = await AvailabilityConfig.find({ coachId, organizationId });
        for (const et of eventTypes) invalidateSlotCache(et.coachSlug);

        res.json(existing);
      } else {
        const settings = await BookingSettings.create({
          ...req.body,
          coachId,
          organizationId,
        });
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

      const coach = await User.findById(coachId).select('firstName lastName');
      const coachNameSlug = coach
        ? slugify(`${coach.firstName}-${coach.lastName}`)
        : 'coach';
      const eventNameSlug = slugify(req.body.name || 'session');
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

      // Don't change slug (would break shared links)
      const updateData = { ...req.body };
      delete updateData.coachSlug;
      delete updateData.coachId;
      delete updateData.organizationId;

      Object.assign(cfg, updateData);
      await cfg.save();
      invalidateSlotCache(cfg.coachSlug);
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

// Cancel booking (coach-side)
router.delete(
  '/bookings/:id',
  requireRole('coach', 'admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const booking = await Booking.findOne({
        _id: req.params['id'],
        organizationId: req.user!.organizationId,
      });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

      const result = await cancelBooking(
        req.params['id'],
        'coach',
        req.body?.reason,
      );
      res.json(result);
    } catch (e) { next(e); }
  },
);

export default router;

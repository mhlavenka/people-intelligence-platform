import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.model';
import { AvailabilityConfig } from '../src/models/AvailabilityConfig.model';
import { BookingSettings } from '../src/models/BookingSettings.model';
import { Booking } from '../src/models/Booking.model';

let mongod: MongoMemoryServer | null = null;

export async function startTestDB(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

export async function stopTestDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  mongod = null;
}

export async function resetTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

export async function seedCoach(overrides: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  connected: boolean;
  calendarId: string;
}> = {}): Promise<{
  orgId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  calendarId: string;
}> {
  const orgId = new mongoose.Types.ObjectId();
  const calendarId = overrides.calendarId ?? 'coach@example.com';
  const coach = await User.create({
    organizationId: orgId,
    email: overrides.email ?? 'coach@example.com',
    passwordHash: await bcrypt.hash('pw', 1),
    role: 'coach',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'Coach',
    isActive: true,
    googleCalendar: {
      connected: overrides.connected ?? true,
      calendarId,
      accessToken: 'fake-access',
      refreshToken: 'fake-refresh',
      tokenExpiry: new Date(Date.now() + 3600_000),
    },
  });
  return { orgId, coachId: coach._id as mongoose.Types.ObjectId, calendarId };
}

export async function seedEventType(opts: {
  coachId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  coachSlug?: string;
  appointmentDuration?: number;
  targetCalendarId?: string;
  conflictCalendarIds?: string[];
  minNoticeHours?: number;
}): Promise<string> {
  const slug = opts.coachSlug ?? `slug-${Date.now()}`;
  await AvailabilityConfig.create({
    coachId: opts.coachId,
    organizationId: opts.orgId,
    name: 'Test Session',
    coachSlug: slug,
    timezone: 'America/Toronto',
    appointmentDuration: opts.appointmentDuration ?? 60,
    bufferTime: 0,
    minNoticeHours: opts.minNoticeHours ?? 0,
    maxAdvanceDays: 60,
    weeklySchedule: Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i, startTime: '09:00', endTime: '17:00', enabled: true,
    })),
    dateOverrides: [],
    targetCalendarId: opts.targetCalendarId ?? 'coach@example.com',
    conflictCalendarIds: opts.conflictCalendarIds ?? [],
    googleMeetEnabled: false,
    isActive: true,
  });
  return slug;
}

export async function seedBookingSettings(opts: {
  coachId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  targetCalendarId?: string;
  conflictCalendarIds?: string[];
}): Promise<void> {
  await BookingSettings.create({
    coachId: opts.coachId,
    organizationId: opts.orgId,
    timezone: 'America/Toronto',
    weeklySchedule: Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i, startTime: '09:00', endTime: '17:00', enabled: true,
    })),
    dateOverrides: [],
    targetCalendarId: opts.targetCalendarId ?? 'coach@example.com',
    conflictCalendarIds: opts.conflictCalendarIds ?? [],
  });
}

export async function seedBooking(opts: {
  coachId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  googleEventId?: string;
  startTime?: Date;
  endTime?: Date;
  status?: 'confirmed' | 'cancelled' | 'completed';
}): Promise<mongoose.Document> {
  const start = opts.startTime ?? new Date(Date.now() + 48 * 3600_000);
  const end = opts.endTime ?? new Date(start.getTime() + 60 * 60_000);
  return Booking.create({
    coachId: opts.coachId,
    organizationId: opts.orgId,
    clientName: 'Client',
    clientEmail: 'client@example.com',
    startTime: start,
    endTime: end,
    clientTimezone: 'America/Toronto',
    coachTimezone: 'America/Toronto',
    googleEventId: opts.googleEventId,
    status: opts.status ?? 'confirmed',
    remindersSent: [],
    rescheduleHistory: [],
  });
}

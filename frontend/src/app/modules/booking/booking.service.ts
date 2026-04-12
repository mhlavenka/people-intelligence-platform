import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeeklySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

export interface DateOverride {
  date: string;
  startTime: string;
  endTime: string;
  isUnavailable: boolean;
}

export interface AvailabilityConfig {
  _id?: string;
  coachId: string;
  name: string;
  color: string;
  coachSlug: string;
  timezone: string;
  appointmentDuration: number;
  bufferTime: number;
  maxBookingsPerDay: number | null;
  minNoticeHours: number;
  maxAdvanceDays: number;
  weeklySchedule: WeeklySlot[];
  dateOverrides: DateOverride[];
  targetCalendarId: string;
  conflictCalendarIds: string[];
  googleMeetEnabled: boolean;
  bookingPageTitle: string;
  bookingPageDesc: string;
  isActive: boolean;
  createdAt?: string;
}

export interface BookingRecord {
  _id: string;
  coachId: string;
  eventTypeId?: string;
  eventTypeName?: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  topic?: string;
  startTime: string;
  endTime: string;
  clientTimezone: string;
  coachTimezone: string;
  googleEventId?: string;
  googleMeetLink?: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface BookingsPage {
  bookings: BookingRecord[];
  total: number;
  page: number;
  pages: number;
}

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

export interface CoachPublicInfo {
  coachName: string;
  coachEmail: string;
  title: string;
  description: string;
  duration: number;
  timezone: string;
}

export interface BookingResult {
  _id: string;
  startTime: string;
  endTime: string;
  clientTimezone: string;
  coachTimezone: string;
  googleMeetLink?: string;
  status: string;
}

export interface BookingSettingsData {
  _id?: string;
  coachId?: string;
  timezone: string;
  weeklySchedule: WeeklySlot[];
  dateOverrides: DateOverride[];
  targetCalendarId: string;
  conflictCalendarIds: string[];
}

// ─── Event type colors ──────────────────────────────────────────────────────

export const EVENT_TYPE_COLORS = [
  '#3A9FD6', '#27C4A0', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

// ─── Admin Booking Service ──────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BookingService {
  constructor(private api: ApiService) {}

  // Shared settings
  getSettings(): Observable<BookingSettingsData | null> {
    return this.api.get<BookingSettingsData | null>('/booking/settings');
  }

  saveSettings(data: Partial<BookingSettingsData>): Observable<BookingSettingsData> {
    return this.api.put<BookingSettingsData>('/booking/settings', data);
  }

  // Event types
  getEventTypes(): Observable<AvailabilityConfig[]> {
    return this.api.get<AvailabilityConfig[]>('/booking/event-types');
  }

  getEventType(id: string): Observable<AvailabilityConfig> {
    return this.api.get<AvailabilityConfig>(`/booking/event-types/${id}`);
  }

  createEventType(cfg: Partial<AvailabilityConfig>): Observable<AvailabilityConfig> {
    return this.api.post<AvailabilityConfig>('/booking/event-types', cfg);
  }

  updateEventType(id: string, cfg: Partial<AvailabilityConfig>): Observable<AvailabilityConfig> {
    return this.api.put<AvailabilityConfig>(`/booking/event-types/${id}`, cfg);
  }

  deleteEventType(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/booking/event-types/${id}`);
  }

  // Bookings
  getBookings(tab: string, page = 1, limit = 20, eventTypeId?: string): Observable<BookingsPage> {
    const params: Record<string, string> = { tab, page: String(page), limit: String(limit) };
    if (eventTypeId) params['eventTypeId'] = eventTypeId;
    return this.api.get<BookingsPage>('/booking/bookings', params);
  }

  getBooking(id: string): Observable<BookingRecord> {
    return this.api.get<BookingRecord>(`/booking/bookings/${id}`);
  }

  cancelBooking(id: string, reason?: string): Observable<BookingRecord> {
    return this.api.delete<BookingRecord>(`/booking/bookings/${id}`, { body: { reason } });
  }
}

// ─── Public Booking Service (no auth) ────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PublicBookingService {
  constructor(private api: ApiService) {}

  getCoachInfo(coachSlug: string): Observable<CoachPublicInfo> {
    return this.api.get<CoachPublicInfo>(`/public/booking/${coachSlug}`);
  }

  getSlots(coachSlug: string, from: string, to: string, tz: string): Observable<AvailableSlot[]> {
    return this.api.get<AvailableSlot[]>(`/public/booking/${coachSlug}/slots`, { from, to, tz });
  }

  createBooking(coachSlug: string, data: {
    startTime: string;
    endTime: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    topic?: string;
    clientTimezone?: string;
  }): Observable<BookingResult> {
    return this.api.post<BookingResult>(`/public/booking/${coachSlug}`, data);
  }

  getConfirmation(coachSlug: string, bookingId: string): Observable<{
    booking: BookingResult;
    coachName: string;
    duration: number;
    clientEmail: string;
  }> {
    return this.api.get(`/public/booking/${coachSlug}/confirmation/${bookingId}`);
  }

  cancelBooking(coachSlug: string, bookingId: string, token: string): Observable<{ message: string }> {
    return this.api.get<{ message: string }>(`/public/booking/${coachSlug}/cancel/${bookingId}/${token}`);
  }
}

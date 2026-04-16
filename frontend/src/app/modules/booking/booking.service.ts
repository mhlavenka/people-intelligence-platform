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
  scheduleMode: 'shared' | 'custom';
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
  importedAt?: string;
  importSource?: string;
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
  rescheduleDeadlineHours?: number;
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

  rescheduleBooking(id: string, newStartTime: string, note?: string): Observable<BookingRecord> {
    return this.api.patch<BookingRecord>(
      `/booking/bookings/${id}/reschedule`,
      { newStartTime, ...(note ? { note } : {}) },
    );
  }

  /** Available slots for rescheduling this booking, using the same
   *  availability engine as the public booking flow. */
  getBookingSlots(bookingId: string, from: string, to: string, tz: string): Observable<AvailableSlot[]> {
    return this.api.get<AvailableSlot[]>(`/booking/bookings/${bookingId}/slots`, { from, to, tz });
  }

  // ── Public holidays ──────────────────────────────────────────────────────
  getHolidays(year: number, country?: string): Observable<HolidaysResponse> {
    const params: Record<string, string> = { year: String(year) };
    if (country) params['country'] = country;
    return this.api.get<HolidaysResponse>('/booking/holidays', params);
  }

  getHolidayCountries(): Observable<HolidayCountry[]> {
    return this.api.get<HolidayCountry[]>('/booking/holidays/countries');
  }

  // ── Google Calendar import ───────────────────────────────────────────────
  previewImport(from: string, to: string, calendarId?: string): Observable<ImportPreviewResponse> {
    const params: Record<string, string> = { from, to };
    if (calendarId) params['calendarId'] = calendarId;
    return this.api.get<ImportPreviewResponse>('/booking/import/preview', params);
  }

  executeImport(
    approvedEventIds: string[],
    overrides?: Record<string, {
      clientName?: string;
      topic?: string | null;
      coacheeId?: string | null;
      eventTypeId?: string | null;
    }>,
    suggestions?: Record<string, {
      suggestedCoacheeId?: string | null;
      suggestedEventTypeId?: string | null;
    }>,
    calendarId?: string,
  ): Observable<ImportResultResponse> {
    return this.api.post<ImportResultResponse>('/booking/import/execute', {
      approvedEventIds,
      overrides,
      suggestions,
      ...(calendarId ? { calendarId } : {}),
    });
  }
}

// ─── Holidays ────────────────────────────────────────────────────────────────

export interface HolidayItem {
  date: string;   // YYYY-MM-DD
  name: string;
  type: 'public' | 'bank' | string;
}

export interface HolidaysResponse {
  country: string;
  year: number;
  holidays: HolidayItem[];
}

export interface HolidayCountry {
  code: string;   // ISO 3166-1 alpha-2
  name: string;   // English country name
}

// ─── Import types ────────────────────────────────────────────────────────────

export interface ImportAttendee {
  email: string;
  displayName: string | null;
  self: boolean;
  organizer: boolean;
}

export interface ImportEvent {
  googleEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientName: string;
  clientEmail: string | null;
  topic: string | null;
  googleMeetLink: string | null;
  status: 'upcoming' | 'completed';
  alreadyImported: boolean;
  rawSummary: string;
  attendees: ImportAttendee[];
  suggestedCoacheeId: string | null;
  suggestedEventTypeId: string | null;
  // UI-local state (not from API):
  approved?: boolean;
  editedTopic?: string;
  /** null = explicitly unlinked, undefined = use suggestion, string = picked. */
  pickedCoacheeId?: string | null;
  pickedEventTypeId?: string | null;
  expanded?: boolean;
}

export interface ImportCoachee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ImportEventType {
  _id: string;
  name: string;
  color: string;
  appointmentDuration: number;
}

export interface ImportPreviewResponse {
  total: number;
  filtered: number;
  alreadyImported: number;
  events: ImportEvent[];
  coachees: ImportCoachee[];
  eventTypes: ImportEventType[];
}

export interface ImportResultResponse {
  imported: number;
  skipped: number;
  errors: Array<{ googleEventId: string; message: string }>;
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

  getCoachLanding(slug: string): Observable<CoachLanding> {
    return this.api.get<CoachLanding>(`/public/coach/${slug}`);
  }
}

// ─── Coach landing page types ───────────────────────────────────────────────

export interface CoachLanding {
  coach: {
    firstName: string;
    lastName: string;
    profilePicture: string | null;
    bio: string;
    slug: string;
  };
  eventTypes: CoachLandingEventType[];
}

export interface CoachLandingEventType {
  _id: string;
  name: string;
  color: string;
  coachSlug: string;
  duration: number;
  title: string;
  description: string;
  googleMeetEnabled: boolean;
}

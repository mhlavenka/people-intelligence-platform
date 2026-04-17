import mongoose from 'mongoose';

export type CalendarProvider = 'google' | 'microsoft';

export interface CreateEventParams {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail?: string;
  location?: string;
  enableVideoConference?: boolean;
}

export interface UpdateEventParams {
  summary?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  attendeeEmail?: string;
  location?: string;
  status?: string;
}

export interface CalendarEventResult {
  eventId: string;
  meetLink?: string;
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export interface CalendarListItem {
  id: string;
  name: string;
}

export interface WebhookRegistrationResult {
  channelId: string;
  resourceId?: string;
  expiration: Date;
}

export interface WebhookNotificationHeaders {
  [key: string]: string | undefined;
}

export interface ICalendarProvider {
  readonly provider: CalendarProvider;

  getAuthUrl(userId: string): string;
  exchangeCodeForTokens(code: string, userId: string): Promise<void>;
  listCalendars(coachId: string): Promise<CalendarListItem[]>;

  createEvent(coachId: string, calendarId: string, params: CreateEventParams): Promise<CalendarEventResult>;
  updateEvent(coachId: string, calendarId: string, eventId: string, params: UpdateEventParams): Promise<void>;
  deleteEvent(coachId: string, calendarId: string, eventId: string): Promise<void>;
  queryFreebusy(coachId: string, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyPeriod[]>;
}

export interface ICalendarConnectionData {
  provider: CalendarProvider;
  connected: boolean;
  calendarId?: string;
  calendarName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

export function getCalendarTokenSelectFields(provider: CalendarProvider): string {
  if (provider === 'google') {
    return '+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar.connected googleCalendar.tokenExpiry googleCalendar.calendarId';
  }
  return '+microsoftCalendar.accessToken +microsoftCalendar.refreshToken microsoftCalendar.connected microsoftCalendar.tokenExpiry microsoftCalendar.calendarId';
}

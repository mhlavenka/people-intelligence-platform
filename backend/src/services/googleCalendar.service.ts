import { googleCalendarProvider } from './calendar/google.provider';
import { User } from '../models/User.model';

export function getAuthUrl(userId: string): string {
  return googleCalendarProvider.getAuthUrl(userId);
}

export async function exchangeCodeForTokens(code: string, userId: string): Promise<void> {
  return googleCalendarProvider.exchangeCodeForTokens(code, userId);
}

export async function listCoachCalendars(coachId: string): Promise<{ id: string; summary: string }[]> {
  const items = await googleCalendarProvider.listCalendars(coachId);
  return items.map((c) => ({ id: c.id, summary: c.name }));
}

export async function createCalendarEvent(
  coachId: string,
  session: {
    date: Date;
    duration: number;
    coacheeName: string;
    coacheeEmail?: string;
    module?: string;
    sharedNotes?: string;
    meetingLink?: string;
  },
): Promise<{ eventId: string; meetLink?: string }> {
  const coach = await User.findById(coachId).select('googleCalendar.calendarId');
  const calendarId = coach?.googleCalendar?.calendarId || 'primary';

  const start = new Date(session.date);
  const end = new Date(start.getTime() + (session.duration || 60) * 60_000);

  return googleCalendarProvider.createEvent(coachId, calendarId, {
    summary: `Coaching Session \u2013 ${session.coacheeName}`,
    description: [
      session.module ? `Module: ${session.module}` : '',
      session.sharedNotes ? `Notes: ${session.sharedNotes}` : '',
    ].filter(Boolean).join('\n'),
    startTime: start,
    endTime: end,
    attendeeEmail: session.coacheeEmail,
    location: session.meetingLink,
    enableVideoConference: true,
  });
}

export async function updateCalendarEvent(
  coachId: string,
  googleEventId: string,
  session: {
    date: Date;
    duration: number;
    coacheeName: string;
    coacheeEmail?: string;
    module?: string;
    sharedNotes?: string;
    meetingLink?: string;
    status?: string;
  },
): Promise<void> {
  const coach = await User.findById(coachId).select('googleCalendar.calendarId');
  const calendarId = coach?.googleCalendar?.calendarId || 'primary';

  const start = new Date(session.date);
  const end = new Date(start.getTime() + (session.duration || 60) * 60_000);

  return googleCalendarProvider.updateEvent(coachId, calendarId, googleEventId, {
    summary: `Coaching Session \u2013 ${session.coacheeName}${session.status === 'cancelled' ? ' (Cancelled)' : ''}`,
    description: [
      session.module ? `Module: ${session.module}` : '',
      session.sharedNotes ? `Notes: ${session.sharedNotes}` : '',
    ].filter(Boolean).join('\n'),
    startTime: start,
    endTime: end,
    attendeeEmail: session.coacheeEmail,
    location: session.meetingLink,
  });
}

export async function deleteCalendarEvent(coachId: string, googleEventId: string): Promise<void> {
  const coach = await User.findById(coachId).select('googleCalendar.calendarId');
  const calendarId = coach?.googleCalendar?.calendarId || 'primary';
  return googleCalendarProvider.deleteEvent(coachId, calendarId, googleEventId);
}

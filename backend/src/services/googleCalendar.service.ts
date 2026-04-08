import { google, calendar_v3 } from 'googleapis';
import { config } from '../config/env';
import { User } from '../models/User.model';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',  // needed for calendarList.list()
];

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.oauth.google.clientId,
    config.oauth.google.clientSecret,
    config.oauth.google.calendarRedirectUri,
  );
}

/** Generate the Google OAuth consent URL, embedding the coach's userId in `state`. */
export function getAuthUrl(userId: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId,
  });
}

/** Exchange the authorization code for tokens and persist them on the coach document. */
export async function exchangeCodeForTokens(code: string, userId: string): Promise<void> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  await User.findByIdAndUpdate(userId, {
    'googleCalendar.connected': true,
    'googleCalendar.accessToken': tokens.access_token,
    'googleCalendar.refreshToken': tokens.refresh_token,
    'googleCalendar.tokenExpiry': tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  });
}

/** Build an authenticated OAuth2 client for a coach, refreshing the token if needed. */
async function getAuthenticatedClient(coachId: string) {
  const coach = await User.findById(coachId).select('+googleCalendar.accessToken +googleCalendar.refreshToken');
  if (!coach?.googleCalendar?.connected || !coach.googleCalendar.refreshToken) {
    throw new Error('Google Calendar not connected');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: coach.googleCalendar.accessToken,
    refresh_token: coach.googleCalendar.refreshToken,
    expiry_date: coach.googleCalendar.tokenExpiry?.getTime(),
  });

  // Auto-refresh if expired
  const now = Date.now();
  const expiry = coach.googleCalendar.tokenExpiry?.getTime() ?? 0;
  if (now >= expiry - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await User.findByIdAndUpdate(coachId, {
      'googleCalendar.accessToken': credentials.access_token,
      'googleCalendar.tokenExpiry': credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    });
  }

  return { client, coach };
}

/** List calendars the coach has access to (for the calendar picker). */
export async function listCoachCalendars(coachId: string): Promise<{ id: string; summary: string }[]> {
  const { client } = await getAuthenticatedClient(coachId);
  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.calendarList.list({ minAccessRole: 'writer' });
  return (res.data.items ?? []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? '',
  }));
}

/** Create a calendar event for a coaching session. Returns the Google event ID. */
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
): Promise<string> {
  const { client, coach } = await getAuthenticatedClient(coachId);
  const calendarId = coach.googleCalendar!.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: client });

  const start = new Date(session.date);
  const end = new Date(start.getTime() + (session.duration || 60) * 60_000);

  const event: calendar_v3.Schema$Event = {
    summary: `Coaching Session \u2013 ${session.coacheeName}`,
    description: [
      session.module ? `Module: ${session.module}` : '',
      session.sharedNotes ? `Notes: ${session.sharedNotes}` : '',
    ].filter(Boolean).join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  if (session.coacheeEmail) {
    event.attendees = [{ email: session.coacheeEmail }];
  }
  if (session.meetingLink) {
    event.location = session.meetingLink;
  }

  const res = await calendar.events.insert({ calendarId, requestBody: event });
  return res.data.id!;
}

/** Update an existing Google Calendar event when a session changes. */
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
  const { client, coach } = await getAuthenticatedClient(coachId);
  const calendarId = coach.googleCalendar!.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: client });

  const start = new Date(session.date);
  const end = new Date(start.getTime() + (session.duration || 60) * 60_000);

  const event: calendar_v3.Schema$Event = {
    summary: `Coaching Session \u2013 ${session.coacheeName}${session.status === 'cancelled' ? ' (Cancelled)' : ''}`,
    description: [
      session.module ? `Module: ${session.module}` : '',
      session.sharedNotes ? `Notes: ${session.sharedNotes}` : '',
    ].filter(Boolean).join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };

  if (session.coacheeEmail) {
    event.attendees = [{ email: session.coacheeEmail }];
  }
  if (session.meetingLink) {
    event.location = session.meetingLink;
  }

  await calendar.events.update({ calendarId, eventId: googleEventId, requestBody: event });
}

/** Delete a Google Calendar event. */
export async function deleteCalendarEvent(coachId: string, googleEventId: string): Promise<void> {
  const { client, coach } = await getAuthenticatedClient(coachId);
  const calendarId = coach.googleCalendar!.calendarId || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.delete({ calendarId, eventId: googleEventId });
}

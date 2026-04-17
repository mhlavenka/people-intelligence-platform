import { calendar as calendarApi, calendar_v3 } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/env';
import { User } from '../../models/User.model';
import {
  ICalendarProvider,
  CalendarListItem,
  CreateEventParams,
  CalendarEventResult,
  UpdateEventParams,
  BusyPeriod,
} from './calendar.interface';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function createOAuth2Client() {
  return new OAuth2Client(
    config.oauth.google.clientId,
    config.oauth.google.clientSecret,
    config.oauth.google.calendarRedirectUri,
  );
}

async function getAuthenticatedClient(coachId: string) {
  const coach = await User.findById(coachId).select(
    '+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar.connected googleCalendar.tokenExpiry googleCalendar.calendarId',
  );
  if (!coach?.googleCalendar?.connected || !coach.googleCalendar.refreshToken) {
    throw new Error('Google Calendar not connected');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: coach.googleCalendar.accessToken,
    refresh_token: coach.googleCalendar.refreshToken,
    expiry_date: coach.googleCalendar.tokenExpiry?.getTime(),
  });

  const now = Date.now();
  const expiry = coach.googleCalendar.tokenExpiry?.getTime() ?? 0;
  if (now >= expiry - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await User.findByIdAndUpdate(coachId, {
      'googleCalendar.accessToken': credentials.access_token,
      'googleCalendar.tokenExpiry': credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : undefined,
    });
  }

  return { client, calendarId: coach.googleCalendar.calendarId };
}

export function getGoogleAuthenticatedClient(coachId: string) {
  return getAuthenticatedClient(coachId).then(({ client }) => client);
}

export const googleCalendarProvider: ICalendarProvider = {
  provider: 'google',

  getAuthUrl(userId: string): string {
    const client = createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: userId,
    });
  },

  async exchangeCodeForTokens(code: string, userId: string): Promise<void> {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    await User.findByIdAndUpdate(userId, {
      'googleCalendar.connected': true,
      'googleCalendar.accessToken': tokens.access_token,
      'googleCalendar.refreshToken': tokens.refresh_token,
      'googleCalendar.tokenExpiry': tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    });
  },

  async listCalendars(coachId: string): Promise<CalendarListItem[]> {
    const { client } = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth: client });
    const res = await calendar.calendarList.list({ minAccessRole: 'writer' });
    return (res.data.items ?? []).map((c) => ({
      id: c.id ?? '',
      name: c.summary ?? '',
    }));
  },

  async createEvent(coachId: string, calendarId: string, params: CreateEventParams): Promise<CalendarEventResult> {
    const { client } = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth: client });

    const event: calendar_v3.Schema$Event = {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime.toISOString() },
      end: { dateTime: params.endTime.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (params.attendeeEmail) {
      const coachee = await User.findOne({ email: params.attendeeEmail })
        .select('notificationPreferences').lean();
      if (coachee?.notificationPreferences?.calendarInvites !== false) {
        event.attendees = [{ email: params.attendeeEmail }];
      }
    }
    if (params.location) {
      event.location = params.location;
    }
    if (params.enableVideoConference) {
      event.conferenceData = {
        createRequest: {
          requestId: `artes-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
      conferenceDataVersion: params.enableVideoConference ? 1 : 0,
      sendUpdates: 'none',
    });

    const meetLink = res.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video',
    )?.uri;

    return { eventId: res.data.id!, meetLink: meetLink || undefined };
  },

  async updateEvent(coachId: string, calendarId: string, eventId: string, params: UpdateEventParams): Promise<void> {
    const { client } = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth: client });

    const event: calendar_v3.Schema$Event = {};
    if (params.summary !== undefined) event.summary = params.summary;
    if (params.description !== undefined) event.description = params.description;
    if (params.startTime) event.start = { dateTime: params.startTime.toISOString() };
    if (params.endTime) event.end = { dateTime: params.endTime.toISOString() };
    if (params.location) event.location = params.location;

    if (params.attendeeEmail) {
      const coachee = await User.findOne({ email: params.attendeeEmail })
        .select('notificationPreferences').lean();
      if (coachee?.notificationPreferences?.calendarInvites !== false) {
        event.attendees = [{ email: params.attendeeEmail }];
      }
    }

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: event,
      sendUpdates: 'none',
    });
  },

  async deleteEvent(coachId: string, calendarId: string, eventId: string): Promise<void> {
    const { client } = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth: client });
    await calendar.events.delete({ calendarId, eventId, sendUpdates: 'none' });
  },

  async queryFreebusy(coachId: string, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyPeriod[]> {
    if (!calendarIds.length) return [];
    const uniqueIds = Array.from(new Set(calendarIds.filter(Boolean)));

    try {
      const { client } = await getAuthenticatedClient(coachId);
      const calendar = calendarApi({ version: 'v3', auth: client });
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: uniqueIds.map((id) => ({ id })),
        },
      });

      const calendars = res.data.calendars ?? {};
      const busy: BusyPeriod[] = [];
      for (const calId of Object.keys(calendars)) {
        for (const b of calendars[calId]?.busy ?? []) {
          if (b.start && b.end) busy.push({ start: b.start, end: b.end });
        }
      }
      return busy;
    } catch (err) {
      console.error('[GoogleCalendar] freebusy query failed:', err);
      return [];
    }
  },
};

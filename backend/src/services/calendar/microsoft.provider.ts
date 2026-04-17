import { Client } from '@microsoft/microsoft-graph-client';
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
  'Calendars.ReadWrite',
  'Calendars.Read',
  'User.Read',
  'offline_access',
];


async function getAuthenticatedGraphClient(coachId: string): Promise<Client> {
  const coach = await User.findById(coachId).select(
    '+microsoftCalendar.accessToken +microsoftCalendar.refreshToken microsoftCalendar.connected microsoftCalendar.tokenExpiry microsoftCalendar.calendarId',
  );
  if (!coach?.microsoftCalendar?.connected || !coach.microsoftCalendar.refreshToken) {
    throw new Error('Microsoft Calendar not connected');
  }

  let accessToken = coach.microsoftCalendar.accessToken!;
  const expiry = coach.microsoftCalendar.tokenExpiry?.getTime() ?? 0;

  if (Date.now() >= expiry - 60_000) {
    const body = new URLSearchParams({
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      refresh_token: coach.microsoftCalendar.refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES.join(' '),
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    const data = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!response.ok || !data.access_token) {
      throw new Error(`Failed to refresh Microsoft token: ${data.error}`);
    }

    accessToken = data.access_token;
    const newExpiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    await User.findByIdAndUpdate(coachId, {
      'microsoftCalendar.accessToken': accessToken,
      'microsoftCalendar.refreshToken': data.refresh_token || coach.microsoftCalendar.refreshToken,
      'microsoftCalendar.tokenExpiry': newExpiry,
    });
  }

  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export const microsoftCalendarProvider: ICalendarProvider = {
  provider: 'microsoft',

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: config.oauth.microsoft.clientId,
      response_type: 'code',
      redirect_uri: config.oauth.microsoft.calendarRedirectUri,
      response_mode: 'query',
      scope: SCOPES.join(' '),
      state: userId,
      prompt: 'consent',
    });
    return `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeCodeForTokens(code: string, userId: string): Promise<void> {
    // Direct HTTP token exchange — more reliable than MSAL for the common endpoint
    const body = new URLSearchParams({
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      code,
      redirect_uri: config.oauth.microsoft.calendarRedirectUri,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' '),
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    const data = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || data.error) {
      throw new Error(`Microsoft token exchange failed: ${data.error_description || data.error}`);
    }
    if (!data.refresh_token) {
      throw new Error('Microsoft did not return a refresh token — ensure offline_access scope is requested');
    }

    const tokenExpiry = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;

    await User.findByIdAndUpdate(userId, {
      'microsoftCalendar.connected': true,
      'microsoftCalendar.accessToken': data.access_token,
      'microsoftCalendar.refreshToken': data.refresh_token,
      'microsoftCalendar.tokenExpiry': tokenExpiry,
    });
  },

  async listCalendars(coachId: string): Promise<CalendarListItem[]> {
    const client = await getAuthenticatedGraphClient(coachId);
    const response = await client
      .api('/me/calendars')
      .select('id,name,canEdit')
      .get();

    return (response.value || [])
      .filter((cal: { canEdit?: boolean }) => cal.canEdit !== false)
      .map((cal: { id: string; name: string }) => ({
        id: cal.id,
        name: cal.name,
      }));
  },

  async createEvent(coachId: string, calendarId: string, params: CreateEventParams): Promise<CalendarEventResult> {
    const client = await getAuthenticatedGraphClient(coachId);

    const event: Record<string, unknown> = {
      subject: params.summary,
      body: params.description ? { contentType: 'text', content: params.description } : undefined,
      start: {
        dateTime: params.startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: params.endTime.toISOString(),
        timeZone: 'UTC',
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 30,
    };

    if (params.attendeeEmail) {
      event.attendees = [{
        emailAddress: { address: params.attendeeEmail },
        type: 'required',
      }];
    }

    if (params.location) {
      event.location = { displayName: params.location };
    }

    if (params.enableVideoConference) {
      event.isOnlineMeeting = true;
      event.onlineMeetingProvider = 'teamsForBusiness';
    }

    const response = await client
      .api(`/me/calendars/${calendarId}/events`)
      .post(event);

    const teamsLink = response.onlineMeeting?.joinUrl || undefined;

    return {
      eventId: response.id,
      meetLink: teamsLink,
    };
  },

  async updateEvent(coachId: string, _calendarId: string, eventId: string, params: UpdateEventParams): Promise<void> {
    const client = await getAuthenticatedGraphClient(coachId);

    const patch: Record<string, unknown> = {};
    if (params.summary !== undefined) patch.subject = params.summary;
    if (params.description !== undefined) {
      patch.body = { contentType: 'text', content: params.description };
    }
    if (params.startTime) {
      patch.start = { dateTime: params.startTime.toISOString(), timeZone: 'UTC' };
    }
    if (params.endTime) {
      patch.end = { dateTime: params.endTime.toISOString(), timeZone: 'UTC' };
    }
    if (params.location) {
      patch.location = { displayName: params.location };
    }
    if (params.attendeeEmail) {
      patch.attendees = [{
        emailAddress: { address: params.attendeeEmail },
        type: 'required',
      }];
    }

    await client.api(`/me/events/${eventId}`).patch(patch);
  },

  async deleteEvent(coachId: string, _calendarId: string, eventId: string): Promise<void> {
    const client = await getAuthenticatedGraphClient(coachId);
    await client.api(`/me/events/${eventId}`).delete();
  },

  async queryFreebusy(coachId: string, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyPeriod[]> {
    if (!calendarIds.length) return [];

    const client = await getAuthenticatedGraphClient(coachId);

    try {
      // Microsoft Graph getSchedule requires email addresses, not calendar IDs.
      // For the coach's own calendars, we use calendarView instead.
      const busy: BusyPeriod[] = [];

      for (const calId of calendarIds) {
        const response = await client
          .api(`/me/calendars/${calId}/calendarView`)
          .query({
            startDateTime: timeMin,
            endDateTime: timeMax,
            $select: 'start,end,showAs',
            $top: 100,
          })
          .get();

        for (const evt of response.value || []) {
          // Only count busy events (same as Google freebusy behavior)
          if (evt.showAs === 'busy' || evt.showAs === 'tentative' || evt.showAs === 'oof') {
            if (evt.start?.dateTime && evt.end?.dateTime) {
              busy.push({
                start: evt.start.dateTime.endsWith('Z')
                  ? evt.start.dateTime
                  : evt.start.dateTime + 'Z',
                end: evt.end.dateTime.endsWith('Z')
                  ? evt.end.dateTime
                  : evt.end.dateTime + 'Z',
              });
            }
          }
        }
      }

      return busy;
    } catch (err) {
      console.error('[MicrosoftCalendar] freebusy query failed:', err);
      return [];
    }
  },
};

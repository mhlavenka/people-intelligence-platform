import { ConfidentialClientApplication } from '@azure/msal-node';
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

const msalConfig = {
  auth: {
    clientId: config.oauth.microsoft.clientId,
    authority: `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}`,
    clientSecret: config.oauth.microsoft.clientSecret,
  },
};

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication(msalConfig);
}

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
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken: coach.microsoftCalendar.refreshToken,
      scopes: SCOPES,
    });

    if (!result) throw new Error('Failed to refresh Microsoft token');

    accessToken = result.accessToken;
    const newExpiry = result.expiresOn ? new Date(result.expiresOn) : undefined;

    await User.findByIdAndUpdate(coachId, {
      'microsoftCalendar.accessToken': accessToken,
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
    const msalClient = getMsalClient();
    const authUrl = msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: config.oauth.microsoft.calendarRedirectUri,
      state: userId,
      prompt: 'consent',
    });
    // getAuthCodeUrl returns a Promise<string> but we need sync — build manually
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
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: config.oauth.microsoft.calendarRedirectUri,
    });

    if (!result) throw new Error('Failed to exchange Microsoft authorization code');

    // MSAL doesn't directly expose the refresh token in acquireTokenByCode result.
    // We need to extract it from the token cache.
    const cache = msalClient.getTokenCache().serialize();
    const cacheData = JSON.parse(cache);
    const refreshTokens = cacheData.RefreshToken || {};
    const refreshTokenEntry = Object.values(refreshTokens)[0] as { secret?: string } | undefined;
    const refreshToken = refreshTokenEntry?.secret;

    if (!refreshToken) {
      throw new Error('Microsoft did not return a refresh token — ensure offline_access scope is requested');
    }

    await User.findByIdAndUpdate(userId, {
      'microsoftCalendar.connected': true,
      'microsoftCalendar.accessToken': result.accessToken,
      'microsoftCalendar.refreshToken': refreshToken,
      'microsoftCalendar.tokenExpiry': result.expiresOn ? new Date(result.expiresOn) : undefined,
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

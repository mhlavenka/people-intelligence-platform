/**
 * BEHAVIOR 4 — Client deletes GCal event → no effect.
 *
 * This is a documentation test. We only register push notifications on
 * the coach's target calendar (see registerGoogleWebhook). Invitee-side
 * deletions happen on their own personal calendar and never reach us.
 */

jest.mock('@googleapis/calendar', () => require('./mocks/googleapis.mock'));
jest.mock('google-auth-library', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import { config } from '../src/config/env';
import { startTestDB, stopTestDB, resetTestDB, seedCoach } from './helpers';
import { registerGoogleWebhook } from '../src/services/calendarWebhook.service';
import { BookingSettings } from '../src/models/BookingSettings.model';

describe('BEHAVIOR 4 — Client deletes GCal event has no effect', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
  });

  it('webhook registration targets the coach calendar, not the attendee calendar', async () => {
    // Enable the feature flag just for this test
    (config.booking as { webhooksEnabled: boolean }).webhooksEnabled = true;

    const { coachId, orgId, calendarId } = await seedCoach();
    await BookingSettings.create({
      coachId, organizationId: orgId,
      timezone: 'America/Toronto',
      weeklySchedule: [], dateOverrides: [],
      targetCalendarId: calendarId,
      conflictCalendarIds: [calendarId],
    });

    await registerGoogleWebhook(coachId.toString());

    expect(calendarMock.events.watch).toHaveBeenCalledTimes(1);
    const [call] = calendarMock.events.watch.mock.calls;
    expect(call[0].calendarId).toBe(calendarId);
    // Not pointing at any client/invitee calendar
    expect(call[0].calendarId).not.toContain('client');

    (config.booking as { webhooksEnabled: boolean }).webhooksEnabled = false;
  });
});

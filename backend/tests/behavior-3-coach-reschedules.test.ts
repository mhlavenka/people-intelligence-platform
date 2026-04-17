/** BEHAVIOR 3 — Coach reschedules GCal event → booking updated */

jest.mock('@googleapis/calendar', () => require('./mocks/googleapis.mock'));
jest.mock('google-auth-library', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import { sesSendMock } from './mocks/ses.mock';
import {
  startTestDB, stopTestDB, resetTestDB,
  seedCoach, seedEventType, seedBooking,
} from './helpers';
import { handleGoogleNotification } from '../src/services/calendarWebhook.service';
import { WebhookState } from '../src/models/WebhookState.model';
import { Booking } from '../src/models/Booking.model';
import { config } from '../src/config/env';

describe('BEHAVIOR 3 — Coach reschedules GCal event', () => {
  let savedSecret: string;
  beforeAll(async () => {
    await startTestDB();
    savedSecret = config.booking.webhookSecret;
    (config.booking as { webhookSecret: string }).webhookSecret = '';
  });
  afterAll(async () => {
    (config.booking as { webhookSecret: string }).webhookSecret = savedSecret;
    await stopTestDB();
  });
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
    sesSendMock.mockReset();
  });

  it('updates Booking.startTime/endTime when GCal event time changed', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });

    const origStart = new Date(Date.now() + 48 * 3600_000);
    const origEnd = new Date(origStart.getTime() + 60 * 60_000);
    const booking = await seedBooking({
      coachId, orgId,
      googleEventId: 'evt-abc',
      startTime: origStart,
      endTime: origEnd,
    });

    const newStart = new Date(origStart.getTime() + 24 * 3600_000);
    const newEnd = new Date(newStart.getTime() + 60 * 60_000);

    await WebhookState.create({
      coachId, calendarId,
      channelId: 'ch-r', resourceId: 'res-r',
      expiration: new Date(Date.now() + 7 * 86400_000),
      lastProcessedAt: new Date(Date.now() - 60_000),
    });

    calendarMock.events.list.mockResolvedValueOnce({
      data: {
        items: [{
          id: 'evt-abc',
          status: 'confirmed',
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        }],
      },
    });

    await handleGoogleNotification({
      channelId: 'ch-r', resourceId: 'res-r', resourceState: 'exists',
    });

    const updated = await Booking.findById(booking._id)
      .setOptions({ bypassTenantCheck: true });
    expect(updated?.startTime.toISOString()).toBe(newStart.toISOString());
    expect(updated?.endTime.toISOString()).toBe(newEnd.toISOString());
    expect(updated?.rescheduledBy).toBe('coach_gcal');
    expect(updated?.rescheduleHistory.length).toBe(1);
    expect(updated?.rescheduleHistory[0].from.toISOString()).toBe(origStart.toISOString());
  });

  it('does NOT call events.patch — GCal already has the new time', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    await seedBooking({ coachId, orgId, googleEventId: 'evt-p' });
    await WebhookState.create({
      coachId, calendarId, channelId: 'ch-p', resourceId: 'res-p',
      expiration: new Date(Date.now() + 7 * 86400_000),
      lastProcessedAt: new Date(Date.now() - 60_000),
    });

    const newStart = new Date(Date.now() + 72 * 3600_000);
    const newEnd = new Date(newStart.getTime() + 60 * 60_000);

    calendarMock.events.list.mockResolvedValueOnce({
      data: {
        items: [{
          id: 'evt-p',
          status: 'confirmed',
          start: { dateTime: newStart.toISOString() },
          end: { dateTime: newEnd.toISOString() },
        }],
      },
    });

    await handleGoogleNotification({
      channelId: 'ch-p', resourceId: 'res-p', resourceState: 'exists',
    });

    expect(calendarMock.events.patch).not.toHaveBeenCalled();
  });
});

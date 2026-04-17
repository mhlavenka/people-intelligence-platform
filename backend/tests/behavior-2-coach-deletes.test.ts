/** BEHAVIOR 2 — Coach deletes GCal event → booking cancelled via webhook diff */

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

describe('BEHAVIOR 2 — Coach deletes GCal event', () => {
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

  it('auto-cancels the matching Booking when events.list returns status=cancelled', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    const booking = await seedBooking({
      coachId, orgId,
      googleEventId: 'evt-123',
    });
    const state = await WebhookState.create({
      coachId, calendarId,
      channelId: 'ch-1', resourceId: 'res-1',
      expiration: new Date(Date.now() + 7 * 86400_000),
      lastProcessedAt: new Date(Date.now() - 60_000),
    });

    calendarMock.events.list.mockResolvedValueOnce({
      data: { items: [{ id: 'evt-123', status: 'cancelled' }] },
    });

    await handleGoogleNotification({
      channelId: 'ch-1', resourceId: 'res-1', resourceState: 'exists',
    });

    const updated = await Booking.findById(booking._id)
      .setOptions({ bypassTenantCheck: true });
    expect(updated?.status).toBe('cancelled');
    expect(updated?.cancelledBy).toBe('coach');

    // cancelBooking will attempt events.delete; a 404 from Google is
    // handled gracefully. Behavior correctness doesn't depend on whether
    // the call was skipped — only that the 404 path doesn't break things.

    // Client should have been emailed
    await new Promise((r) => setTimeout(r, 10));
    expect(sesSendMock).toHaveBeenCalled();

    // lastProcessedAt advances
    const refreshed = await WebhookState.findById(state._id);
    expect(refreshed!.lastProcessedAt.getTime()).toBeGreaterThan(state.lastProcessedAt.getTime());
  });

  it('ignores cancelled events that do not correspond to one of our bookings', async () => {
    const { coachId, calendarId } = await seedCoach();
    await WebhookState.create({
      coachId, calendarId,
      channelId: 'ch-2', resourceId: 'res-2',
      expiration: new Date(Date.now() + 7 * 86400_000),
      lastProcessedAt: new Date(),
    });

    calendarMock.events.list.mockResolvedValueOnce({
      data: { items: [{ id: 'unrelated-evt', status: 'cancelled' }] },
    });

    await expect(
      handleGoogleNotification({
        channelId: 'ch-2', resourceId: 'res-2', resourceState: 'exists',
      }),
    ).resolves.not.toThrow();
  });

  it('ignores sync handshake notifications', async () => {
    const { coachId, calendarId } = await seedCoach();
    await WebhookState.create({
      coachId, calendarId,
      channelId: 'ch-3', resourceId: 'res-3',
      expiration: new Date(Date.now() + 7 * 86400_000),
      lastProcessedAt: new Date(),
    });

    await handleGoogleNotification({
      channelId: 'ch-3', resourceId: 'res-3', resourceState: 'sync',
    });
    expect(calendarMock.events.list).not.toHaveBeenCalled();
  });
});

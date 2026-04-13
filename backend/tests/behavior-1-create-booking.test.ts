/** BEHAVIOR 1 — Create booking writes GCal event */

jest.mock('googleapis', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import { sesSendMock } from './mocks/ses.mock';
import { startTestDB, stopTestDB, resetTestDB, seedCoach, seedEventType } from './helpers';
import { createBooking } from '../src/services/booking.service';
import { Booking } from '../src/models/Booking.model';

describe('BEHAVIOR 1 — Create booking writes GCal event', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
    sesSendMock.mockReset();
  });

  it('creates a GCal event with correct calendarId, start, end, attendees', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({ coachId, orgId, targetCalendarId: calendarId });

    const start = new Date(Date.now() + 48 * 3600_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    await createBooking(slug, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      clientName: 'Alice',
      clientEmail: 'alice@example.com',
    });

    expect(calendarMock.events.insert).toHaveBeenCalledTimes(1);
    const [call] = calendarMock.events.insert.mock.calls;
    expect(call[0].calendarId).toBe(calendarId);
    expect(call[0].requestBody.start.dateTime).toBe(start.toISOString());
    expect(call[0].requestBody.end.dateTime).toBe(end.toISOString());
    expect(call[0].requestBody.attendees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'alice@example.com' }),
      ]),
    );
  });

  it('saves googleEventId to the Booking document', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({ coachId, orgId, targetCalendarId: calendarId });

    const start = new Date(Date.now() + 48 * 3600_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    await createBooking(slug, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      clientName: 'Bob',
      clientEmail: 'bob@example.com',
    });

    const saved = await Booking.findOne({ clientEmail: 'bob@example.com' })
      .setOptions({ bypassTenantCheck: true });
    expect(saved?.googleEventId).toBe('gcal-event-id');
    expect(saved?.status).toBe('confirmed');
  });

  it('sends confirmation email', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({ coachId, orgId, targetCalendarId: calendarId });

    const start = new Date(Date.now() + 48 * 3600_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    await createBooking(slug, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      clientName: 'Cara',
      clientEmail: 'cara@example.com',
    });

    // Confirmation email is fire-and-forget; give the microtask queue a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(sesSendMock).toHaveBeenCalled();
  });
});

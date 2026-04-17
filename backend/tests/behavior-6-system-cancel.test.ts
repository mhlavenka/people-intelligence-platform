/** BEHAVIOR 6 — Cancel in system → GCal event removed (graceful on 404 / missing id) */

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
import { cancelBooking } from '../src/services/booking.service';
import { Booking } from '../src/models/Booking.model';

describe('BEHAVIOR 6 — Cancel in system removes GCal event', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
    sesSendMock.mockReset();
  });

  it('calls calendar.events.delete with the correct eventId', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    const booking = await seedBooking({
      coachId, orgId, googleEventId: 'evt-to-delete',
    });

    await cancelBooking(booking._id.toString(), 'coach', 'Changed plans');

    expect(calendarMock.events.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId,
        eventId: 'evt-to-delete',
      }),
    );
  });

  it('proceeds when calendar.events.delete returns 404', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    const booking = await seedBooking({
      coachId, orgId, googleEventId: 'evt-already-gone',
    });

    calendarMock.events.delete.mockRejectedValueOnce(
      Object.assign(new Error('Not Found'), { code: 404 }),
    );

    const result = await cancelBooking(booking._id.toString(), 'coach');

    // Mongo side completed despite GCal failure
    expect(result.status).toBe('cancelled');
    const refreshed = await Booking.findById(booking._id)
      .setOptions({ bypassTenantCheck: true });
    expect(refreshed?.status).toBe('cancelled');
  });

  it('proceeds when googleEventId is null', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    const booking = await seedBooking({ coachId, orgId /* no googleEventId */ });

    const result = await cancelBooking(booking._id.toString(), 'coach');
    expect(result.status).toBe('cancelled');
    expect(calendarMock.events.delete).not.toHaveBeenCalled();
  });

  it('sends cancellation email on cancel', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    await seedEventType({ coachId, orgId, targetCalendarId: calendarId });
    const booking = await seedBooking({ coachId, orgId, googleEventId: 'evt-email' });

    await cancelBooking(booking._id.toString(), 'coach');
    await new Promise((r) => setTimeout(r, 10));
    expect(sesSendMock).toHaveBeenCalled();
  });
});

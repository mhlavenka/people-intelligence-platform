/**
 * BEHAVIOR 5 — FREE events do not block slots.
 *
 * Google's calendar.freebusy.query returns only BUSY periods by default.
 * We verify our code doesn't pass any option that would change that.
 */

jest.mock('@googleapis/calendar', () => require('./mocks/googleapis.mock'));
jest.mock('google-auth-library', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import { startTestDB, stopTestDB, resetTestDB, seedCoach, seedEventType } from './helpers';
import { getAvailableSlots } from '../src/services/availability.service';

describe('BEHAVIOR 5 — FREE events do not block slots', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
  });

  it('freebusy call does not pass any flag that would include FREE periods', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId, minNoticeHours: 0,
    });

    const from = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

    await getAvailableSlots(slug, from, to, 'America/Toronto');

    expect(calendarMock.freebusy.query).toHaveBeenCalled();
    const [call] = calendarMock.freebusy.query.mock.calls;
    const body = call[0].requestBody;

    // Only the documented contract keys.
    expect(Object.keys(body).sort()).toEqual(['items', 'timeMax', 'timeMin'].sort());
    // No option (e.g. calendarExpansionMax / groupExpansionMax / timeZone)
    // that could alter freebusy semantics.
    expect(body).not.toHaveProperty('timeZone');
  });

  it('empty freebusy response produces slots (FREE events are invisible)', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId, minNoticeHours: 0,
    });

    // freebusy returns zero busy periods (the coach's FREE all-day event
    // doesn't appear). Expect slots to be produced.
    calendarMock.freebusy.query.mockResolvedValueOnce({
      data: { calendars: { [calendarId]: { busy: [] } } },
    });

    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const slots = await getAvailableSlots(slug, tomorrow, tomorrow, 'America/Toronto');
    expect(slots.length).toBeGreaterThan(0);
  });
});

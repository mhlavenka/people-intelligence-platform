/** BEHAVIOR 7 — Past events have no effect on availability / reminders */

jest.mock('googleapis', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import {
  startTestDB, stopTestDB, resetTestDB,
  seedCoach, seedEventType,
} from './helpers';
import { getAvailableSlots } from '../src/services/availability.service';

describe('BEHAVIOR 7 — Past events have no effect', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
  });

  it('freebusy timeMin is never earlier than now + minNoticeHours', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId,
      minNoticeHours: 24,
    });

    // Deliberately pass a past fromDate (as a stale cached replay might).
    const past = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const future = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

    await getAvailableSlots(slug, past, future, 'America/Toronto');

    expect(calendarMock.freebusy.query).toHaveBeenCalled();
    const [call] = calendarMock.freebusy.query.mock.calls;
    const timeMinIso = call[0].requestBody.timeMin;
    const timeMinMs = new Date(timeMinIso).getTime();

    // Must be at least now + 24h - 1 min jitter
    expect(timeMinMs).toBeGreaterThanOrEqual(Date.now() + 23 * 3600_000);
  });

  it('does not generate slots in the past', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId,
      minNoticeHours: 12,
    });

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

    const slots = await getAvailableSlots(slug, today, tomorrow, 'America/Toronto');
    const cutoff = Date.now() + 12 * 3600_000;
    for (const s of slots) {
      expect(new Date(s.startUtc).getTime()).toBeGreaterThanOrEqual(cutoff - 60_000);
    }
  });
});

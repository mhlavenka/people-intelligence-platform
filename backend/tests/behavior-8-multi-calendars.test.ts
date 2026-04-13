/** BEHAVIOR 8 — Target calendar always included, multiple conflict calendars supported */

jest.mock('googleapis', () => require('./mocks/googleapis.mock'));
jest.mock('@aws-sdk/client-ses', () => require('./mocks/ses.mock'));
jest.mock('node-cron', () => require('./mocks/node-cron.mock'));

import { calendarMock, resetGoogleMocks } from './mocks/googleapis.mock';
import {
  startTestDB, stopTestDB, resetTestDB,
  seedCoach, seedEventType, seedBookingSettings,
} from './helpers';
import { getAvailableSlots } from '../src/services/availability.service';

describe('BEHAVIOR 8 — Multiple conflict calendars checked', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await resetTestDB();
    resetGoogleMocks();
  });

  it('targetCalendarId is always included even when conflictCalendarIds is empty', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId,
      conflictCalendarIds: [], minNoticeHours: 0,
    });

    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    await getAvailableSlots(slug, tomorrow, tomorrow, 'America/Toronto');

    expect(calendarMock.freebusy.query).toHaveBeenCalled();
    const [call] = calendarMock.freebusy.query.mock.calls;
    const items = call[0].requestBody.items as Array<{ id: string }>;
    expect(items.map((i) => i.id)).toContain(calendarId);
  });

  it('all conflict calendars appear in freebusy items', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId,
      minNoticeHours: 0,
    });
    await seedBookingSettings({
      coachId, orgId,
      targetCalendarId: calendarId,
      conflictCalendarIds: [calendarId, 'team@company.com', 'holidays@group.calendar.google.com'],
    });

    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    await getAvailableSlots(slug, tomorrow, tomorrow, 'America/Toronto');

    const [call] = calendarMock.freebusy.query.mock.calls;
    const ids = (call[0].requestBody.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([
      calendarId, 'team@company.com', 'holidays@group.calendar.google.com',
    ]));
  });

  it('deduplicates calendar IDs if target appears inside conflictCalendarIds', async () => {
    const { coachId, orgId, calendarId } = await seedCoach();
    const slug = await seedEventType({
      coachId, orgId, targetCalendarId: calendarId,
      minNoticeHours: 0,
    });
    await seedBookingSettings({
      coachId, orgId,
      targetCalendarId: calendarId,
      conflictCalendarIds: [calendarId, calendarId, 'other@x.com'],
    });

    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    await getAvailableSlots(slug, tomorrow, tomorrow, 'America/Toronto');

    const [call] = calendarMock.freebusy.query.mock.calls;
    const ids = (call[0].requestBody.items as Array<{ id: string }>).map((i) => i.id);
    const occurrences = ids.filter((i) => i === calendarId).length;
    expect(occurrences).toBe(1);
    expect(ids).toContain('other@x.com');
  });
});

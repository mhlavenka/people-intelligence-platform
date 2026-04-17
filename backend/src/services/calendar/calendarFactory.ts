import { User } from '../../models/User.model';
import { CalendarProvider, ICalendarProvider } from './calendar.interface';
import { googleCalendarProvider } from './google.provider';
import { microsoftCalendarProvider } from './microsoft.provider';

const providers: Record<CalendarProvider, ICalendarProvider> = {
  google: googleCalendarProvider,
  microsoft: microsoftCalendarProvider,
};

export function getCalendarProvider(provider: CalendarProvider): ICalendarProvider {
  return providers[provider];
}

export async function getCoachCalendarProvider(coachId: string): Promise<{
  provider: ICalendarProvider;
  calendarId: string | undefined;
} | null> {
  const coach = await User.findById(coachId).select(
    'googleCalendar.connected googleCalendar.calendarId microsoftCalendar.connected microsoftCalendar.calendarId',
  );
  if (!coach) return null;

  if (coach.googleCalendar?.connected) {
    return {
      provider: getCalendarProvider('google'),
      calendarId: coach.googleCalendar.calendarId,
    };
  }

  if (coach.microsoftCalendar?.connected) {
    return {
      provider: getCalendarProvider('microsoft'),
      calendarId: coach.microsoftCalendar.calendarId,
    };
  }

  return null;
}

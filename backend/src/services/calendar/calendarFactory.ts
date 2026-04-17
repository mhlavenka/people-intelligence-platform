import { User } from '../../models/User.model';
import { CalendarProvider, ICalendarProvider } from './calendar.interface';
import { googleCalendarProvider } from './google.provider';

const providers: Record<CalendarProvider, ICalendarProvider> = {
  google: googleCalendarProvider,
  microsoft: null as unknown as ICalendarProvider, // Phase 2: microsoftCalendarProvider
};

export function getCalendarProvider(provider: CalendarProvider): ICalendarProvider {
  const p = providers[provider];
  if (!p) throw new Error(`Calendar provider "${provider}" is not yet implemented`);
  return p;
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

  // Phase 2: check microsoftCalendar.connected

  return null;
}

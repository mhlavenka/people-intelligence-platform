import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api.service';

export type CalendarProviderType = 'google' | 'microsoft';

export interface CalendarStatus {
  connected: boolean;
  provider: CalendarProviderType | null;
  calendarId: string | null;
  calendarName: string | null;
}

export interface CalendarItem {
  id: string;
  summary: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarIntegrationService {
  constructor(private api: ApiService) {}

  getAuthUrl(provider: CalendarProviderType = 'google'): Observable<{ url: string }> {
    return this.api.get<{ url: string }>(`/calendar/auth/${provider}`);
  }

  getStatus(): Observable<CalendarStatus> {
    return this.api.get<CalendarStatus>('/calendar/status');
  }

  listCalendars(): Observable<CalendarItem[]> {
    return this.api.get<CalendarItem[]>('/calendar/calendars');
  }

  selectCalendar(calendarId: string, calendarName: string): Observable<unknown> {
    return this.api.post('/calendar/select', { calendarId, calendarName });
  }

  disconnect(): Observable<unknown> {
    return this.api.delete('/calendar/disconnect');
  }
}

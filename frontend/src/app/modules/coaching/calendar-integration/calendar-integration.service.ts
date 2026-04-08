import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api.service';

export interface CalendarStatus {
  connected: boolean;
  calendarId: string | null;
  calendarName: string | null;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarIntegrationService {
  constructor(private api: ApiService) {}

  getAuthUrl(): Observable<{ url: string }> {
    return this.api.get<{ url: string }>('/calendar/auth/google');
  }

  getStatus(): Observable<CalendarStatus> {
    return this.api.get<CalendarStatus>('/calendar/status');
  }

  listCalendars(): Observable<GoogleCalendar[]> {
    return this.api.get<GoogleCalendar[]>('/calendar/calendars');
  }

  selectCalendar(calendarId: string, calendarName: string): Observable<unknown> {
    return this.api.post('/calendar/select', { calendarId, calendarName });
  }

  disconnect(): Observable<unknown> {
    return this.api.delete('/calendar/disconnect');
  }
}

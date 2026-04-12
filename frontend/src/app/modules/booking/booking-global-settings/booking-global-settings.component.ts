import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CalendarIntegrationService,
  CalendarStatus,
  GoogleCalendar,
} from '../../coaching/calendar-integration/calendar-integration.service';
import {
  BookingService,
  BookingSettingsData,
  WeeklySlot,
} from '../booking.service';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const COMMON_TIMEZONES = [
  'America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Vancouver', 'America/Edmonton',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Prague',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
];

@Component({
  selector: 'app-booking-global-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="settings-container">
      <div class="page-header">
        <a mat-icon-button routerLink="/booking" matTooltip="Back to bookings">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <h1>Booking Settings</h1>
          <p>These settings apply to all your event types.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else {

      <!-- Google Calendar Connection -->
      <section class="card">
        <div class="card-header">
          <mat-icon>cloud_sync</mat-icon>
          <div>
            <h2>Google Calendar Connection</h2>
            <p>Connect your Google account to sync bookings and check availability</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          @if (calendarStatus()?.connected) {
            <div class="status-row connected">
              <mat-icon class="status-icon green">check_circle</mat-icon>
              <span>Connected</span>
              <button mat-stroked-button color="warn" (click)="disconnectCalendar()">
                <mat-icon>link_off</mat-icon> Disconnect
              </button>
            </div>
          } @else {
            <div class="status-row">
              <mat-icon class="status-icon gray">cloud_off</mat-icon>
              <span>Not connected</span>
              <button mat-flat-button color="primary" (click)="connectCalendar()">
                <mat-icon>link</mat-icon> Connect Google Calendar
              </button>
            </div>
          }
        </div>
      </section>

      <!-- Calendar Selection -->
      @if (calendarStatus()?.connected) {
      <section class="card">
        <div class="card-header">
          <mat-icon>event_note</mat-icon>
          <div>
            <h2>Calendar Selection</h2>
            <p>Choose which calendars to use for all booking types</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Create appointments in</mat-label>
            <mat-select [(ngModel)]="targetCalendarId">
              @for (cal of calendars(); track cal.id) {
                <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Check these calendars for conflicts</mat-label>
            <mat-select [(ngModel)]="conflictCalendarIds" multiple>
              @for (cal of calendars(); track cal.id) {
                <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </section>
      }

      <!-- Availability Schedule -->
      <section class="card">
        <div class="card-header">
          <mat-icon>schedule</mat-icon>
          <div>
            <h2>Availability Schedule</h2>
            <p>Set your weekly working hours — shared across all event types</p>
          </div>
          <button mat-stroked-button class="copy-btn" (click)="copyToAll()"
                  matTooltip="Copy first enabled day's hours to all days">
            <mat-icon>content_copy</mat-icon> Copy to all
          </button>
        </div>
        <mat-divider />
        <div class="card-body">
          <mat-form-field appearance="outline" class="tz-field">
            <mat-label>Timezone</mat-label>
            <mat-select [(ngModel)]="timezone">
              @for (tz of timezones; track tz) {
                <mat-option [value]="tz">{{ tz }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="schedule-grid">
            @for (slot of weeklySchedule; track slot.dayOfWeek) {
              <div class="schedule-row" [class.disabled]="!slot.enabled">
                <mat-slide-toggle [(ngModel)]="slot.enabled" class="day-toggle">
                  {{ dayName(slot.dayOfWeek) }}
                </mat-slide-toggle>
                @if (slot.enabled) {
                  <div class="time-inputs">
                    <mat-form-field appearance="outline" class="time-field">
                      <mat-label>From</mat-label>
                      <input matInput type="time" [(ngModel)]="slot.startTime" />
                    </mat-form-field>
                    <span class="time-sep">&ndash;</span>
                    <mat-form-field appearance="outline" class="time-field">
                      <mat-label>To</mat-label>
                      <input matInput type="time" [(ngModel)]="slot.endTime" />
                    </mat-form-field>
                  </div>
                } @else {
                  <span class="unavailable-label">Unavailable</span>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Actions -->
      <div class="actions">
        <a mat-stroked-button routerLink="/booking">Cancel</a>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="20" /> }
          Save Settings
        </button>
      </div>

      }
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 800px; margin: 0 auto; padding: 24px;
    }
    .page-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 24px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1B2A47; }
      p { margin: 0; color: #6b7c93; }
    }
    .loading {
      display: flex; justify-content: center; padding: 60px 0;
    }
    .card {
      background: #fff; border-radius: 12px; margin-bottom: 20px;
      border: 1px solid #e8eef4; overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 12px; padding: 20px 24px;
      > mat-icon { color: #3A9FD6; font-size: 28px; width: 28px; height: 28px; }
      h2 { margin: 0; font-size: 17px; color: #1B2A47; }
      p { margin: 2px 0 0; font-size: 13px; color: #6b7c93; }
      .copy-btn { margin-left: auto; }
    }
    .card-body { padding: 20px 24px; }
    .full-width { width: 100%; }
    .tz-field { width: 300px; margin-bottom: 16px; }

    .status-row {
      display: flex; align-items: center; gap: 12px;
      .status-icon { font-size: 24px; width: 24px; height: 24px; }
      .green { color: #27C4A0; }
      .gray { color: #9aa5b4; }
      button { margin-left: auto; }
    }

    .schedule-grid {
      display: flex; flex-direction: column; gap: 8px;
    }
    .schedule-row {
      display: flex; align-items: center; gap: 16px; padding: 8px 0;
      &.disabled { opacity: 0.6; }
    }
    .day-toggle { min-width: 140px; }
    .time-inputs { display: flex; align-items: center; gap: 8px; }
    .time-field { width: 140px; }
    .time-sep { color: #6b7c93; font-size: 18px; }
    .unavailable-label { color: #9aa5b4; font-style: italic; font-size: 14px; }

    .actions {
      display: flex; justify-content: flex-end; gap: 12px; padding: 8px 0 24px;
      button mat-spinner { display: inline-block; margin-right: 8px; }
    }

    @media (max-width: 600px) {
      .settings-container { padding: 16px; }
      .schedule-row { flex-wrap: wrap; }
      .time-field { width: 120px; }
    }
  `],
})
export class BookingGlobalSettingsComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  calendarStatus = signal<CalendarStatus | null>(null);
  calendars = signal<GoogleCalendar[]>([]);

  weeklySchedule: WeeklySlot[] = [];
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  targetCalendarId = '';
  conflictCalendarIds: string[] = [];

  readonly timezones = COMMON_TIMEZONES;

  constructor(
    private bookingSvc: BookingService,
    private calendarSvc: CalendarIntegrationService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.initWeeklySchedule();
    this.loadAll();
  }

  private initWeeklySchedule(): void {
    this.weeklySchedule = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      enabled: i >= 1 && i <= 5,
    }));
  }

  private loadAll(): void {
    this.loading.set(true);

    this.calendarSvc.getStatus().subscribe({
      next: (s: CalendarStatus) => {
        this.calendarStatus.set(s);
        if (s.connected) this.loadCalendars();
      },
      error: () => this.calendarStatus.set(null),
    });

    this.bookingSvc.getSettings().subscribe({
      next: (settings: BookingSettingsData | null) => {
        if (settings) {
          if (settings.weeklySchedule?.length) this.weeklySchedule = settings.weeklySchedule;
          this.timezone = settings.timezone || this.timezone;
          this.targetCalendarId = settings.targetCalendarId || '';
          this.conflictCalendarIds = settings.conflictCalendarIds || [];
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCalendars(): void {
    this.calendarSvc.listCalendars().subscribe({
      next: (cals: GoogleCalendar[]) => this.calendars.set(cals),
      error: () => this.calendars.set([]),
    });
  }

  connectCalendar(): void {
    this.calendarSvc.getAuthUrl().subscribe({
      next: ({ url }) => window.location.href = url,
      error: () => this.snackBar.open('Failed to start Google auth', 'OK', { duration: 3000 }),
    });
  }

  disconnectCalendar(): void {
    this.calendarSvc.disconnect().subscribe({
      next: () => {
        this.calendarStatus.set({ connected: false, calendarId: null, calendarName: null });
        this.calendars.set([]);
        this.snackBar.open('Google Calendar disconnected', 'OK', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to disconnect', 'OK', { duration: 3000 }),
    });
  }

  dayName(dow: number): string {
    return DAY_NAMES[dow];
  }

  copyToAll(): void {
    const source = this.weeklySchedule.find((s) => s.enabled);
    if (!source) return;
    for (const slot of this.weeklySchedule) {
      slot.startTime = source.startTime;
      slot.endTime = source.endTime;
    }
    this.snackBar.open('Hours copied to all days', 'OK', { duration: 2000 });
  }

  save(): void {
    this.saving.set(true);
    const payload: Partial<BookingSettingsData> = {
      timezone: this.timezone,
      weeklySchedule: this.weeklySchedule,
      targetCalendarId: this.targetCalendarId,
      conflictCalendarIds: this.conflictCalendarIds,
    };

    this.bookingSvc.saveSettings(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Settings saved', 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Failed to save settings', 'OK', { duration: 3000 });
      },
    });
  }
}

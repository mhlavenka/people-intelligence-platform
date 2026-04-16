import { Component, OnInit, OnDestroy, ViewChild, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ApiService } from '../../../core/api.service';
import {
  CalendarIntegrationService,
  CalendarStatus,
  GoogleCalendar,
} from '../../coaching/calendar-integration/calendar-integration.service';
import {
  BookingService,
  BookingSettingsData,
  DateOverride,
  HolidayCountry,
  HolidayItem,
  WeeklySlot,
} from '../booking.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule,
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
            <mat-select [(ngModel)]="targetCalendarId" (ngModelChange)="scheduleSave()">
              @for (cal of calendars(); track cal.id) {
                <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Check these calendars for conflicts</mat-label>
            <mat-select [(ngModel)]="conflictCalendarIds" (ngModelChange)="scheduleSave()" multiple>
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
            <mat-select [(ngModel)]="timezone" (ngModelChange)="scheduleSave()">
              @for (tz of timezones; track tz) {
                <mat-option [value]="tz">{{ tz }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="schedule-grid">
            @for (slot of weeklySchedule; track slot.dayOfWeek) {
              <div class="schedule-row" [class.disabled]="!slot.enabled">
                <mat-slide-toggle [(ngModel)]="slot.enabled"
                                  (ngModelChange)="onScheduleChange()"
                                  class="day-toggle">
                  {{ dayName(slot.dayOfWeek) }}
                </mat-slide-toggle>
                @if (slot.enabled) {
                  <div class="time-inputs" [class.invalid]="!isTimeRangeValid(slot)">
                    <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                      <mat-label>From</mat-label>
                      <input matInput type="time" [(ngModel)]="slot.startTime"
                             (ngModelChange)="onTimeChange(slot)" />
                    </mat-form-field>
                    <span class="time-sep">&ndash;</span>
                    <mat-form-field appearance="outline" class="time-field" subscriptSizing="dynamic">
                      <mat-label>To</mat-label>
                      <input matInput type="time" [(ngModel)]="slot.endTime"
                             (ngModelChange)="onTimeChange(slot)" />
                    </mat-form-field>
                    @if (!isTimeRangeValid(slot)) {
                      <span class="time-error" role="alert">
                        <mat-icon>error_outline</mat-icon> End must be after start
                      </span>
                    }
                  </div>
                } @else {
                  <span class="unavailable-label">Unavailable</span>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Cancellation & Reschedule Policy -->
      <section class="card">
        <div class="card-header">
          <mat-icon>policy</mat-icon>
          <div>
            <h2>Cancellation &amp; Reschedule Policy</h2>
            <p>Set the minimum notice period for coachees to reschedule. Late cancellations count as used sessions.</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <mat-form-field appearance="outline" class="deadline-field">
            <mat-label>Reschedule deadline</mat-label>
            <mat-select [(ngModel)]="rescheduleDeadlineHours" (ngModelChange)="scheduleSave()">
              <mat-option [value]="12">12 hours before</mat-option>
              <mat-option [value]="24">24 hours before</mat-option>
              <mat-option [value]="48">48 hours before</mat-option>
              <mat-option [value]="72">72 hours before</mat-option>
            </mat-select>
            <mat-hint>
              Coachees can reschedule freely before this deadline. After the deadline,
              they can still cancel but the session counts toward their allotment.
            </mat-hint>
          </mat-form-field>
        </div>
      </section>

      <!-- Date Exclusions -->
      <section class="card">
        <div class="card-header">
          <mat-icon>event_busy</mat-icon>
          <div>
            <h2>Date Exclusions</h2>
            <p>Block off specific dates (holidays, PTO, single days off) — applies to all event types.</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <div class="exclusions-layout">
            <!-- Inline calendar: click a date to toggle exclusion -->
            <div class="exclusions-calendar">
              <mat-calendar #exclusionCal
                [selected]="null"
                [dateClass]="dateClassFn"
                (selectedChange)="toggleDate($event)"
              />
              <p class="cal-hint">
                Click any date to mark it unavailable. Click again to re-enable.
              </p>
            </div>

            <!-- Right column: list + holiday import -->
            <div class="exclusions-side">
              <div class="holiday-row">
                <mat-form-field appearance="outline" class="country-field">
                  <mat-label>Country</mat-label>
                  <mat-select [(ngModel)]="selectedHolidayCountry">
                    @for (c of countries(); track c.code) {
                      <mat-option [value]="c.code">
                        {{ c.name }} <span class="cc-code">({{ c.code }})</span>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="year-field">
                  <mat-label>Year</mat-label>
                  <mat-select [(ngModel)]="holidayYear">
                    @for (y of holidayYears; track y) {
                      <mat-option [value]="y">{{ y }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-stroked-button color="primary"
                        (click)="loadHolidays()"
                        [disabled]="loadingHolidays() || !selectedHolidayCountry">
                  @if (loadingHolidays()) {
                    <mat-spinner diameter="16" />
                  } @else {
                    <mat-icon>flag</mat-icon>
                  }
                  Add holidays
                </button>
              </div>
              @if (orgCountry() && selectedHolidayCountry === orgCountry()) {
                <p class="country-hint">
                  Defaulted to <strong>{{ orgCountry() }}</strong> from your organization billing address — change above to add another country.
                </p>
              } @else if (!orgCountry()) {
                <p class="country-hint warn">
                  No billing country on your organization — pick one above, or set a default under Admin → Organization Settings.
                </p>
              } @else {
                <p class="country-hint">
                  Adding holidays for a country other than your billing default (<strong>{{ orgCountry() }}</strong>).
                </p>
              }

              <div class="excl-list">
                @if (sortedExclusions().length === 0) {
                  <div class="excl-empty">
                    <mat-icon>event_available</mat-icon>
                    <span>No date exclusions yet. Click dates on the calendar to add them.</span>
                  </div>
                } @else {
                  @for (ex of sortedExclusions(); track ex.date) {
                    <div class="excl-item">
                      <mat-icon class="excl-icon">block</mat-icon>
                      <div class="excl-date">
                        <div class="excl-date-main">{{ formatDate(ex.date) }}</div>
                        @if (exclusionLabel(ex.date); as label) {
                          <div class="excl-date-sub">{{ label }}</div>
                        }
                      </div>
                      <button mat-icon-button (click)="removeDate(ex.date)"
                              matTooltip="Remove exclusion" aria-label="Remove">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                  <button mat-button color="warn" class="clear-btn" (click)="clearAll()">
                    <mat-icon>delete_sweep</mat-icon> Clear all
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Auto-save status -->
      <div class="autosave-bar" [attr.data-state]="saveState()">
        @switch (saveState()) {
          @case ('saving') {
            <mat-spinner diameter="14" /> <span>Saving…</span>
          }
          @case ('saved') {
            <mat-icon>check_circle</mat-icon> <span>All changes saved</span>
          }
          @case ('error') {
            <mat-icon>error_outline</mat-icon>
            <span>Couldn't save — your last change may not have been stored.</span>
          }
          @default {
            <span class="muted">Changes are saved automatically.</span>
          }
        }
      </div>

      }
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 960px; margin: 0 auto; padding: 24px;
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
      width: fit-content; margin: 0 auto;
    }
    .schedule-row {
      display: flex; align-items: center; gap: 16px; padding: 8px 0;
      &.disabled { opacity: 0.6; }
    }
    .day-toggle { min-width: 140px; }
    .time-inputs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .time-field { width: 140px; }
    .time-sep { color: #6b7c93; font-size: 18px; }
    .time-error {
      display: inline-flex; align-items: center; gap: 4px;
      color: #b91c1c; font-size: 12px; font-weight: 500;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #ef4444; }
    }
    .time-inputs.invalid ::ng-deep .mdc-notched-outline > * {
      border-color: rgba(239, 68, 68, 0.6) !important;
    }
    .unavailable-label { color: #9aa5b4; font-style: italic; font-size: 14px; }

    .deadline-field { width: 280px; }

    .exclusions-layout {
      display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 24px;
    }
    .exclusions-calendar mat-calendar {
      border: 1px solid #e8eef4; border-radius: 12px; background: #fff;
    }
    .cal-hint {
      font-size: 12px; color: #6b7c93; margin: 8px 4px 0;
    }
    /* Bold the days that are inside the weekly schedule. */
    ::ng-deep .booking-available-day .mat-calendar-body-cell-content {
      font-weight: 700;
      color: #1B2A47 !important;
    }
    /* Excluded days: red tint + a centred ✕ overlay drawn on the cell. */
    ::ng-deep .booking-excluded-day {
      position: relative;
    }
    ::ng-deep .booking-excluded-day .mat-calendar-body-cell-content {
      background: rgba(239, 68, 68, 0.12) !important;
      color: #b91c1c !important;
      border-color: rgba(239, 68, 68, 0.35) !important;
      font-weight: 600;
      text-decoration: line-through;
    }
    ::ng-deep .booking-excluded-day::after {
      content: '✕';
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      color: #b91c1c; font-weight: 700; font-size: 18px;
      pointer-events: none;
    }
    .exclusions-side { display: flex; flex-direction: column; gap: 12px; }
    .holiday-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .country-field { flex: 1 1 200px; min-width: 200px; }
    .year-field { width: 110px; }
    .cc-code { color: #9aa5b4; font-size: 12px; margin-left: 4px; }
    .country-hint {
      font-size: 12px; color: #6b7c93; margin: -4px 0 4px;
      &.warn { color: #b07800; }
    }
    .excl-list {
      background: #fafbfd; border: 1px solid #eef2f7; border-radius: 10px;
      padding: 8px; min-height: 120px; max-height: 360px; overflow-y: auto;
    }
    .excl-empty {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      color: #9aa5b4; font-size: 13px; padding: 28px 12px; text-align: center;
      mat-icon { color: #c8d3df; }
    }
    .excl-item {
      display: flex; align-items: center; gap: 10px; padding: 0;
      border-radius: 8px;
      &:hover { background: rgba(239, 68, 68, 0.04); }
    }
    .excl-icon { color: #ef4444; font-size: 18px; width: 18px; height: 18px; }
    .excl-date { flex: 1; min-width: 0; }
    .excl-date-main { font-size: 13px; color: #1B2A47; font-weight: 500; }
    .excl-date-sub { font-size: 11px; color: #6b7c93; }
    .clear-btn { margin-top: 4px; }

    .autosave-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 4px 24px; font-size: 13px; min-height: 24px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .muted { color: #9aa5b4; }
      &[data-state='saving'] { color: #6b7c93; }
      &[data-state='saved']  { color: #1a9678; mat-icon { color: #27C4A0; } }
      &[data-state='error']  { color: #b91c1c; mat-icon { color: #ef4444; } }
    }

    @media (max-width: 720px) {
      .exclusions-layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      .settings-container { padding: 16px; }
      .schedule-row { flex-wrap: wrap; }
      .time-field { width: 120px; }
    }
  `],
})
export class BookingGlobalSettingsComponent implements OnInit, OnDestroy {
  @ViewChild('exclusionCal') exclusionCal?: MatCalendar<Date>;

  loading = signal(true);
  saveState = signal<SaveState>('idle');
  calendarStatus = signal<CalendarStatus | null>(null);
  calendars = signal<GoogleCalendar[]>([]);

  // Debounced auto-save plumbing.
  private saveDebounceMs = 800;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
  /** Suppress autosave during the initial load — otherwise hydrating
   *  ngModels from the API immediately fires ngModelChange and writes back
   *  the same data we just read. */
  private autosaveArmed = false;

  weeklySchedule: WeeklySlot[] = [];
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  targetCalendarId = '';
  conflictCalendarIds: string[] = [];
  rescheduleDeadlineHours = 24;

  // Date exclusions (whole-day "isUnavailable" overrides).
  dateOverrides = signal<DateOverride[]>([]);
  /** Map ISO YYYY-MM-DD → label (e.g. holiday name). */
  exclusionLabels = signal<Map<string, string>>(new Map());
  loadingHolidays = signal(false);
  orgCountry = signal<string>('');
  countries = signal<HolidayCountry[]>([]);
  selectedHolidayCountry = '';
  holidayYear = new Date().getFullYear();
  holidayYears = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
    new Date().getFullYear() + 2,
  ];

  /** Set of `YYYY-MM-DD` strings — used by both the date-class fn and the list. */
  excludedDateSet = computed<Set<string>>(() => {
    const s = new Set<string>();
    for (const ov of this.dateOverrides()) {
      if (ov.isUnavailable) s.add(this.toIso(ov.date));
    }
    return s;
  });

  sortedExclusions = computed<DateOverride[]>(() =>
    [...this.dateOverrides()]
      .filter((o) => o.isUnavailable)
      .sort((a, b) => this.toIso(a.date).localeCompare(this.toIso(b.date))),
  );

  /** Bound to <mat-calendar [dateClass]> — marks excluded cells with a red X
   *  and weekly-available days as bold so coaches can read at a glance which
   *  days the schedule covers. Excluded wins when both apply. */
  dateClassFn = (d: Date): string => {
    const iso = this.toIso(d);
    if (this.excludedDateSet().has(iso)) return 'booking-excluded-day';
    const dow = d.getDay();
    const slot = this.weeklySchedule.find((s) => s.dayOfWeek === dow);
    return slot?.enabled ? 'booking-available-day' : '';
  };

  readonly timezones = COMMON_TIMEZONES;

  constructor(
    private bookingSvc: BookingService,
    private calendarSvc: CalendarIntegrationService,
    private api: ApiService,
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
          this.rescheduleDeadlineHours = settings.rescheduleDeadlineHours ?? 24;
          this.dateOverrides.set(settings.dateOverrides ?? []);
        }
        this.loading.set(false);
        // Arm autosave only after the form is hydrated, so the ngModelChange
        // events fired by hydration don't trigger a redundant write-back.
        setTimeout(() => { this.autosaveArmed = true; }, 0);
      },
      error: () => {
        this.loading.set(false);
        setTimeout(() => { this.autosaveArmed = true; }, 0);
      },
    });

    // Pull the org country and the supported-countries list in parallel; once
    // both arrive we default the picker to the org country (if it's a country
    // the holiday library actually knows about).
    this.api.get<{ billingAddress?: { country?: string } }>('/organizations/me').subscribe({
      next: (org) => {
        this.orgCountry.set((org.billingAddress?.country ?? '').toUpperCase());
        this.applyDefaultCountry();
      },
      error: () => this.orgCountry.set(''),
    });
    this.bookingSvc.getHolidayCountries().subscribe({
      next: (list) => {
        this.countries.set(list);
        this.applyDefaultCountry();
      },
      error: () => this.countries.set([]),
    });
  }

  private applyDefaultCountry(): void {
    if (this.selectedHolidayCountry) return;
    const country = this.orgCountry();
    if (!country) return;
    const list = this.countries();
    if (!list.length) return;
    if (list.find((c) => c.code === country)) {
      this.selectedHolidayCountry = country;
    }
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
    this.scheduleSave();
  }

  /** A schedule day was toggled — refresh the bold "available day" hints
   *  on the exclusions calendar so the change is visible immediately. */
  onScheduleChange(): void {
    this.refreshCalendar();
    this.scheduleSave();
  }

  /** Per-row validation: <input type="time"> uses HH:mm strings which sort
   *  lexicographically, so a string compare is sufficient. */
  isTimeRangeValid(slot: WeeklySlot): boolean {
    if (!slot.enabled) return true;
    if (!slot.startTime || !slot.endTime) return true;  // half-typed input — don't yell yet
    return slot.endTime > slot.startTime;
  }

  hasAnyInvalidRange(): boolean {
    return this.weeklySchedule.some((s) => !this.isTimeRangeValid(s));
  }

  /** Called from a time field's (ngModelChange). Save only if every row is
   *  valid; otherwise the inline error stays visible until the user fixes it. */
  onTimeChange(_slot: WeeklySlot): void {
    if (this.hasAnyInvalidRange()) return;
    this.scheduleSave();
  }

  // ── Date exclusions ──────────────────────────────────────────────────────
  /** Convert any Date or YYYY-MM-DD string to a normalized ISO date string. */
  private toIso(d: Date | string): string {
    if (typeof d === 'string') return d.length >= 10 ? d.slice(0, 10) : d;
    // Use local-date parts so a calendar click doesn't shift to the previous
    // day in negative-offset timezones.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Click on a calendar cell: toggle exclusion for that date. */
  toggleDate(d: Date | null): void {
    if (!d) return;
    const iso = this.toIso(d);
    const list = this.dateOverrides();
    const idx = list.findIndex((o) => this.toIso(o.date) === iso);
    if (idx >= 0) {
      // Already in the list — drop it. Also drop the label.
      this.dateOverrides.set(list.filter((_, i) => i !== idx));
      const labels = new Map(this.exclusionLabels());
      labels.delete(iso);
      this.exclusionLabels.set(labels);
    } else {
      this.dateOverrides.set([
        ...list,
        { date: iso, startTime: '00:00', endTime: '23:59', isUnavailable: true },
      ]);
    }
    this.refreshCalendar();
    this.scheduleSave();
  }

  removeDate(date: Date | string): void {
    const iso = this.toIso(date);
    this.dateOverrides.set(
      this.dateOverrides().filter((o) => this.toIso(o.date) !== iso),
    );
    const labels = new Map(this.exclusionLabels());
    labels.delete(iso);
    this.exclusionLabels.set(labels);
    this.refreshCalendar();
    this.scheduleSave();
  }

  clearAll(): void {
    this.dateOverrides.set([]);
    this.exclusionLabels.set(new Map());
    this.refreshCalendar();
    this.scheduleSave();
  }

  /** Force <mat-calendar> to re-evaluate `dateClass`. The component caches
   *  the per-cell class string and won't re-render on signal changes alone. */
  private refreshCalendar(): void {
    // updateTodaysDate() is the public API path that triggers a body redraw.
    this.exclusionCal?.updateTodaysDate();
  }

  /** Pretty-print a date for the list. */
  formatDate(d: Date | string): string {
    const iso = this.toIso(d);
    const [y, m, day] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, day ?? 1);
    return dt.toLocaleDateString(undefined, {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  exclusionLabel(date: Date | string): string | null {
    return this.exclusionLabels().get(this.toIso(date)) ?? null;
  }

  /** Fetch country holidays for the chosen year and merge into the exclusion
   *  list. Idempotent — dates already excluded are left alone but their label
   *  is filled in if missing. */
  loadHolidays(): void {
    if (this.loadingHolidays() || !this.selectedHolidayCountry) return;
    this.loadingHolidays.set(true);
    this.bookingSvc.getHolidays(this.holidayYear, this.selectedHolidayCountry).subscribe({
      next: (res) => {
        const existing = new Map<string, DateOverride>(
          this.dateOverrides().map((o) => [this.toIso(o.date), o]),
        );
        const labels = new Map(this.exclusionLabels());
        let added = 0;
        for (const h of res.holidays as HolidayItem[]) {
          if (!existing.has(h.date)) {
            existing.set(h.date, {
              date: h.date, startTime: '00:00', endTime: '23:59', isUnavailable: true,
            });
            added++;
          }
          // Tag the label with the country so multiple-country imports stay
          // distinguishable. Merge instead of overwrite when the same date
          // is a holiday in more than one of the imported countries.
          const tagged = `${h.name} (${res.country})`;
          const prev = labels.get(h.date);
          labels.set(
            h.date,
            !prev || prev === tagged
              ? tagged
              : prev.includes(`(${res.country})`) ? prev : `${prev}, ${tagged}`,
          );
        }
        this.dateOverrides.set([...existing.values()]);
        this.exclusionLabels.set(labels);
        this.loadingHolidays.set(false);
        this.refreshCalendar();
        if (added > 0) this.scheduleSave();
        const skipped = res.holidays.length - added;
        const msg = added === 0
          ? `All ${res.holidays.length} ${res.country} holidays were already in your list.`
          : `Added ${added} holiday${added === 1 ? '' : 's'} for ${res.country} ${res.year}` +
            (skipped > 0 ? ` (${skipped} already excluded).` : '.');
        this.snackBar.open(msg, 'OK', { duration: 4000 });
      },
      error: (err) => {
        this.loadingHolidays.set(false);
        const msg = err?.error?.error || 'Failed to load holidays.';
        this.snackBar.open(msg, 'OK', { duration: 4000 });
      },
    });
  }

  // ── Auto-save ────────────────────────────────────────────────────────────
  /** Schedule a debounced save. Resets any pending timer so a flurry of
   *  edits collapses into one PUT. No-op until the form is hydrated. */
  scheduleSave(): void {
    if (!this.autosaveArmed) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.savedStatusTimer) {
      clearTimeout(this.savedStatusTimer);
      this.savedStatusTimer = null;
    }
    this.saveTimer = setTimeout(() => this.flushSave(), this.saveDebounceMs);
  }

  private flushSave(): void {
    this.saveTimer = null;
    // Don't persist a schedule with an inverted time range — the inline error
    // is already visible and the user needs to fix it before we save.
    if (this.hasAnyInvalidRange()) {
      this.saveState.set('error');
      return;
    }
    this.saveState.set('saving');

    const payload: Partial<BookingSettingsData> = {
      timezone: this.timezone,
      weeklySchedule: this.weeklySchedule,
      targetCalendarId: this.targetCalendarId,
      conflictCalendarIds: this.conflictCalendarIds,
      rescheduleDeadlineHours: this.rescheduleDeadlineHours,
      dateOverrides: this.dateOverrides().map((o) => ({
        ...o,
        date: this.toIso(o.date),
      })),
    };

    this.bookingSvc.saveSettings(payload).subscribe({
      next: () => {
        this.saveState.set('saved');
        // Fade the "Saved" indicator back to idle after a few seconds so
        // the bar doesn't permanently feel "stale-confirmed".
        this.savedStatusTimer = setTimeout(() => {
          if (this.saveState() === 'saved') this.saveState.set('idle');
        }, 2500);
      },
      error: () => this.saveState.set('error'),
    });
  }

  ngOnDestroy(): void {
    // Don't lose the user's last edit if they navigate away mid-debounce.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flushSave();
    }
    if (this.savedStatusTimer) clearTimeout(this.savedStatusTimer);
  }
}

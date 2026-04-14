import { Component, OnInit, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PublicBookingService,
  CoachPublicInfo,
  AvailableSlot,
  BookingResult,
} from '../booking.service';

@Component({
  selector: 'app-public-booking',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="booking-page">
      @if (loadingInfo()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else if (errorMsg()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>{{ errorMsg() }}</h2>
        </div>
      } @else {
        <!-- Header -->
        <div class="booking-header">
          <div class="brand-bar"></div>
          <h1>{{ coachInfo()!.title }}</h1>
          <p class="coach-name">with {{ coachInfo()!.coachName }}</p>
          @if (coachInfo()!.description) {
            <p class="description">{{ coachInfo()!.description }}</p>
          }
          <div class="meta-row">
            <span><mat-icon>schedule</mat-icon> {{ coachInfo()!.duration }} min</span>
            <span class="tz-display" (click)="showTzPicker = !showTzPicker">
              <mat-icon>public</mat-icon> {{ clientTimezone }}
              <mat-icon class="expand">expand_more</mat-icon>
            </span>
          </div>
          @if (showTzPicker) {
            <mat-form-field appearance="outline" class="tz-select">
              <mat-label>Your timezone</mat-label>
              <mat-select [(ngModel)]="clientTimezone" (selectionChange)="onTimezoneChange()">
                @for (tz of timezones; track tz) {
                  <mat-option [value]="tz">{{ tz }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
        </div>

        <!-- Two-column layout -->
        <div class="booking-body">
          <!-- Left: Calendar -->
          <div class="calendar-panel">
            <div class="month-nav">
              <button mat-icon-button (click)="prevMonth()">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <h3>{{ monthLabel() }}</h3>
              <button mat-icon-button (click)="nextMonth()">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
            <div class="calendar-grid">
              <div class="weekday-header">
                @for (d of weekDays; track d) {
                  <span>{{ d }}</span>
                }
              </div>
              <div class="days-grid">
                @for (day of calendarDays(); track day.key) {
                  <button class="day-cell"
                    [class.other-month]="!day.currentMonth"
                    [class.has-slots]="day.hasSlots"
                    [class.selected]="day.dateStr === selectedDate()"
                    [class.today]="day.isToday"
                    [disabled]="!day.hasSlots || !day.currentMonth"
                    (click)="selectDate(day.dateStr)">
                    {{ day.dayNum }}
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Right: Slots + Form -->
          <div class="slots-panel">
            @if (loadingSlots()) {
              <div class="loading-small"><mat-spinner diameter="28" /></div>
            } @else if (selectedDate()) {
              <h3>{{ selectedDateLabel() }}</h3>

              @if (!selectedSlot()) {
                <div class="slot-list">
                  @for (slot of slotsForSelectedDate(); track slot.startUtc) {
                    <button mat-stroked-button class="slot-btn" (click)="pickSlot(slot)">
                      {{ slot.label }}
                    </button>
                  }
                  @if (!slotsForSelectedDate().length) {
                    <p class="no-slots">No available times on this date.</p>
                  }
                </div>
              } @else {
                <!-- Booking form -->
                <div class="selected-time">
                  <mat-icon>schedule</mat-icon>
                  <span>{{ selectedSlot()!.label }}</span>
                  <button mat-icon-button (click)="clearSlot()" class="change-btn">
                    <mat-icon>edit</mat-icon>
                  </button>
                </div>

                <form class="booking-form" (ngSubmit)="submitBooking()">
                  <div class="name-row">
                    <mat-form-field appearance="outline">
                      <mat-label>First Name</mat-label>
                      <input matInput [(ngModel)]="firstName" name="firstName" required />
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Last Name</mat-label>
                      <input matInput [(ngModel)]="lastName" name="lastName" required />
                    </mat-form-field>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Email</mat-label>
                    <input matInput type="email" [(ngModel)]="email" name="email" required />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Phone (optional)</mat-label>
                    <input matInput type="tel" [(ngModel)]="phone" name="phone" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>What would you like to discuss? (optional)</mat-label>
                    <textarea matInput [(ngModel)]="topic" name="topic" rows="3"></textarea>
                  </mat-form-field>
                  <button mat-flat-button color="primary" type="submit" class="submit-btn"
                          [disabled]="submitting() || !firstName || !lastName || !email">
                    @if (submitting()) { <mat-spinner diameter="20" /> }
                    Confirm Booking
                  </button>
                </form>
              }
            } @else {
              <div class="select-prompt">
                <mat-icon>touch_app</mat-icon>
                <p>Select a date to see available times</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .booking-page {
      min-height: 100vh; background: #f5f7fa;
      display: flex; flex-direction: column; align-items: center;
      padding: 32px 16px;
    }
    .loading, .error-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 80px 0; color: #6b7c93;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #dc2626; }
    }

    .booking-header {
      text-align: center; max-width: 600px; margin-bottom: 32px;
      .brand-bar { width: 60px; height: 4px; background: #3A9FD6; border-radius: 2px; margin: 0 auto 20px; }
      h1 { margin: 0 0 4px; font-size: 26px; color: #1B2A47; }
      .coach-name { margin: 0 0 8px; color: #3A9FD6; font-weight: 500; font-size: 16px; }
      .description { color: #6b7c93; margin: 0 0 16px; line-height: 1.5; }
    }
    .meta-row {
      display: flex; align-items: center; justify-content: center; gap: 20px;
      color: #6b7c93; font-size: 14px;
      span { display: flex; align-items: center; gap: 4px; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .tz-display { cursor: pointer; &:hover { color: #3A9FD6; } }
      .expand { font-size: 16px; width: 16px; height: 16px; }
    }
    .tz-select { margin-top: 12px; width: 300px; }

    .booking-body {
      display: grid; grid-template-columns: 360px 1fr;
      gap: 24px; max-width: 800px; width: 100%;
      background: #fff; border-radius: 16px; padding: 28px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    .calendar-panel { }
    .month-nav {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
      h3 { margin: 0; font-size: 16px; color: #1B2A47; }
    }
    .weekday-header {
      display: grid; grid-template-columns: repeat(7, 1fr);
      text-align: center; font-size: 12px; color: #9aa5b4;
      font-weight: 600; margin-bottom: 4px;
    }
    .days-grid {
      display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
    }
    .day-cell {
      width: 44px; height: 44px; border: none; border-radius: 50%;
      background: transparent; cursor: pointer; font-size: 14px;
      color: #1B2A47; display: flex; align-items: center; justify-content: center;
      margin: 0 auto; transition: all 0.15s;
      &:disabled { color: #d0d5dd; cursor: default; }
      &.other-month { visibility: hidden; }
      &.has-slots { font-weight: 600; }
      &.has-slots:hover { background: #EBF5FB; }
      &.selected { background: #3A9FD6; color: #fff; font-weight: 600; }
      &.today:not(.selected) { border: 2px solid #3A9FD6; }
    }

    .slots-panel {
      min-height: 300px;
      h3 { margin: 0 0 16px; font-size: 16px; color: #1B2A47; }
    }
    .loading-small {
      display: flex; justify-content: center; padding: 40px 0;
    }
    .select-prompt {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%; color: #9aa5b4;
      mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
    }

    .slot-list {
      display: flex; flex-wrap: wrap; gap: 8px;
    }
    .slot-btn {
      border-color: #3A9FD6 !important; color: #3A9FD6 !important;
      &:hover { background: #EBF5FB !important; }
    }
    .no-slots { color: #9aa5b4; font-style: italic; }

    .selected-time {
      display: flex; align-items: center; gap: 8px;
      background: #f0f9f4; padding: 10px 16px; border-radius: 8px;
      margin-bottom: 20px; color: #1B2A47; font-weight: 500;
      mat-icon { color: #27C4A0; }
      .change-btn { margin-left: auto; }
    }

    .booking-form {
      display: flex; flex-direction: column; gap: 0;
    }
    .name-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .full-width { width: 100%; }
    .submit-btn {
      margin-top: 4px; padding: 10px 0; font-size: 15px;
      mat-spinner { display: inline-block; margin-right: 8px; }
    }

    @media (max-width: 768px) {
      .booking-body {
        grid-template-columns: 1fr; padding: 20px;
      }
      .name-row { grid-template-columns: 1fr; }
      .day-cell { width: 38px; height: 38px; font-size: 13px; }
    }
  `],
})
export class PublicBookingComponent implements OnInit {
  coachSlug = '';
  coachInfo = signal<CoachPublicInfo | null>(null);
  loadingInfo = signal(true);
  loadingSlots = signal(false);
  errorMsg = signal('');
  submitting = signal(false);

  allSlots = signal<AvailableSlot[]>([]);
  selectedDate = signal('');
  selectedSlot = signal<AvailableSlot | null>(null);
  currentMonth = signal(new Date());

  // Timezone
  clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  showTzPicker = false;

  // Form fields
  firstName = '';
  lastName = '';
  email = '';
  phone = '';
  topic = '';

  readonly weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly timezones = [
    'America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Vancouver', 'Europe/London', 'Europe/Paris',
    'Europe/Berlin', 'Europe/Prague', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland', 'UTC',
  ];

  // Computed: dates with available slots
  private availableDates = computed(() => {
    const dates = new Set<string>();
    for (const slot of this.allSlots()) {
      const d = new Date(slot.startLocal);
      dates.add(this.toDateStr(d));
    }
    return dates;
  });

  // Calendar days grid
  calendarDays = computed(() => {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const today = this.toDateStr(new Date());
    const available = this.availableDates();

    const days: {
      key: string; dayNum: number; dateStr: string;
      currentMonth: boolean; hasSlots: boolean; isToday: boolean;
    }[] = [];

    // Previous month padding
    const prevMonthDays = new Date(year, m, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      days.push({ key: `prev-${d}`, dayNum: d, dateStr: '', currentMonth: false, hasSlots: false, isToday: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        key: dateStr,
        dayNum: d,
        dateStr,
        currentMonth: true,
        hasSlots: available.has(dateStr),
        isToday: dateStr === today,
      });
    }

    // Next month padding (fill to 42)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ key: `next-${d}`, dayNum: d, dateStr: '', currentMonth: false, hasSlots: false, isToday: false });
    }

    return days;
  });

  monthLabel = computed(() => {
    const m = this.currentMonth();
    return m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  selectedDateLabel = computed(() => {
    if (!this.selectedDate()) return '';
    const d = new Date(this.selectedDate() + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  slotsForSelectedDate = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.allSlots().filter((s) => {
      const d = new Date(s.startLocal);
      return this.toDateStr(d) === date;
    });
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingSvc: PublicBookingService,
    private snackBar: MatSnackBar,
    private auth: AuthService,
  ) {}

  /** Optional inputs for dialog/host embedding — when set, skip route reads. */
  @Input() coachSlugInput?: string;
  /** When true, emit `booked` instead of navigating to the confirm route. */
  @Input() dialogMode = false;
  @Output() booked = new EventEmitter<BookingResult>();
  @Output() cancelled = new EventEmitter<void>();

  ngOnInit(): void {
    this.coachSlug = this.coachSlugInput ?? this.route.snapshot.params['coachSlug'];
    this.loadCoachInfo();

    // Pre-fill the booking form when the visitor is an authenticated coachee.
    // Anonymous visitors see empty fields as before.
    const me = this.auth.currentUser();
    if (me) {
      this.firstName = me.firstName || '';
      this.lastName = me.lastName || '';
      this.email = me.email || '';
    }
  }

  private loadCoachInfo(): void {
    this.publicBookingSvc.getCoachInfo(this.coachSlug).subscribe({
      next: (info: CoachPublicInfo) => {
        this.coachInfo.set(info);
        this.loadingInfo.set(false);
        this.loadSlots();
      },
      error: () => {
        this.errorMsg.set('This booking page is not available.');
        this.loadingInfo.set(false);
      },
    });
  }

  private loadSlots(): void {
    this.loadingSlots.set(true);
    const from = this.toDateStr(new Date());
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 60);
    const to = this.toDateStr(toDate);

    this.publicBookingSvc.getSlots(this.coachSlug, from, to, this.clientTimezone).subscribe({
      next: (slots: AvailableSlot[]) => {
        this.allSlots.set(slots);
        this.loadingSlots.set(false);
      },
      error: () => {
        this.allSlots.set([]);
        this.loadingSlots.set(false);
      },
    });
  }

  onTimezoneChange(): void {
    this.showTzPicker = false;
    this.selectedSlot.set(null);
    this.selectedDate.set('');
    this.loadSlots();
  }

  selectDate(dateStr: string): void {
    this.selectedDate.set(dateStr);
    this.selectedSlot.set(null);
  }

  pickSlot(slot: AvailableSlot): void {
    this.selectedSlot.set(slot);
  }

  clearSlot(): void {
    this.selectedSlot.set(null);
  }

  prevMonth(): void {
    const m = new Date(this.currentMonth());
    m.setMonth(m.getMonth() - 1);
    this.currentMonth.set(m);
  }

  nextMonth(): void {
    const m = new Date(this.currentMonth());
    m.setMonth(m.getMonth() + 1);
    this.currentMonth.set(m);
  }

  submitBooking(): void {
    const slot = this.selectedSlot();
    if (!slot || !this.firstName || !this.lastName || !this.email) return;

    this.submitting.set(true);

    this.publicBookingSvc.createBooking(this.coachSlug, {
      startTime: slot.startUtc,
      endTime: slot.endUtc,
      clientName: `${this.firstName} ${this.lastName}`,
      clientEmail: this.email,
      clientPhone: this.phone || undefined,
      topic: this.topic || undefined,
      clientTimezone: this.clientTimezone,
    }).subscribe({
      next: (result: BookingResult) => {
        this.submitting.set(false);
        if (this.dialogMode) {
          this.booked.emit(result);
        } else {
          this.router.navigate(['/book', this.coachSlug, 'confirmed', result._id]);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 409) {
          // Could be a slot race OR an engagement quota block. The server
          // message is meaningful for the latter; fall back to the slot
          // copy when no explicit reason was returned.
          const serverMsg = err.error?.error as string | undefined;
          const msg = serverMsg || 'That time was just booked — please choose another.';
          this.snackBar.open(msg, 'OK', { duration: 6000 });
          if (!serverMsg) {
            this.selectedSlot.set(null);
            this.loadSlots();
          }
        } else {
          this.snackBar.open('Something went wrong. Please try again.', 'Retry', { duration: 5000 });
        }
      },
    });
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

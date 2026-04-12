import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { Clipboard } from '@angular/cdk/clipboard';
import {
  BookingService,
  AvailabilityConfig,
  WeeklySlot,
  EVENT_TYPE_COLORS,
} from '../booking.service';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-event-type-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
    <div class="editor-container">
      <div class="page-header">
        <a mat-icon-button routerLink="/booking/settings" matTooltip="Back to event types">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <h1>{{ eventTypeName || 'Edit Event Type' }}</h1>
          <p>Configure this booking page's settings, schedule, and appearance.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else {

      <!-- Name & Color -->
      <section class="card">
        <div class="card-header">
          <mat-icon>label</mat-icon>
          <div>
            <h2>Event Type</h2>
            <p>Name and visual identity for this booking page</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Name</mat-label>
            <input matInput [(ngModel)]="eventTypeName"
                   placeholder="e.g. 60-Minute Coaching, Quick Check-in" />
          </mat-form-field>
          <div class="color-picker">
            <span class="color-label">Color</span>
            <div class="color-swatches">
              @for (c of colors; track c) {
                <button class="swatch" [style.background]="c"
                        [class.selected]="c === color"
                        (click)="color = c"></button>
              }
            </div>
          </div>
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="isActive">Active</mat-slide-toggle>
            <span class="toggle-hint">Inactive event types won't accept new bookings</span>
          </div>
        </div>
      </section>

      <!-- Availability Schedule -->
      <section class="card">
        <div class="card-header">
          <mat-icon>schedule</mat-icon>
          <div>
            <h2>Availability Schedule</h2>
            <p>Use the shared schedule, or define a custom one for this event type only</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="useCustomSchedule" (change)="onScheduleModeChange()">
              Override default availability schedule
            </mat-slide-toggle>
            <span class="toggle-hint">
              When off, this event type uses the shared schedule from
              <a routerLink="/booking/global-settings">Booking Settings</a>.
            </span>
          </div>

          @if (useCustomSchedule) {
            <div class="schedule-grid">
              @for (slot of customSchedule; track slot.dayOfWeek) {
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
          }
        </div>
      </section>

      <!-- Inherited settings note -->
      <div class="inherited-note">
        <mat-icon>info_outline</mat-icon>
        <span>Calendar connection and timezone are shared across all event types.</span>
        <a routerLink="/booking/global-settings">Edit in Booking Settings</a>
      </div>

      <!-- Session Settings -->
      <section class="card">
        <div class="card-header">
          <mat-icon>tune</mat-icon>
          <div>
            <h2>Session Settings</h2>
            <p>Configure duration, buffer, and booking limits</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body settings-grid">
          <mat-form-field appearance="outline">
            <mat-label>Session duration (minutes)</mat-label>
            <mat-select [(ngModel)]="appointmentDuration">
              @for (d of durationOptions; track d) {
                <mat-option [value]="d">{{ d }} min</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Buffer between sessions (min)</mat-label>
            <input matInput type="number" [(ngModel)]="bufferTime" min="0" max="120" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Max bookings per day (0 = unlimited)</mat-label>
            <input matInput type="number" [(ngModel)]="maxBookingsPerDay" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Minimum notice (hours)</mat-label>
            <input matInput type="number" [(ngModel)]="minNoticeHours" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Max advance booking (days)</mat-label>
            <input matInput type="number" [(ngModel)]="maxAdvanceDays" min="1" max="365" />
          </mat-form-field>
          <div class="toggle-row">
            <mat-slide-toggle [(ngModel)]="googleMeetEnabled">
              Auto-create Google Meet link
            </mat-slide-toggle>
          </div>
        </div>
      </section>

      <!-- Booking Page Info -->
      <section class="card">
        <div class="card-header">
          <mat-icon>article</mat-icon>
          <div>
            <h2>Booking Page</h2>
            <p>Customize what clients see when they visit this booking link</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Page title</mat-label>
            <input matInput [(ngModel)]="bookingPageTitle"
                   placeholder="e.g. Book a Coaching Session" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput [(ngModel)]="bookingPageDesc" rows="3"
                      placeholder="Brief description shown on your booking page..."></textarea>
          </mat-form-field>
        </div>
      </section>

      <!-- Booking Link -->
      @if (coachSlug) {
      <section class="card">
        <div class="card-header">
          <mat-icon>link</mat-icon>
          <div>
            <h2>Booking Link</h2>
            <p>Share this link with clients</p>
          </div>
        </div>
        <mat-divider />
        <div class="card-body">
          <div class="link-row">
            <code class="booking-url">{{ bookingUrl() }}</code>
            <button mat-icon-button (click)="copyLink()" matTooltip="Copy link">
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
        </div>
      </section>
      }

      <!-- Actions -->
      <div class="actions">
        <a mat-stroked-button routerLink="/booking/settings">Cancel</a>
        <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { <mat-spinner diameter="20" /> }
          Save Changes
        </button>
      </div>

      }
    </div>
  `,
  styles: [`
    .editor-container {
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

    .color-picker {
      margin-bottom: 16px;
      .color-label { font-size: 14px; color: #6b7c93; margin-bottom: 8px; display: block; }
    }
    .color-swatches {
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .swatch {
      width: 32px; height: 32px; border-radius: 50%; border: 3px solid transparent;
      cursor: pointer; transition: transform 0.1s;
      &.selected { border-color: #1B2A47; transform: scale(1.15); }
      &:hover { transform: scale(1.1); }
    }
    .toggle-row {
      display: flex; align-items: center; gap: 12px; padding: 8px 0;
      grid-column: span 2;
    }
    .toggle-hint { font-size: 13px; color: #9aa5b4; }

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

    .settings-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px;
    }

    .inherited-note {
      display: flex; align-items: center; gap: 8px; padding: 12px 16px;
      background: #EBF5FB; border-radius: 8px; margin-bottom: 20px;
      font-size: 14px; color: #1B2A47;
      mat-icon { color: #3A9FD6; font-size: 20px; width: 20px; height: 20px; }
      a { color: #3A9FD6; text-decoration: none; margin-left: auto; white-space: nowrap;
        &:hover { text-decoration: underline; } }
    }

    .link-row {
      display: flex; align-items: center; gap: 8px;
      background: #f7f9fc; border-radius: 8px; padding: 12px 16px;
    }
    .booking-url {
      flex: 1; font-size: 14px; color: #3A9FD6; word-break: break-all;
    }

    .actions {
      display: flex; justify-content: flex-end; gap: 12px; padding: 8px 0 24px;
      button mat-spinner { display: inline-block; margin-right: 8px; }
    }

    @media (max-width: 600px) {
      .editor-container { padding: 16px; }
      .settings-grid { grid-template-columns: 1fr; }
      .schedule-row { flex-wrap: wrap; }
      .time-field { width: 120px; }
    }
  `],
})
export class EventTypeEditorComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);

  eventTypeId = '';

  // Form state
  eventTypeName = '';
  color = '#3A9FD6';
  isActive = true;
  appointmentDuration = 60;
  bufferTime = 0;
  maxBookingsPerDay = 0;
  minNoticeHours = 24;
  maxAdvanceDays = 60;
  googleMeetEnabled = true;
  bookingPageTitle = '';
  bookingPageDesc = '';
  coachSlug = '';

  useCustomSchedule = false;
  customSchedule: WeeklySlot[] = this.defaultSchedule();

  readonly colors = EVENT_TYPE_COLORS;
  readonly durationOptions = DURATION_OPTIONS;

  dayName(i: number): string { return DAY_NAMES[i]; }

  private defaultSchedule(): WeeklySlot[] {
    return Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      enabled: i >= 1 && i <= 5,
    }));
  }

  onScheduleModeChange(): void {
    if (this.useCustomSchedule && !this.customSchedule.some((s) => s.enabled)) {
      this.customSchedule = this.defaultSchedule();
    }
  }

  bookingUrl = computed(() =>
    this.coachSlug ? `${window.location.origin}/book/${this.coachSlug}` : ''
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingSvc: BookingService,
    private snackBar: MatSnackBar,
    private clipboard: Clipboard,
  ) {}

  ngOnInit(): void {
    this.eventTypeId = this.route.snapshot.params['id'];
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);

    this.bookingSvc.getEventType(this.eventTypeId).subscribe({
      next: (cfg: AvailabilityConfig) => {
        this.eventTypeName = cfg.name || '';
        this.color = cfg.color || '#3A9FD6';
        this.isActive = cfg.isActive;
        this.appointmentDuration = cfg.appointmentDuration;
        this.bufferTime = cfg.bufferTime;
        this.maxBookingsPerDay = cfg.maxBookingsPerDay ?? 0;
        this.minNoticeHours = cfg.minNoticeHours;
        this.maxAdvanceDays = cfg.maxAdvanceDays;
        this.googleMeetEnabled = cfg.googleMeetEnabled;
        this.bookingPageTitle = cfg.bookingPageTitle || '';
        this.bookingPageDesc = cfg.bookingPageDesc || '';
        this.coachSlug = cfg.coachSlug || '';
        this.useCustomSchedule = cfg.scheduleMode === 'custom';
        this.customSchedule = cfg.weeklySchedule?.length
          ? cfg.weeklySchedule.map((s) => ({ ...s }))
          : this.defaultSchedule();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Event type not found', 'OK', { duration: 3000 });
        this.router.navigate(['/booking/settings']);
      },
    });
  }

  copyLink(): void {
    this.clipboard.copy(this.bookingUrl());
    this.snackBar.open('Link copied!', 'OK', { duration: 2000 });
  }

  save(): void {
    if (!this.eventTypeName.trim()) {
      this.snackBar.open('Event type name is required', 'OK', { duration: 3000 });
      return;
    }

    const pageTitle = this.bookingPageTitle.trim() || this.eventTypeName.trim();
    this.bookingPageTitle = pageTitle;

    this.saving.set(true);
    const payload: Partial<AvailabilityConfig> = {
      name: this.eventTypeName,
      color: this.color,
      isActive: this.isActive,
      appointmentDuration: this.appointmentDuration,
      bufferTime: this.bufferTime,
      maxBookingsPerDay: this.maxBookingsPerDay || null,
      minNoticeHours: this.minNoticeHours,
      maxAdvanceDays: this.maxAdvanceDays,
      googleMeetEnabled: this.googleMeetEnabled,
      bookingPageTitle: pageTitle,
      bookingPageDesc: this.bookingPageDesc,
      scheduleMode: this.useCustomSchedule ? 'custom' : 'shared',
      weeklySchedule: this.useCustomSchedule ? this.customSchedule : [],
    };

    this.bookingSvc.updateEventType(this.eventTypeId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Event type saved', 'OK', { duration: 3000 });
        this.router.navigate(['/booking/settings']);
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Failed to save', 'OK', { duration: 3000 });
      },
    });
  }
}

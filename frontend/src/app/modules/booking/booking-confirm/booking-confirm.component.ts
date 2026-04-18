import { Component, OnInit, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { BookingResult, PublicBookingService } from '../booking.service';

import { TranslateModule } from '@ngx-translate/core';
@Component({
  selector: 'app-booking-confirm',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule,
    TranslateModule,
  ],
  template: `
    <div class="confirm-page">
      @if (loading()) {
        <div class="confirm-card">
          <p class="loading-text">Loading confirmation...</p>
        </div>
      } @else if (booking()) {
        <div class="confirm-card">
          <div class="success-icon">
            <span class="material-icons">check_circle</span>
          </div>
          <h1>{{ 'BOOKING.sessionConfirmed' | translate }}</h1>

          <div class="detail-box">
            <div class="detail-row">
              <span class="material-icons detail-icon">calendar_today</span>
              <span class="detail-text">
                <strong>{{ booking()!.startTime | date:'fullDate':clientTimezone() }}</strong>
              </span>
            </div>
            <div class="detail-row">
              <span class="material-icons detail-icon">schedule</span>
              <span class="detail-text">
                {{ booking()!.startTime | date:'shortTime':clientTimezone() }} –
                {{ booking()!.endTime | date:'shortTime':clientTimezone() }}
                <span class="tz-label">({{ clientTimezone() }})</span>
              </span>
            </div>
            <div class="detail-row">
              <span class="material-icons detail-icon">person</span>
              <span class="detail-text">{{ coachName() }}</span>
            </div>
            <div class="detail-row">
              <span class="material-icons detail-icon">timer</span>
              <span class="detail-text">{{ duration() }} minutes</span>
            </div>
          </div>

          @if (booking()!.meetingLink || booking()!.googleMeetLink) {
            <a class="meet-btn" [href]="booking()!.meetingLink || booking()!.googleMeetLink" target="_blank">
              <span class="material-icons">videocam</span>
              <span>{{ booking()!.calendarProvider === 'microsoft' ? 'Join Teams Meeting' : 'Join Google Meet' }}</span>
            </a>
          }

          <div class="calendar-links">
            <p class="cal-label">Add to your calendar:</p>
            <div class="cal-buttons">
              <a class="cal-btn" [href]="googleCalendarUrl()" target="_blank">
                <span class="material-icons">event</span>
                <span>Google Calendar</span>
              </a>
              <a class="cal-btn" [href]="icsUrl()" download="coaching-session.ics">
                <span class="material-icons">file_download</span>
                <span>Outlook / Apple (.ics)</span>
              </a>
            </div>
          </div>

          <div class="email-notice">
            <span class="material-icons email-icon">email</span>
            <p>A confirmation email has been sent to <strong>{{ clientEmail() }}</strong></p>
          </div>

          <p class="cancel-notice">
            Need to cancel? Use the link in your confirmation email.
          </p>

          @if (dialogMode) {
            <button mat-flat-button color="primary" class="done-btn" (click)="done.emit()">
              Done
            </button>
          }
        </div>
      } @else {
        <div class="confirm-card">
          <div class="warn-icon">
            <span class="material-icons">info</span>
          </div>
          <h2>{{ 'BOOKING.noBookingInfo' | translate }}</h2>
          <p class="fallback-text">Please book a session first.</p>
          <button mat-flat-button color="primary" (click)="goBack()">
            Go to Booking Page
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .confirm-page {
      min-height: 100vh;
      background: #f5f7fa;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    }

    .confirm-card {
      background: #ffffff;
      border-radius: 16px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    }

    .success-icon .material-icons {
      font-size: 64px;
      color: #27C4A0;
    }

    h1 {
      margin: 16px 0 24px;
      font-size: 24px;
      font-weight: 700;
      color: var(--artes-primary);
    }

    h2 {
      margin: 12px 0 8px;
      font-size: 20px;
      color: var(--artes-primary);
    }

    /* ── Detail box ─────────────────────────── */

    .detail-box {
      text-align: left;
      background: #f7f9fc;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .detail-icon {
      color: var(--artes-accent);
      font-size: 22px;
      flex-shrink: 0;
    }

    .detail-text {
      font-size: 15px;
      color: var(--artes-primary);
      line-height: 1.4;
    }

    .detail-text strong {
      font-weight: 600;
      color: var(--artes-primary);
    }

    .tz-label {
      color: #9aa5b4;
      font-size: 13px;
      margin-left: 4px;
    }

    /* ── Meet button ────────────────────────── */

    .meet-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 20px;
      margin-bottom: 20px;
      background: var(--artes-accent);
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: background 0.15s;
    }

    .meet-btn:hover {
      background: #2f89c3;
      text-decoration: none;
    }

    .meet-btn .material-icons {
      font-size: 20px;
      color: #ffffff;
    }

    /* ── Calendar links ─────────────────────── */

    .calendar-links {
      margin-bottom: 24px;
    }

    .cal-label {
      margin: 0 0 10px;
      color: #6b7c93;
      font-size: 14px;
    }

    .cal-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .cal-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border: 1px solid #d0d7e0;
      border-radius: 8px;
      color: var(--artes-primary);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      background: #ffffff;
      transition: background 0.15s, border-color 0.15s;
    }

    .cal-btn:hover {
      background: #f7f9fc;
      border-color: var(--artes-accent);
      text-decoration: none;
    }

    .cal-btn .material-icons {
      font-size: 20px;
      color: var(--artes-accent);
    }

    /* ── Email notice ───────────────────────── */

    .email-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
      background: #f0f9f4;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 16px;
    }

    .email-icon {
      color: #27C4A0;
      font-size: 22px;
      flex-shrink: 0;
    }

    .email-notice p {
      margin: 0;
      font-size: 14px;
      color: #5a6a7e;
      text-align: left;
    }

    .cancel-notice {
      color: #9aa5b4;
      font-size: 13px;
      margin: 0;
    }
    .done-btn { margin-top: 16px; min-width: 140px; }

    /* ── Fallback state ─────────────────────── */

    .warn-icon .material-icons {
      font-size: 48px;
      color: #f59e0b;
    }

    .loading-text {
      color: #6b7c93;
      font-size: 16px;
      padding: 40px 0;
    }

    .fallback-text {
      color: #6b7c93;
      margin: 0 0 16px;
    }

    /* ── Responsive ──────────────────────────── */

    @media (max-width: 480px) {
      .confirm-card {
        padding: 28px 20px;
      }

      .cal-buttons {
        flex-direction: column;
      }

      .cal-btn {
        justify-content: center;
      }
    }
  `],
})
export class BookingConfirmComponent implements OnInit {
  loading = signal(true);
  booking = signal<BookingResult | null>(null);
  coachName = signal('');
  duration = signal(60);
  clientTimezone = signal('UTC');
  clientEmail = signal('');

  private coachSlug = '';

  /** Dialog-mode inputs: set these when hosting inline instead of via route. */
  @Input() coachSlugInput?: string;
  @Input() bookingIdInput?: string;
  @Input() dialogMode = false;
  @Output() done = new EventEmitter<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicBookingSvc: PublicBookingService,
  ) {}

  ngOnInit(): void {
    this.coachSlug = this.coachSlugInput ?? this.route.snapshot.params['coachSlug'];
    const bookingId = this.bookingIdInput ?? this.route.snapshot.params['bookingId'];

    if (!bookingId) {
      this.loading.set(false);
      return;
    }

    this.publicBookingSvc.getConfirmation(this.coachSlug, bookingId).subscribe({
      next: (data) => {
        this.booking.set(data.booking);
        this.coachName.set(data.coachName || '');
        this.duration.set(data.duration || 60);
        this.clientTimezone.set(data.booking.clientTimezone || 'UTC');
        this.clientEmail.set(data.clientEmail || '');
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  googleCalendarUrl(): string {
    const b = this.booking();
    if (!b) return '';
    const start = new Date(b.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(b.endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Coaching Session',
      dates: `${start}/${end}`,
      details: (b.meetingLink || b.googleMeetLink) ? `Meeting: ${b.meetingLink || b.googleMeetLink}` : 'Coaching session',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  icsUrl(): string {
    const b = this.booking();
    if (!b) return '';
    const start = new Date(b.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(b.endTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ARTES//Booking//EN',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:Coaching Session with ${this.coachName()}`,
      (b.meetingLink || b.googleMeetLink) ? `LOCATION:${b.meetingLink || b.googleMeetLink}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines);
  }

  goBack(): void {
    if (this.dialogMode) { this.done.emit(); return; }
    this.router.navigate(['/book', this.coachSlug]);
  }
}

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
import { AuthService } from '../../../core/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  BookingService,
  AvailabilityConfig,
  BookingSettingsData,
  WeeklySlot,
  EVENT_TYPE_COLORS,
} from '../booking.service';

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const DAY_KEYS = ['COMMON.sunday', 'COMMON.monday', 'COMMON.tuesday', 'COMMON.wednesday', 'COMMON.thursday', 'COMMON.friday', 'COMMON.saturday'];
const DAY_SHORT_KEYS = ['COMMON.sundayShort', 'COMMON.mondayShort', 'COMMON.tuesdayShort', 'COMMON.wednesdayShort', 'COMMON.thursdayShort', 'COMMON.fridayShort', 'COMMON.saturdayShort'];

@Component({
  selector: 'app-event-type-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="editor-container">
      <div class="page-header">
        <a mat-icon-button routerLink="/booking/settings" [matTooltip]="'BOOKING.backToEventTypes' | translate">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="header-text">
          <h1>{{ eventTypeName || (eventTypeId === 'new' ? ('BOOKING.newEventTypeTitle' | translate) : ('BOOKING.editEventType' | translate)) }}</h1>
          <p>{{ 'BOOKING.configureSettings' | translate }}</p>
        </div>
        @if (!loading()) {
          <div class="header-actions">
            <a mat-stroked-button routerLink="/booking/settings">{{ 'BOOKING.cancel' | translate }}</a>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="saving()">
              @if (saving()) { <mat-spinner diameter="20" /> }
              {{ 'BOOKING.saveChanges' | translate }}
            </button>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else {

      <div class="editor-grid">
        <div class="editor-main">
          <!-- Name & Color -->
          <section class="card">
            <div class="card-header">
              <mat-icon>label</mat-icon>
              <div>
                <h2>{{ 'BOOKING.eventTypeSection' | translate }}</h2>
                <p>{{ 'BOOKING.nameAndIdentity' | translate }}</p>
              </div>
            </div>
            <mat-divider />
            <div class="card-body">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'BOOKING.nameLabel' | translate }}</mat-label>
                <input matInput [(ngModel)]="eventTypeName"
                       (ngModelChange)="onNameChange($event)"
                       placeholder="e.g. 60-Minute Coaching, Quick Check-in" />
              </mat-form-field>
              <div class="color-picker">
                <span class="color-label">{{ 'BOOKING.color' | translate }}</span>
                <div class="color-swatches">
                  @for (c of colors; track c) {
                    <button class="swatch" [style.background]="c"
                            [class.selected]="c === color"
                            (click)="color = c"></button>
                  }
                </div>
              </div>
              <div class="toggle-row">
                <mat-slide-toggle [(ngModel)]="isActive">{{ 'BOOKING.active' | translate }}</mat-slide-toggle>
                <span class="toggle-hint">{{ 'BOOKING.inactiveHint' | translate }}</span>
              </div>
            </div>
          </section>

          <!-- Session Settings -->
          <section class="card">
            <div class="card-header">
              <mat-icon>tune</mat-icon>
              <div>
                <h2>{{ 'BOOKING.sessionSettings' | translate }}</h2>
                <p>{{ 'BOOKING.configureDurationBuffer' | translate }}</p>
              </div>
            </div>
            <mat-divider />
            <div class="card-body settings-grid">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'BOOKING.sessionDuration' | translate }}</mat-label>
                <mat-select [(ngModel)]="appointmentDuration">
                  @for (d of durationOptions; track d) {
                    <mat-option [value]="d">{{ d }} min</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'BOOKING.bufferBetweenSessions' | translate }}</mat-label>
                <input matInput type="number" [(ngModel)]="bufferTime" min="0" max="120" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'BOOKING.maxBookingsPerDay' | translate }}</mat-label>
                <input matInput type="number" [(ngModel)]="maxBookingsPerDay" min="0" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'BOOKING.minimumNotice' | translate }}</mat-label>
                <input matInput type="number" [(ngModel)]="minNoticeHours" min="0" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'BOOKING.maxAdvanceBooking' | translate }}</mat-label>
                <input matInput type="number" [(ngModel)]="maxAdvanceDays" min="1" max="365" />
              </mat-form-field>
              <div class="toggle-row">
                <mat-slide-toggle [(ngModel)]="googleMeetEnabled">
                  {{ 'BOOKING.autoCreateGoogleMeet' | translate }}
                </mat-slide-toggle>
              </div>
            </div>
          </section>

          <!-- Booking Page Info -->
          <section class="card">
            <div class="card-header">
              <mat-icon>article</mat-icon>
              <div>
                <h2>{{ 'BOOKING.bookingPage' | translate }}</h2>
                <p>{{ 'BOOKING.customizeClientView' | translate }}</p>
              </div>
            </div>
            <mat-divider />
            <div class="card-body">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'BOOKING.pageTitle' | translate }}</mat-label>
                <input matInput [(ngModel)]="bookingPageTitle"
                       placeholder="e.g. Book a Coaching Session" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'BOOKING.description' | translate }}</mat-label>
                <textarea matInput [(ngModel)]="bookingPageDesc" rows="3"
                          placeholder="Brief description shown on your booking page..."></textarea>
              </mat-form-field>
            </div>
          </section>
        </div>

        <aside class="editor-side">
          <!-- Availability Schedule -->
          <section class="card">
            <div class="card-header">
              <mat-icon>schedule</mat-icon>
              <div>
                <h2>{{ 'BOOKING.availability' | translate }}</h2>
                <p>{{ 'BOOKING.sharedWithAllEventTypes' | translate }}</p>
              </div>
            </div>
            <mat-divider />
            <div class="card-body">
              <div class="toggle-row">
                <mat-slide-toggle [(ngModel)]="useCustomSchedule" (change)="onScheduleModeChange()">
                  {{ 'BOOKING.overrideDefaultSchedule' | translate }}
                </mat-slide-toggle>
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
                            <mat-label>{{ 'BOOKING.from' | translate }}</mat-label>
                            <input matInput type="time" [(ngModel)]="slot.startTime" />
                          </mat-form-field>
                          <span class="time-sep">&ndash;</span>
                          <mat-form-field appearance="outline" class="time-field">
                            <mat-label>{{ 'BOOKING.to' | translate }}</mat-label>
                            <input matInput type="time" [(ngModel)]="slot.endTime" />
                          </mat-form-field>
                        </div>
                      } @else {
                        <span class="unavailable-label">{{ 'BOOKING.unavailable' | translate }}</span>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="shared-schedule">
                  <div class="shared-label">
                    {{ 'BOOKING.usingSharedSchedule' | translate }}
                    <a routerLink="/booking/global-settings" class="edit-link">{{ 'BOOKING.editLink' | translate }}</a>
                  </div>
                  @if (sharedSchedule().length) {
                    <ul class="shared-list">
                      @for (slot of sharedSchedule(); track slot.dayOfWeek) {
                        <li class="shared-row" [class.off]="!slot.enabled">
                          <span class="shared-day">{{ dayShort(slot.dayOfWeek) }}</span>
                          @if (slot.enabled) {
                            <span class="shared-time">{{ slot.startTime }} – {{ slot.endTime }}</span>
                          } @else {
                            <span class="shared-off">{{ 'BOOKING.unavailable' | translate }}</span>
                          }
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="shared-empty">{{ 'BOOKING.noSharedSchedule' | translate }}</p>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Booking Link -->
          <section class="card">
            <div class="card-header">
              <mat-icon>link</mat-icon>
              <div>
                <h2>{{ 'BOOKING.bookingLink' | translate }}</h2>
                <p>{{ 'BOOKING.generatedFromName' | translate }}</p>
              </div>
            </div>
            <mat-divider />
            <div class="card-body">
              @if (coachSlug) {
                <div class="link-row">
                  <code class="booking-url">{{ bookingUrl() }}</code>
                  <button mat-icon-button (click)="copyLink()" [matTooltip]="'BOOKING.copyLinkTooltip' | translate">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </div>

                @if (slugWillChange()) {
                  <div class="slug-change-warn">
                    <mat-icon>swap_horiz</mat-icon>
                    <div>
                      <div class="swn-title">{{ 'BOOKING.linkWillChange' | translate }}</div>
                      <code class="swn-new">{{ previewBookingUrl() }}</code>
                      <div class="swn-hint">{{ 'BOOKING.previousLinkStop' | translate }}</div>
                    </div>
                  </div>
                }
              } @else {
                <div class="link-row">
                  <code class="booking-url">{{ previewBookingUrl() }}</code>
                </div>
                <p class="link-hint">{{ 'BOOKING.linkCreatedOnSave' | translate }}</p>
              }
            </div>
          </section>

          <div class="inherited-note">
            <mat-icon>info_outline</mat-icon>
            <span>{{ 'BOOKING.calendarSharedNote' | translate }}</span>
            <a routerLink="/booking/global-settings">{{ 'BOOKING.editLink' | translate }}</a>
          </div>
        </aside>
      </div>

      }
    </div>
  `,
  styles: [`
    .editor-container {
      max-width: 1600px; width: 100%; margin: 0 auto; padding: 0 24px 24px;
      box-sizing: border-box;
    }
    .editor-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .editor-main { min-width: 0; }
    .editor-side {
      display: flex; flex-direction: column; gap: 0;
    }
    @media (max-width: 960px) {
      .editor-grid { grid-template-columns: 1fr; }
    }

    .shared-schedule { margin-top: 4px; }
    .shared-label {
      display: flex; align-items: center;
      font-size: 12px; color: #6b7c93;
      text-transform: uppercase; letter-spacing: 0.6px;
      font-weight: 600; padding: 12px 2px 8px;
      .edit-link {
        margin-left: auto; text-transform: none; letter-spacing: 0;
        color: var(--artes-accent); font-weight: 600; text-decoration: none; font-size: 13px;
        &:hover { text-decoration: underline; }
      }
    }
    .shared-list {
      list-style: none; padding: 0; margin: 0;
      border-top: 1px solid #f0f3f7;
    }
    .shared-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 2px; font-size: 13px; color: var(--artes-primary);
      border-bottom: 1px solid #f5f7fa;
      &.off { color: #9aa5b4; }
      &:last-child { border-bottom: none; }
    }
    .shared-day { font-weight: 600; min-width: 40px; }
    .shared-time { font-variant-numeric: tabular-nums; }
    .shared-off { font-style: italic; font-size: 12px; }
    .shared-empty { font-size: 13px; color: #9aa5b4; margin: 8px 0 0; }
    .page-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 0; margin-bottom: 16px;
      position: sticky; top: 0; z-index: 5;
      background: #fafbfd;
      border-bottom: 1px solid #e8eef4;
      h1 { margin: 0 0 4px; font-size: 24px; color: var(--artes-primary); }
      p { margin: 0; color: #6b7c93; font-size: 13px; }
    }
    .header-text { flex: 1; min-width: 0;
      h1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .header-actions {
      display: flex; gap: 10px; align-items: center;
      mat-spinner { display: inline-block; margin-right: 8px; }
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
      > mat-icon { color: var(--artes-accent); font-size: 28px; width: 28px; height: 28px; }
      h2 { margin: 0; font-size: 17px; color: var(--artes-primary); }
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
      &.selected { border-color: var(--artes-primary); transform: scale(1.15); }
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
      background: var(--artes-bg); border-radius: 8px; margin-bottom: 20px;
      font-size: 14px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); font-size: 20px; width: 20px; height: 20px; }
      a { color: var(--artes-accent); text-decoration: none; margin-left: auto; white-space: nowrap;
        &:hover { text-decoration: underline; } }
    }

    .link-row {
      display: flex; align-items: center; gap: 8px;
      background: #f7f9fc; border-radius: 8px; padding: 12px 16px;
    }
    .booking-url {
      flex: 1; font-size: 14px; color: var(--artes-accent); word-break: break-all;
    }
    .link-hint { margin: 8px 0 0; font-size: 12px; color: #9aa5b4; }

    .slug-change-warn {
      display: flex; align-items: flex-start; gap: 10px;
      margin-top: 10px; padding: 10px 14px;
      background: #fef3cd; border-left: 3px solid #b07800;
      border-radius: 6px; color: var(--artes-primary); font-size: 13px;
      mat-icon { color: #b07800; flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; }
      .swn-title { font-weight: 700; margin-bottom: 2px; }
      .swn-new   { display: block; font-size: 13px; color: var(--artes-primary); word-break: break-all; margin-bottom: 4px; }
      .swn-hint  { font-size: 12px; color: #5a6a7e; }
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
  sharedSchedule = signal<WeeklySlot[]>([]);

  readonly colors = EVENT_TYPE_COLORS;
  readonly durationOptions = DURATION_OPTIONS;

  dayName(i: number): string { return this.translate.instant(DAY_KEYS[i]); }
  dayShort(i: number): string { return this.translate.instant(DAY_SHORT_KEYS[i]); }

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

  /** Slugify the event-type name the same way the backend does so the user
   *  sees exactly what the saved link will look like. */
  private slugifyName(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /** Coach-name prefix for the slug. Mirrors the backend convention of
   *  "{firstName}-{lastName}". Falls back to 'coach' if unavailable. */
  private coachNameSlug(): string {
    const u = this.auth.currentUser();
    if (!u) return 'coach';
    return this.slugifyName(`${u.firstName}-${u.lastName}`) || 'coach';
  }

  /** Slug that will be applied on save (current name, server will dedupe). */
  previewSlug(): string {
    const event = this.slugifyName(this.eventTypeName || '') || 'session';
    return `${this.coachNameSlug()}-${event}`;
  }

  /** URL the user will end up with once they save. */
  previewBookingUrl(): string {
    return `${window.location.origin}/book/${this.previewSlug()}`;
  }

  /** True when the name has changed in a way that will regenerate the slug. */
  slugWillChange(): boolean {
    return !!this.coachSlug && this.previewSlug() !== this.coachSlug;
  }

  /** Keep the booking-page title in sync with the event-type name until the
   *  user explicitly customizes it. The link preview is always derived from
   *  eventTypeName so no work is needed there. */
  onNameChange(newName: string): void {
    const titleInSync =
      !this.bookingPageTitle.trim() ||
      this.bookingPageTitle.trim() === this.prevEventTypeName.trim();
    if (titleInSync) {
      this.bookingPageTitle = newName;
    }
    this.prevEventTypeName = newName;
  }

  /** Previous eventTypeName, used to detect whether the booking-page title
   *  has been customized independently of the name. */
  private prevEventTypeName = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingSvc: BookingService,
    private snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private auth: AuthService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.eventTypeId = this.route.snapshot.params['id'];
    if (this.eventTypeId === 'new') {
      this.loadNew();
    } else {
      this.loadAll();
    }
  }

  /** Create-mode: seed defaults locally, no API call. Record doesn't exist
   *  on the server until the user clicks Save. */
  private loadNew(): void {
    this.loading.set(true);
    this.eventTypeName = '';
    this.prevEventTypeName = '';
    this.color = EVENT_TYPE_COLORS[0];
    this.isActive = true;
    this.appointmentDuration = 60;
    this.bufferTime = 0;
    this.maxBookingsPerDay = 0;
    this.minNoticeHours = 24;
    this.maxAdvanceDays = 60;
    this.googleMeetEnabled = true;
    this.bookingPageTitle = '';
    this.bookingPageDesc = '';
    this.coachSlug = '';
    this.useCustomSchedule = false;
    this.customSchedule = this.defaultSchedule();

    this.bookingSvc.getSettings().subscribe({
      next: (s: BookingSettingsData | null) => {
        this.sharedSchedule.set(
          s?.weeklySchedule?.length ? s.weeklySchedule : this.defaultSchedule(),
        );
        this.loading.set(false);
      },
      error: () => {
        this.sharedSchedule.set(this.defaultSchedule());
        this.loading.set(false);
      },
    });
  }

  private loadAll(): void {
    this.loading.set(true);

    this.bookingSvc.getSettings().subscribe({
      next: (s: BookingSettingsData | null) => {
        this.sharedSchedule.set(
          s?.weeklySchedule?.length ? s.weeklySchedule : this.defaultSchedule(),
        );
      },
      error: () => this.sharedSchedule.set(this.defaultSchedule()),
    });

    this.bookingSvc.getEventType(this.eventTypeId).subscribe({
      next: (cfg: AvailabilityConfig) => {
        this.eventTypeName = cfg.name || '';
        this.prevEventTypeName = cfg.name || '';
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
        this.snackBar.open(this.translate.instant('BOOKING.eventTypeNotFound'), this.translate.instant('COMMON.ok'), { duration: 3000 });
        this.router.navigate(['/booking/settings']);
      },
    });
  }

  copyLink(): void {
    this.clipboard.copy(this.bookingUrl());
    this.snackBar.open(this.translate.instant('BOOKING.linkCopied'), this.translate.instant('COMMON.ok'), { duration: 2000 });
  }

  save(): void {
    if (!this.eventTypeName.trim()) {
      this.snackBar.open(this.translate.instant('BOOKING.eventTypeNameRequired'), this.translate.instant('COMMON.ok'), { duration: 3000 });
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

    const isNew = this.eventTypeId === 'new';
    if (isNew) {
      payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    const request$ = isNew
      ? this.bookingSvc.createEventType(payload)
      : this.bookingSvc.updateEventType(this.eventTypeId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open(isNew ? this.translate.instant('BOOKING.eventTypeCreated') : this.translate.instant('BOOKING.eventTypeSaved'), this.translate.instant('COMMON.ok'), { duration: 3000 });
        this.router.navigate(['/booking/settings']);
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open(isNew ? this.translate.instant('BOOKING.failedToCreate') : this.translate.instant('BOOKING.failedToSave'), this.translate.instant('COMMON.ok'), { duration: 3000 });
      },
    });
  }
}

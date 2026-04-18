import { Component, EventEmitter, OnInit, Output, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  BookingService,
  ImportCoachee,
  ImportEvent,
  ImportEventType,
  ImportResultResponse,
} from '../booking.service';
import {
  CalendarIntegrationService,
  CalendarItem,
} from '../../coaching/calendar-integration/calendar-integration.service';

type State = 'idle' | 'loading' | 'preview' | 'importing' | 'done';

@Component({
  selector: 'app-booking-import',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
    MatCheckboxModule, MatTooltipModule, MatExpansionModule, MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="import-wrap">

      <!-- ═══════════════ IDLE ═══════════════ -->
      @if (state() === 'idle') {
        <div class="idle">
          <div class="intro">
            <mat-icon>cloud_download</mat-icon>
            <h2>{{ 'BOOKING.importTitle' | translate }}</h2>
            <p>
              Pull existing coaching sessions from your connected Google Calendar into
              this booking dashboard. Every event is previewed first — you approve
              each one before anything is imported.
            </p>
          </div>

          <div class="calendar-row">
            <mat-form-field appearance="outline" class="calendar-field">
              <mat-label>{{ 'BOOKING.sourceCalendar' | translate }}</mat-label>
              <mat-select [(ngModel)]="selectedCalendarId" [disabled]="loadingCalendars()">
                @for (c of calendars(); track c.id) {
                  <mat-option [value]="c.id">
                    {{ c.summary }}
                    @if (c.id === defaultCalendarId()) {
                      <span class="default-tag">— default</span>
                    }
                  </mat-option>
                }
              </mat-select>
              @if (loadingCalendars()) {
                <mat-hint>Loading calendars…</mat-hint>
              } @else {
                <mat-hint>Defaults to your booking-sync calendar — change to import from another.</mat-hint>
              }
            </mat-form-field>
          </div>

          <div class="date-row">
            <mat-form-field appearance="outline">
              <mat-label>From</mat-label>
              <input matInput [matDatepicker]="pickerFrom" [(ngModel)]="fromDate" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerFrom" />
              <mat-datepicker #pickerFrom />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>To</mat-label>
              <input matInput [matDatepicker]="pickerTo" [(ngModel)]="toDate" />
              <mat-datepicker-toggle matIconSuffix [for]="pickerTo" />
              <mat-datepicker #pickerTo />
            </mat-form-field>
          </div>

          <button mat-flat-button color="primary" (click)="runPreview()">
            <mat-icon>search</mat-icon> Preview Events
          </button>

          @if (error()) {
            <div class="error-banner">
              <mat-icon>error_outline</mat-icon>
              <span>{{ error() }}</span>
            </div>
          }
        </div>
      }

      <!-- ═══════════════ LOADING ═══════════════ -->
      @if (state() === 'loading') {
        <div class="center-state">
          <mat-spinner diameter="40" />
          <p>Fetching events from Google Calendar…</p>
          <span class="hint">Calendars with many events can take a few seconds.</span>
        </div>
      }

      <!-- ═══════════════ PREVIEW ═══════════════ -->
      @if (state() === 'preview') {
        <div class="preview">
          <div class="summary-bar">
            <strong>{{ events().length }}</strong> events &middot;
            <span class="chip done">{{ alreadyImportedCount() }} already imported</span>
            <span class="chip pending">{{ pendingCount() }} pending</span>
          </div>

          <div class="bulk">
            <button mat-stroked-button (click)="approveAllPending()">
              <mat-icon>check_circle</mat-icon> Approve all pending
            </button>
            <button mat-stroked-button (click)="skipAll()">
              <mat-icon>do_not_disturb_on</mat-icon> Skip all
            </button>
            <button mat-button (click)="cancelPreview()">Cancel</button>
          </div>

          @if (!events().length) {
            <div class="empty">
              <mat-icon>event_busy</mat-icon>
              <p>No coaching sessions found in this date range.</p>
              <span class="hint">Try widening the From / To window.</span>
            </div>
          } @else {
            <div class="table">
              <div class="th">
                <div class="col-check"></div>
                <div class="col-when">Date &amp; time</div>
                <div class="col-client">Attendee</div>
                <div class="col-coachee">Coachee</div>
                <div class="col-topic">Topic</div>
                <div class="col-evtype">Event type</div>
                <div class="col-dur">Duration</div>
                <div class="col-status">Status</div>
              </div>
              @for (ev of events(); track ev.googleEventId) {
                <div class="tr" [class.imported]="ev.alreadyImported" [class.approved]="ev.approved">
                  <div class="col-check">
                    @if (ev.alreadyImported) {
                      <mat-icon matTooltip="Already imported" class="lock-icon">lock</mat-icon>
                    } @else {
                      <mat-checkbox [checked]="ev.approved" (change)="toggleRow(ev, $event.checked)" />
                    }
                  </div>

                  <div class="col-when">
                    <div class="when-main">{{ ev.startTime | date:'MMM d, y' }}</div>
                    <div class="when-time">{{ ev.startTime | date:'shortTime' }}</div>
                  </div>

                  <div class="col-client">
                    <div class="client-name">
                      {{ ev.clientName }}
                      @if (!ev.clientEmail) {
                        <mat-icon class="warn-mark" matTooltip="No client email on this event">warning</mat-icon>
                      }
                    </div>
                    @if (ev.clientEmail) { <div class="client-email">{{ ev.clientEmail }}</div> }
                  </div>

                  <div class="col-coachee">
                    <select class="native-select"
                            [value]="resolvedCoachee(ev) ?? ''"
                            (change)="setCoachee(ev, $any($event.target).value || null)"
                            [disabled]="ev.alreadyImported">
                      <option value="">— No coachee —</option>
                      @for (c of coachees(); track c._id) {
                        <option [value]="c._id">
                          {{ c.firstName }} {{ c.lastName }} — {{ c.email }}
                        </option>
                      }
                    </select>
                    @if (ev.suggestedCoacheeId && ev.pickedCoacheeId === undefined) {
                      <span class="match-badge">Matched by email</span>
                    }
                  </div>

                  <div class="col-topic">
                    @if (isEditing('topic', ev)) {
                      <input class="edit-input" [(ngModel)]="editBuffer"
                             (blur)="commitEdit('topic', ev)"
                             (keydown.enter)="commitEdit('topic', ev)" autofocus />
                    } @else {
                      <div class="topic" (click)="beginEdit('topic', ev)">
                        {{ (ev.editedTopic ?? ev.topic) || '—' }}
                        @if (ev.editedTopic) { <mat-icon class="edit-mark">edit</mat-icon> }
                      </div>
                    }
                  </div>

                  <div class="col-evtype">
                    <select class="native-select"
                            [value]="resolvedEventType(ev) ?? ''"
                            (change)="setEventType(ev, $any($event.target).value || null)"
                            [disabled]="ev.alreadyImported">
                      <option value="">— No type —</option>
                      @for (t of eventTypes(); track t._id) {
                        <option [value]="t._id">{{ t.name }}</option>
                      }
                    </select>
                    @if (ev.suggestedEventTypeId && ev.pickedEventTypeId === undefined) {
                      <span class="match-badge">Matched by title</span>
                    }
                  </div>

                  <div class="col-dur">{{ ev.durationMinutes }} min</div>

                  <div class="col-status">
                    @if (ev.alreadyImported) {
                      <span class="st-chip imported">Imported</span>
                    } @else {
                      <span class="st-chip" [class.past]="ev.status === 'completed'"
                                            [class.upcoming]="ev.status === 'upcoming'">
                        {{ ev.status === 'completed' ? 'Past' : 'Upcoming' }}
                      </span>
                    }
                  </div>

                  <button mat-icon-button class="expand-btn" (click)="ev.expanded = !ev.expanded">
                    <mat-icon>{{ ev.expanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </button>

                  @if (ev.expanded) {
                    <div class="detail">
                      <div><strong>Raw title:</strong> {{ ev.rawSummary || '—' }}</div>
                      @if (ev.googleMeetLink) {
                        <div><strong>Meet link:</strong>
                          <a [href]="ev.googleMeetLink" target="_blank">{{ ev.googleMeetLink }}</a>
                        </div>
                      }
                      <div class="attendees">
                        <strong>Attendees ({{ ev.attendees.length }}):</strong>
                        <ul>
                          @for (a of ev.attendees; track a.email) {
                            <li>
                              {{ a.displayName || a.email }}
                              @if (a.email) { <span class="att-email">&lt;{{ a.email }}&gt;</span> }
                              @if (a.self) { <span class="att-badge">you</span> }
                              @if (a.organizer) { <span class="att-badge">organizer</span> }
                            </li>
                          }
                        </ul>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <div class="footer">
            <span class="sel-count">{{ selectedCount() }} event{{ selectedCount() === 1 ? '' : 's' }} selected for import</span>
            <div class="footer-actions">
              <button mat-button (click)="cancelPreview()">Cancel</button>
              <button mat-flat-button color="primary"
                      [disabled]="selectedCount() === 0"
                      (click)="runImport()">
                <mat-icon>cloud_upload</mat-icon>
                Import {{ selectedCount() }} event{{ selectedCount() === 1 ? '' : 's' }} →
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ IMPORTING ═══════════════ -->
      @if (state() === 'importing') {
        <div class="center-state">
          <mat-spinner diameter="40" />
          <p>Importing {{ selectedCount() }} event{{ selectedCount() === 1 ? '' : 's' }}…</p>
          <span class="hint">Do not close this tab.</span>
        </div>
      }

      <!-- ═══════════════ DONE ═══════════════ -->
      @if (state() === 'done' && result(); as r) {
        <div class="done">
          <div class="done-card">
            <mat-icon class="done-icon">check_circle</mat-icon>
            <h2>Import complete</h2>
            <div class="metrics">
              <div><span class="num">{{ r.imported }}</span><span>Imported</span></div>
              <div><span class="num">{{ r.skipped }}</span><span>Skipped</span></div>
              <div [class.err]="r.errors.length"><span class="num">{{ r.errors.length }}</span><span>Errors</span></div>
            </div>
            @if (r.errors.length) {
              <details class="errors">
                <summary>{{ r.errors.length }} error{{ r.errors.length === 1 ? '' : 's' }}</summary>
                <ul>
                  @for (err of r.errors; track err.googleEventId) {
                    <li><code>{{ err.googleEventId }}</code>: {{ err.message }}</li>
                  }
                </ul>
              </details>
            }
            <div class="done-actions">
              <button mat-stroked-button (click)="viewDashboard.emit()">
                <mat-icon>event</mat-icon> View booking dashboard
              </button>
              <button mat-flat-button color="primary" (click)="resetToIdle()">
                <mat-icon>refresh</mat-icon> Import more
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .import-wrap { padding: 16px 4px 24px; width: 100%; box-sizing: border-box; }

    /* ─ IDLE ─ */
    .idle { max-width: 720px; margin: 0 auto; padding: 24px; }
    .intro {
      text-align: center; padding: 20px 0 28px;
      mat-icon { font-size: 44px; width: 44px; height: 44px; color: var(--artes-accent); }
      h2 { margin: 8px 0 4px; color: var(--artes-primary); font-size: 20px; }
      p  { margin: 0 auto; max-width: 520px; color: #6b7c93; font-size: 14px; line-height: 1.5; }
    }
    .calendar-row { display: flex; justify-content: center; margin-bottom: 4px; }
    .calendar-field { width: 100%; max-width: 460px; }
    .default-tag { color: #9aa5b4; font-size: 12px; margin-left: 6px; }
    .date-row { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
    .idle > button { display: block; margin: 0 auto; min-width: 200px; }
    .error-banner {
      margin-top: 20px; padding: 12px 16px; border-radius: 10px;
      background: #fef2f2; color: #b91c1c; display: flex; align-items: center; gap: 8px;
      mat-icon { color: #b91c1c; }
    }

    /* ─ Centered states (loading/importing) ─ */
    .center-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 80px 20px; color: #5a6a7e;
      p { margin: 0; font-size: 15px; color: var(--artes-primary); font-weight: 500; }
      .hint { font-size: 12px; color: #9aa5b4; }
    }

    /* ─ PREVIEW ─ */
    .preview { display: flex; flex-direction: column; gap: 12px; }
    .summary-bar {
      background: #f8fafc; border: 1px solid #eef2f7; border-radius: 10px;
      padding: 10px 16px; font-size: 14px; color: var(--artes-primary);
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .chip {
      font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
      &.done { background: #f0f4f8; color: #5a6a7e; }
      &.pending { background: #e8faf4; color: #1a9678; }
    }
    .bulk { display: flex; gap: 8px; flex-wrap: wrap; }
    .empty {
      text-align: center; padding: 48px; color: #6b7c93;
      background: #fff; border-radius: 12px; border: 1px solid #eef2f7;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c8d3df; display: block; margin: 0 auto 8px; }
    }
    .hint { color: #9aa5b4; font-size: 12px; }

    .table {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px; overflow: hidden;
    }
    .th, .tr {
      display: grid;
      grid-template-columns:
        40px         /* check */
        110px        /* date/time */
        minmax(160px, 1.2fr)  /* attendee */
        minmax(200px, 1.4fr)  /* coachee picker */
        minmax(180px, 1.5fr)  /* topic (editable) */
        minmax(200px, 1.4fr)  /* event type picker */
        70px         /* duration */
        80px         /* status */
        36px;        /* expand */
      align-items: start;
      gap: 12px;
      padding: 12px 16px;
    }
    .th { align-items: center; }

    /* Plain native select, styled to match the table. Avoids Angular Material's
       form-field chrome which can't be reliably collapsed below ~56px. */
    .native-select {
      width: 100%;
      height: 30px;
      padding: 4px 26px 4px 10px;
      border: 1px solid #dbe3ec;
      border-radius: 6px;
      background: #fff;
      color: var(--artes-primary);
      font: inherit;
      font-size: 12px;
      line-height: 1.2;
      cursor: pointer;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%235a6a7e'><path d='M7 10l5 5 5-5z'/></svg>");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }
    .native-select:hover:not(:disabled) { border-color: #9aa5b4; }
    .native-select:focus {
      outline: none; border-color: var(--artes-accent);
      box-shadow: 0 0 0 2px rgba(58,159,214,0.18);
    }
    .native-select:disabled { background: #f4f6fa; color: #9aa5b4; cursor: not-allowed; }
    .opt-email { color: #9aa5b4; font-size: 12px; margin-left: 4px; }
    .match-badge {
      display: block; font-size: 10px; color: #1a9678;
      margin-top: 4px; padding-left: 4px;
      &::before { content: '✓ '; }
    }
    .th {
      font-size: 11px; font-weight: 700; color: #9aa5b4;
      text-transform: uppercase; letter-spacing: 0.3px;
      border-bottom: 1px solid #eef2f7; background: #fafbfd;
    }
    .tr {
      border-bottom: 1px solid #f4f6fa; position: relative;
      &:last-child { border-bottom: none; }
      &.imported { opacity: 0.55; }
      &.approved { background: rgba(39,196,160,0.04); }
    }
    .col-when .when-main  { font-weight: 600; color: var(--artes-primary); font-size: 13px; }
    .col-when .when-time  { font-size: 12px; color: #5a6a7e; }
    .client-name {
      font-weight: 600; color: var(--artes-primary); font-size: 13px; cursor: pointer;
      display: flex; align-items: center; gap: 4px;
      &:hover { text-decoration: underline dashed #9aa5b4; text-underline-offset: 2px; }
      .edit-mark, .warn-mark { font-size: 14px; width: 14px; height: 14px; }
      .edit-mark { color: var(--artes-accent); }
      .warn-mark { color: #f0a500; }
    }
    .client-email { font-size: 12px; color: #6b7c93; }
    .topic {
      font-size: 13px; color: var(--artes-primary); cursor: pointer;
      line-height: 1.45; word-break: break-word;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden;
      &:hover { text-decoration: underline dashed #9aa5b4; text-underline-offset: 2px; }
      .edit-mark {
        font-size: 14px; width: 14px; height: 14px; color: var(--artes-accent);
        vertical-align: middle; margin-left: 2px;
      }
    }
    .edit-input {
      width: 100%; border: 1px solid var(--artes-accent); border-radius: 6px;
      padding: 4px 8px; font-size: 13px; outline: none;
      &:focus { border-color: var(--artes-primary); box-shadow: 0 0 0 2px rgba(58,159,214,0.15); }
    }
    .st-chip {
      display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 3px 8px; border-radius: 999px;
      &.upcoming { background: #e0f0fb; color: #2080b0; }
      &.past     { background: #f0f4f8; color: #5a6a7e; }
      &.imported { background: #f3eaff; color: #7c5cbf; }
    }
    .lock-icon { color: #9aa5b4; font-size: 18px; width: 18px; height: 18px; }
    .expand-btn { justify-self: end; }
    .detail {
      grid-column: 1 / -1;
      padding: 10px 14px; background: #fafbfd; border-top: 1px solid #eef2f7;
      font-size: 13px; color: #5a6a7e;
      div { margin-bottom: 4px; }
      a { color: var(--artes-accent); word-break: break-all; }
      .attendees ul { margin: 4px 0 0 0; padding-left: 20px; }
      .att-email { color: #9aa5b4; font-size: 12px; margin-left: 4px; }
      .att-badge { background: var(--artes-bg); color: #2080b0; font-size: 10px; padding: 1px 6px;
                   border-radius: 999px; margin-left: 4px; font-weight: 600; }
    }

    .footer {
      position: sticky; bottom: 0; z-index: 1;
      display: flex; align-items: center; justify-content: space-between;
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px;
      padding: 12px 16px; box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
    }
    .sel-count { font-size: 13px; color: var(--artes-primary); font-weight: 500; }
    .footer-actions { display: flex; gap: 8px; }

    /* ─ DONE ─ */
    .done { display: flex; justify-content: center; padding: 40px 16px; }
    .done-card {
      background: #fff; border: 1px solid #eef2f7; border-radius: 16px;
      padding: 32px 36px; max-width: 540px; width: 100%; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.04);
    }
    .done-icon {
      font-size: 48px; width: 48px; height: 48px; color: #27C4A0;
      display: block; margin: 0 auto 8px;
    }
    .done-card h2 { margin: 0 0 20px; color: var(--artes-primary); font-size: 22px; }
    .metrics {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-bottom: 20px;
      > div {
        background: #f8fafc; border-radius: 10px; padding: 14px 8px;
        display: flex; flex-direction: column; gap: 4px;
        .num { font-size: 26px; font-weight: 700; color: var(--artes-primary); }
        span:last-child { font-size: 12px; color: #6b7c93; text-transform: uppercase; letter-spacing: 0.3px; }
      }
      > div.err .num { color: #b91c1c; }
    }
    .errors {
      text-align: left; background: #fef2f2; border: 1px solid #fecaca;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
      summary { cursor: pointer; font-weight: 600; color: #b91c1c; }
      ul { margin: 8px 0 0; padding-left: 20px; font-size: 12px; color: #5a6a7e; }
      code { background: #fff; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
    }
    .done-actions { display: flex; gap: 10px; justify-content: center; }
  `],
})
export class BookingImportComponent implements OnInit {
  @Output() viewDashboard = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  state = signal<State>('idle');
  events = signal<ImportEvent[]>([]);
  coachees = signal<ImportCoachee[]>([]);
  eventTypes = signal<ImportEventType[]>([]);
  error = signal<string>('');
  result = signal<ImportResultResponse | null>(null);

  // Calendar picker state.
  calendars = signal<CalendarItem[]>([]);
  defaultCalendarId = signal<string | null>(null);
  loadingCalendars = signal<boolean>(true);
  selectedCalendarId: string | null = null;

  // Defaults: current month, 1st → last day.
  fromDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  toDate:   Date = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  // Inline-edit state (topic only now).
  editingField: 'topic' | null = null;
  editingId: string | null = null;
  editBuffer = '';

  constructor(
    private bookingSvc: BookingService,
    private calendarSvc: CalendarIntegrationService,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.loadingCalendars.set(true);
    this.calendarSvc.getStatus().subscribe({
      next: (status) => {
        this.defaultCalendarId.set(status.calendarId);
        this.selectedCalendarId = status.calendarId;
        this.calendarSvc.listCalendars().subscribe({
          next: (list) => {
            this.calendars.set(list);
            // Make sure the default is in the list (it should be) so the
            // mat-select shows a value rather than blank.
            if (this.selectedCalendarId
                && !list.find((c) => c.id === this.selectedCalendarId)) {
              this.selectedCalendarId = list[0]?.id ?? null;
            }
            this.loadingCalendars.set(false);
          },
          error: () => this.loadingCalendars.set(false),
        });
      },
      error: () => this.loadingCalendars.set(false),
    });
  }

  alreadyImportedCount = computed(() => this.events().filter((e) => e.alreadyImported).length);
  pendingCount         = computed(() => this.events().filter((e) => !e.alreadyImported).length);
  selectedCount        = computed(() => this.events().filter((e) => e.approved && !e.alreadyImported).length);

  runPreview(): void {
    this.error.set('');
    this.state.set('loading');
    const from = this.fromDate.toISOString();
    const to = this.toDate.toISOString();
    this.bookingSvc.previewImport(from, to, this.selectedCalendarId ?? undefined).subscribe({
      next: (res) => {
        // Default: approve every non-imported event.
        const list = res.events.map((e) => ({ ...e, approved: !e.alreadyImported }));
        this.events.set(list);
        this.coachees.set(res.coachees);
        this.eventTypes.set(res.eventTypes);
        this.state.set('preview');
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Failed to fetch calendar events.');
        this.state.set('idle');
      },
    });
  }

  toggleRow(ev: ImportEvent, checked: boolean): void {
    this.events.update((list) => list.map((e) =>
      e.googleEventId === ev.googleEventId ? { ...e, approved: checked } : e,
    ));
  }

  approveAllPending(): void {
    this.events.update((list) => list.map((e) => e.alreadyImported ? e : { ...e, approved: true }));
  }

  skipAll(): void {
    this.events.update((list) => list.map((e) => e.alreadyImported ? e : { ...e, approved: false }));
  }

  // ── Inline edit (topic only) ────────────────────────────────────────────
  isEditing(field: 'topic', ev: ImportEvent): boolean {
    return this.editingField === field && this.editingId === ev.googleEventId;
  }

  beginEdit(field: 'topic', ev: ImportEvent): void {
    if (ev.alreadyImported) return;
    this.editingField = field;
    this.editingId = ev.googleEventId;
    this.editBuffer = ev.editedTopic ?? ev.topic ?? '';
  }

  commitEdit(_field: 'topic', ev: ImportEvent): void {
    const v = this.editBuffer.trim();
    this.events.update((list) => list.map((e) => {
      if (e.googleEventId !== ev.googleEventId) return e;
      return { ...e, editedTopic: v && v !== (e.topic ?? '') ? v : undefined };
    }));
    this.editingField = null;
    this.editingId = null;
    this.editBuffer = '';
  }

  // ── Coachee + event-type pickers ────────────────────────────────────────
  /** Current effective coachee id: picked override || suggestion || null. */
  resolvedCoachee(ev: ImportEvent): string | null {
    if (ev.pickedCoacheeId !== undefined) return ev.pickedCoacheeId;
    return ev.suggestedCoacheeId ?? null;
  }

  setCoachee(ev: ImportEvent, id: string | null): void {
    this.events.update((list) => list.map((e) =>
      e.googleEventId === ev.googleEventId ? { ...e, pickedCoacheeId: id } : e,
    ));
  }

  resolvedEventType(ev: ImportEvent): string | null {
    if (ev.pickedEventTypeId !== undefined) return ev.pickedEventTypeId;
    return ev.suggestedEventTypeId ?? null;
  }

  setEventType(ev: ImportEvent, id: string | null): void {
    this.events.update((list) => list.map((e) =>
      e.googleEventId === ev.googleEventId ? { ...e, pickedEventTypeId: id } : e,
    ));
  }

  cancelPreview(): void {
    this.events.set([]);
    this.coachees.set([]);
    this.eventTypes.set([]);
    this.result.set(null);
    this.state.set('idle');
  }

  runImport(): void {
    const selected = this.events().filter((e) => e.approved && !e.alreadyImported);
    if (!selected.length) return;

    const overrides: Record<string, {
      topic?: string | null;
      coacheeId?: string | null;
      eventTypeId?: string | null;
    }> = {};
    const suggestions: Record<string, {
      suggestedCoacheeId?: string | null;
      suggestedEventTypeId?: string | null;
    }> = {};

    for (const e of selected) {
      if (e.editedTopic !== undefined
          || e.pickedCoacheeId !== undefined
          || e.pickedEventTypeId !== undefined) {
        overrides[e.googleEventId] = {
          ...(e.editedTopic !== undefined ? { topic: e.editedTopic } : {}),
          ...(e.pickedCoacheeId !== undefined ? { coacheeId: e.pickedCoacheeId } : {}),
          ...(e.pickedEventTypeId !== undefined ? { eventTypeId: e.pickedEventTypeId } : {}),
        };
      }
      // Always echo the preview suggestions so execute doesn't re-match.
      suggestions[e.googleEventId] = {
        suggestedCoacheeId: e.suggestedCoacheeId,
        suggestedEventTypeId: e.suggestedEventTypeId,
      };
    }

    this.state.set('importing');
    this.bookingSvc.executeImport(
      selected.map((e) => e.googleEventId),
      overrides,
      suggestions,
      this.selectedCalendarId ?? undefined,
    ).subscribe({
      next: (res) => {
        this.result.set(res);
        this.state.set('done');
        if (res.imported > 0) this.imported.emit();
      },
      error: (err) => {
        this.snack.open(err?.error?.error ?? 'Import failed.', 'OK', { duration: 4000 });
        this.state.set('preview');
      },
    });
  }

  resetToIdle(): void {
    this.events.set([]);
    this.coachees.set([]);
    this.eventTypes.set([]);
    this.result.set(null);
    this.state.set('idle');
  }
}

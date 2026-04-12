import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit,
  ViewChild, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Subscription, forkJoin } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { BookingService, BookingRecord, AvailabilityConfig } from '../booking.service';

type DayBuckets = {
  upcoming: BookingRecord[];
  past: BookingRecord[];
  cancelled: BookingRecord[];
};

@Component({
  selector: 'app-booking-dashboard',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatMenuModule,
    MatTooltipModule, MatDialogModule, MatChipsModule,
    MatSelectModule, MatFormFieldModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  template: `
    <div class="dashboard-container">
      <div class="page-header">
        <div>
          <h1>Bookings</h1>
          <p>Manage client bookings across all your event types</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/booking/global-settings">
            <mat-icon>settings</mat-icon> Settings
          </a>
          <a mat-flat-button color="primary" routerLink="/booking/settings">
            <mat-icon>event_note</mat-icon> Event Types
          </a>
        </div>
      </div>

      <!-- Event type filter -->
      @if (eventTypes().length > 1) {
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filter by event type</mat-label>
            <mat-select [(ngModel)]="selectedEventTypeId" (selectionChange)="onFilterChange()">
              <mat-option value="">All event types</mat-option>
              @for (et of eventTypes(); track et._id) {
                <mat-option [value]="et._id">
                  <span class="et-dot" [style.background]="et.color"></span>
                  {{ et.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }

      <div class="dashboard-grid">
        <div class="main-column">
          <mat-tab-group (selectedTabChange)="onTabChange($event.index)" animationDuration="200ms">
            <mat-tab label="Upcoming">
              <ng-template matTabContent>
                <ng-container *ngTemplateOutlet="bookingList" />
              </ng-template>
            </mat-tab>
            <mat-tab label="Past">
              <ng-template matTabContent>
                <ng-container *ngTemplateOutlet="bookingList" />
              </ng-template>
            </mat-tab>
            <mat-tab label="Cancelled">
              <ng-template matTabContent>
                <ng-container *ngTemplateOutlet="bookingList" />
              </ng-template>
            </mat-tab>
          </mat-tab-group>
        </div>

        <aside class="side-column">
          <div class="calendar-card" #calContainer>
            <mat-calendar
              [selected]="selectedDate()"
              (selectedChange)="onDateSelected($event)"
              [dateClass]="dateClass">
            </mat-calendar>
            <div class="calendar-legend">
              <span class="legend-item"><span class="legend-dot dot-upcoming"></span> Upcoming</span>
              <span class="legend-item"><span class="legend-dot dot-past"></span> Past</span>
              <span class="legend-item"><span class="legend-dot dot-cancelled"></span> Cancelled</span>
            </div>
          </div>

          <div class="upcoming-card">
            <div class="upcoming-header">
              <mat-icon>event</mat-icon>
              <h3>Upcoming events</h3>
            </div>
            @if (upcomingLoading()) {
              <div class="upcoming-loading"><mat-spinner diameter="24" /></div>
            } @else if (!upcomingEvents().length) {
              <p class="upcoming-empty">No upcoming sessions.</p>
            } @else {
              <ul class="upcoming-list">
                @for (b of upcomingEvents(); track b._id) {
                  <li class="upcoming-item">
                    <div class="upcoming-date">
                      <span class="upcoming-day">{{ b.startTime | date:'d' }}</span>
                      <span class="upcoming-month">{{ b.startTime | date:'MMM' }}</span>
                    </div>
                    <div class="upcoming-body">
                      <div class="upcoming-title">{{ b.clientName }}</div>
                      <div class="upcoming-meta">
                        {{ b.startTime | date:'shortTime' }} &middot;
                        <span class="upcoming-type" [style.color]="eventTypeColor(b.eventTypeId)">
                          {{ b.eventTypeName || 'Session' }}
                        </span>
                      </div>
                    </div>
                    @if (b.googleMeetLink) {
                      <a mat-icon-button [href]="b.googleMeetLink" target="_blank"
                         matTooltip="Join Google Meet">
                        <mat-icon>videocam</mat-icon>
                      </a>
                    }
                  </li>
                }
              </ul>
            }
          </div>
        </aside>
      </div>

      <ng-template #bookingList>
        @if (loading()) {
          <div class="loading"><mat-spinner diameter="36" /></div>
        } @else if (!bookings().length) {
          <div class="empty-state">
            <mat-icon>event_busy</mat-icon>
            <h3>No {{ activeTab() }} bookings</h3>
            <p>
              @switch (activeTab()) {
                @case ('upcoming') { When clients book sessions, they'll appear here. }
                @case ('past') { Completed sessions will appear here. }
                @case ('cancelled') { Cancelled sessions will appear here. }
              }
            </p>
          </div>
        } @else {
          <div class="booking-table">
            <div class="table-header">
              <span class="col-date">Date & Time</span>
              <span class="col-type">Event Type</span>
              <span class="col-client">Client</span>
              <span class="col-topic">Topic</span>
              <span class="col-status">Status</span>
              <span class="col-actions"></span>
            </div>
            @for (b of bookings(); track b._id) {
              <div class="table-row">
                <span class="col-date">
                  <strong>{{ b.startTime | date:'mediumDate' }}</strong><br/>
                  <span class="time-label">{{ b.startTime | date:'shortTime' }} – {{ b.endTime | date:'shortTime' }}</span>
                </span>
                <span class="col-type">
                  <span class="type-badge" [style.border-left-color]="eventTypeColor(b.eventTypeId)">
                    {{ b.eventTypeName || 'Session' }}
                  </span>
                </span>
                <span class="col-client">
                  <strong>{{ b.clientName }}</strong><br/>
                  <span class="email-label">{{ b.clientEmail }}</span>
                </span>
                <span class="col-topic">{{ b.topic || '\u2014' }}</span>
                <span class="col-status">
                  <span class="status-chip" [class]="'status-' + b.status">
                    {{ b.status }}
                  </span>
                </span>
                <span class="col-actions">
                  @if (b.googleMeetLink) {
                    <a mat-icon-button [href]="b.googleMeetLink" target="_blank"
                       matTooltip="Open Google Meet">
                      <mat-icon>videocam</mat-icon>
                    </a>
                  }
                  @if (b.status === 'confirmed') {
                    <button mat-icon-button color="warn" (click)="confirmCancel(b)"
                            matTooltip="Cancel booking">
                      <mat-icon>cancel</mat-icon>
                    </button>
                  }
                </span>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <button mat-icon-button (click)="prevPage()" [disabled]="currentPage() <= 1">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
              <button mat-icon-button (click)="nextPage()" [disabled]="currentPage() >= totalPages()">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        }
      </ng-template>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1800px; width: 100%; margin: 0 auto; padding: 24px;
      box-sizing: border-box;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
      gap: 24px;
      align-items: start;
    }
    .main-column { min-width: 0; }
    .side-column {
      display: flex; flex-direction: column; gap: 16px;
      position: sticky; top: 16px;
    }
    .calendar-card, .upcoming-card {
      background: #fff; border: 1px solid #eef2f7; border-radius: 12px;
      padding: 12px; box-shadow: 0 1px 2px rgba(27, 42, 71, 0.04);
    }
    .calendar-card ::ng-deep .mat-calendar { width: 100%; }

    /* Dots via ::after on the inner circle (which has real size and
       is position: absolute relative to the td). No padding on the
       content element so the day number stays centered. */
    .calendar-card ::ng-deep .mat-calendar-body-cell[class*="bk-"] .mat-calendar-body-cell-content::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      width: 4px; height: 4px;
      border-radius: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 2;
    }

    /* Single-status dots */
    .calendar-card ::ng-deep .bk-u:not(.bk-p):not(.bk-c) .mat-calendar-body-cell-content::after { background: #3A9FD6; }
    .calendar-card ::ng-deep .bk-p:not(.bk-u):not(.bk-c) .mat-calendar-body-cell-content::after { background: #9ca3af; }
    .calendar-card ::ng-deep .bk-c:not(.bk-u):not(.bk-p) .mat-calendar-body-cell-content::after { background: #dc2626; }

    /* Two-status dots (stacked horizontally via box-shadow) */
    .calendar-card ::ng-deep .bk-u.bk-p:not(.bk-c) .mat-calendar-body-cell-content::after {
      background: #3A9FD6; box-shadow: -6px 0 0 #9ca3af;
    }
    .calendar-card ::ng-deep .bk-u.bk-c:not(.bk-p) .mat-calendar-body-cell-content::after {
      background: #3A9FD6; box-shadow: -6px 0 0 #dc2626;
    }
    .calendar-card ::ng-deep .bk-p.bk-c:not(.bk-u) .mat-calendar-body-cell-content::after {
      background: #9ca3af; box-shadow: -6px 0 0 #dc2626;
    }

    /* All three */
    .calendar-card ::ng-deep .bk-u.bk-p.bk-c .mat-calendar-body-cell-content::after {
      background: #9ca3af;
      box-shadow: -6px 0 0 #3A9FD6, 6px 0 0 #dc2626;
    }

    .calendar-legend {
      display: flex; flex-wrap: wrap; gap: 12px;
      padding: 10px 8px 4px;
      border-top: 1px solid #f0f3f7;
      margin-top: 4px;
      font-size: 12px; color: #6b7c93;
    }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .legend-dot {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    }
    .legend-dot.dot-upcoming { background: #3A9FD6; }
    .legend-dot.dot-past { background: #9ca3af; }
    .legend-dot.dot-cancelled { background: #dc2626; }
    .upcoming-header {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 4px 12px;
      border-bottom: 1px solid #f0f3f7;
      h3 { margin: 0; font-size: 15px; color: #1B2A47; font-weight: 600; }
      mat-icon { color: #3A9FD6; }
    }
    .upcoming-loading { display: flex; justify-content: center; padding: 20px 0; }
    .upcoming-empty { color: #6b7c93; text-align: center; padding: 20px 0; margin: 0; font-size: 14px; }
    .upcoming-list { list-style: none; margin: 0; padding: 0; }
    .upcoming-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 4px; border-bottom: 1px solid #f5f7fa;
      &:last-child { border-bottom: none; }
    }
    .upcoming-date {
      display: flex; flex-direction: column; align-items: center;
      background: #f7f9fc; border-radius: 8px; padding: 6px 10px;
      min-width: 44px;
    }
    .upcoming-day { font-size: 18px; font-weight: 700; color: #1B2A47; line-height: 1; }
    .upcoming-month {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
      color: #6b7c93; margin-top: 2px;
    }
    .upcoming-body { flex: 1; min-width: 0; }
    .upcoming-title {
      font-size: 14px; font-weight: 600; color: #1B2A47;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .upcoming-meta { font-size: 12px; color: #6b7c93; margin-top: 2px; }
    .upcoming-type { font-weight: 600; }

    @media (max-width: 1100px) {
      .dashboard-grid { grid-template-columns: 1fr; }
      .side-column { position: static; }
    }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1B2A47; }
      p { margin: 0; color: #6b7c93; }
    }
    .header-actions {
      display: flex; gap: 8px;
    }
    .filter-bar {
      margin-bottom: 12px;
    }
    .filter-field { width: 280px; }
    .et-dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
      margin-right: 6px; vertical-align: middle;
    }
    .loading {
      display: flex; justify-content: center; padding: 60px 0;
    }
    .empty-state {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 12px 0 4px; color: #1B2A47; }
    }

    .booking-table { margin-top: 16px; }
    .table-header {
      display: grid; grid-template-columns: 180px 140px 180px 1fr 100px 80px;
      padding: 12px 16px; background: #f7f9fc; border-radius: 8px 8px 0 0;
      font-size: 13px; font-weight: 600; color: #6b7c93; text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table-row {
      display: grid; grid-template-columns: 180px 140px 180px 1fr 100px 80px;
      padding: 14px 16px; border-bottom: 1px solid #f0f3f7;
      align-items: center; font-size: 14px;
      &:hover { background: #fafbfd; }
    }
    .time-label { color: #6b7c93; font-size: 13px; }
    .email-label { color: #6b7c93; font-size: 13px; }
    .col-actions { display: flex; gap: 4px; justify-content: flex-end; }

    .type-badge {
      display: inline-block; padding: 3px 10px; border-radius: 4px;
      font-size: 13px; color: #1B2A47; background: #f7f9fc;
      border-left: 3px solid #3A9FD6;
    }

    .status-chip {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 12px; font-weight: 600; text-transform: capitalize;
    }
    .status-confirmed { background: #e8f9f2; color: #0f8a5f; }
    .status-cancelled { background: #fef2f2; color: #dc2626; }
    .status-completed { background: #EBF5FB; color: #3A9FD6; }

    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 16px 0;
      span { color: #6b7c93; font-size: 14px; }
    }

    @media (max-width: 768px) {
      .table-header { display: none; }
      .table-row {
        grid-template-columns: 1fr;
        gap: 4px; padding: 16px;
      }
    }
  `],
})
export class BookingDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  loading = signal(true);
  bookings = signal<BookingRecord[]>([]);
  eventTypes = signal<AvailabilityConfig[]>([]);
  activeTab = signal<'upcoming' | 'past' | 'cancelled'>('upcoming');
  currentPage = signal(1);
  totalPages = signal(1);
  selectedEventTypeId = '';

  upcomingEvents = signal<BookingRecord[]>([]);
  upcomingLoading = signal(true);
  selectedDate = signal<Date | null>(new Date());

  private dayMap = signal<Map<string, DayBuckets>>(new Map());

  @ViewChild('calContainer') calContainerRef?: ElementRef<HTMLElement>;
  @ViewChild(MatCalendar) calendar?: MatCalendar<Date>;
  private calSub?: Subscription;

  dateClass: (d: Date) => string[] = this.buildDateClass();

  private buildDateClass(): (d: Date) => string[] {
    return (d: Date): string[] => {
      const info = this.dayMap().get(this.dateKey(d));
      if (!info) return [];
      const classes: string[] = [];
      if (info.upcoming.length) classes.push('bk-u');
      if (info.past.length) classes.push('bk-p');
      if (info.cancelled.length) classes.push('bk-c');
      return classes;
    };
  }

  private readonly tabs: ('upcoming' | 'past' | 'cancelled')[] = ['upcoming', 'past', 'cancelled'];
  private eventTypeMap = new Map<string, AvailabilityConfig>();

  constructor(
    private bookingSvc: BookingService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.bookingSvc.getEventTypes().subscribe({
      next: (types: AvailabilityConfig[]) => {
        this.eventTypes.set(types);
        this.eventTypeMap.clear();
        for (const et of types) {
          if (et._id) this.eventTypeMap.set(et._id, et);
        }
      },
    });
    this.load();
    this.loadCalendarData();
  }

  ngAfterViewInit(): void {
    if (this.calendar) {
      this.calSub = this.calendar.stateChanges.subscribe(() => {
        queueMicrotask(() => this.applyCellTooltips());
      });
    }
    setTimeout(() => this.applyCellTooltips(), 0);
  }

  ngOnDestroy(): void {
    this.calSub?.unsubscribe();
  }

  private dateKey(d: Date | string): string {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  }

  private loadCalendarData(): void {
    this.upcomingLoading.set(true);
    forkJoin({
      upcoming: this.bookingSvc.getBookings('upcoming', 1, 200),
      past: this.bookingSvc.getBookings('past', 1, 200),
      cancelled: this.bookingSvc.getBookings('cancelled', 1, 200),
    }).subscribe({
      next: (res) => {
        const map = new Map<string, DayBuckets>();
        const bucket = (status: keyof DayBuckets, list: BookingRecord[]) => {
          for (const b of list) {
            const key = this.dateKey(b.startTime);
            let entry = map.get(key);
            if (!entry) {
              entry = { upcoming: [], past: [], cancelled: [] };
              map.set(key, entry);
            }
            entry[status].push(b);
          }
        };
        bucket('upcoming', res.upcoming.bookings);
        bucket('past', res.past.bookings);
        bucket('cancelled', res.cancelled.bookings);
        this.dayMap.set(map);

        const sortedUpcoming = [...res.upcoming.bookings].sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        );
        this.upcomingEvents.set(sortedUpcoming.slice(0, 6));
        this.upcomingLoading.set(false);

        // MatMonthView.ngOnChanges doesn't watch dateClass in Material 17,
        // so we explicitly re-init the view via updateTodaysDate() which
        // calls monthView._init() and re-runs dateClass for every cell.
        this.calendar?.updateTodaysDate();
        setTimeout(() => this.applyCellTooltips(), 0);
        setTimeout(() => this.applyCellTooltips(), 80);
      },
      error: () => this.upcomingLoading.set(false),
    });
  }

  private applyCellTooltips(): void {
    const container = this.calContainerRef?.nativeElement;
    if (!container || !this.calendar) return;
    if (this.calendar.currentView !== 'month') return;

    const active = this.calendar.activeDate;
    const year = active.getFullYear();
    const month = active.getMonth();
    const cells = container.querySelectorAll<HTMLElement>('.mat-calendar-body-cell');

    cells.forEach((cell) => {
      const text = cell
        .querySelector<HTMLElement>('.mat-calendar-body-cell-content')
        ?.textContent?.trim();
      const day = text ? parseInt(text, 10) : NaN;
      if (!text || isNaN(day)) { cell.removeAttribute('title'); return; }

      const info = this.dayMap().get(this.dateKey(new Date(year, month, day)));
      if (!info) { cell.removeAttribute('title'); return; }

      const fmt = (b: BookingRecord, label: string) => {
        const t = new Date(b.startTime).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        });
        const type = b.eventTypeName ? ' (' + b.eventTypeName + ')' : '';
        return `[${label}] ${t} — ${b.clientName}${type}`;
      };
      const lines: string[] = [
        ...info.upcoming.map((b) => fmt(b, 'Upcoming')),
        ...info.past.map((b) => fmt(b, 'Past')),
        ...info.cancelled.map((b) => fmt(b, 'Cancelled')),
      ];
      cell.title = lines.join('\n');
    });
  }

  onDateSelected(d: Date | null): void {
    this.selectedDate.set(d);
  }

  eventTypeColor(eventTypeId?: string): string {
    if (!eventTypeId) return '#3A9FD6';
    return this.eventTypeMap.get(eventTypeId)?.color || '#3A9FD6';
  }

  onTabChange(index: number): void {
    this.activeTab.set(this.tabs[index]);
    this.currentPage.set(1);
    this.load();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.bookingSvc.getBookings(
      this.activeTab(),
      this.currentPage(),
      20,
      this.selectedEventTypeId || undefined,
    ).subscribe({
      next: (res) => {
        this.bookings.set(res.bookings);
        this.totalPages.set(res.pages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load bookings', 'OK', { duration: 3000 });
      },
    });
  }

  confirmCancel(booking: BookingRecord): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel Booking',
        message: `Cancel the session with ${booking.clientName}? They will be notified.`,
        confirmLabel: 'Cancel Booking',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.bookingSvc.cancelBooking(booking._id).subscribe({
          next: () => {
            this.snackBar.open('Booking cancelled', 'OK', { duration: 3000 });
            this.load();
            this.loadCalendarData();
          },
          error: () => this.snackBar.open('Failed to cancel', 'OK', { duration: 3000 }),
        });
      }
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      this.load();
    }
  }
}

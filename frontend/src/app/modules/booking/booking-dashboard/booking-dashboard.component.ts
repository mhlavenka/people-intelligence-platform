import { Component, OnInit, signal } from '@angular/core';
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
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { BookingService, BookingRecord, AvailabilityConfig } from '../booking.service';

@Component({
  selector: 'app-booking-dashboard',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatMenuModule,
    MatTooltipModule, MatDialogModule, MatChipsModule,
    MatSelectModule, MatFormFieldModule,
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
      max-width: 1060px; margin: 0 auto; padding: 24px;
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
export class BookingDashboardComponent implements OnInit {
  loading = signal(true);
  bookings = signal<BookingRecord[]>([]);
  eventTypes = signal<AvailabilityConfig[]>([]);
  activeTab = signal<'upcoming' | 'past' | 'cancelled'>('upcoming');
  currentPage = signal(1);
  totalPages = signal(1);
  selectedEventTypeId = '';

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

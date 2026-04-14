import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { ApiService } from '../../../core/api.service';
import {
  CalendarIntegrationService,
  CalendarStatus,
} from '../../coaching/calendar-integration/calendar-integration.service';
import {
  BookingService,
  AvailabilityConfig,
} from '../booking.service';

@Component({
  selector: 'app-booking-settings',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatDividerModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    MatMenuModule, MatDialogModule,
  ],
  template: `
    <div class="settings-container">
      <div class="page-header">
        <div>
          <h1>Event Types</h1>
          <p>Create booking pages for different session types — each with its own link, duration, and schedule.</p>
        </div>
      </div>

      <!-- Public coach landing page -->
      @if (publicCoachUrl()) {
        <div class="public-page-card">
          <mat-icon>storefront</mat-icon>
          <div class="ppc-body">
            <div class="ppc-label">Your public booking page</div>
            <code class="ppc-url">{{ publicCoachUrl() }}</code>
          </div>
          <button mat-icon-button (click)="copyPublicCoachUrl()" matTooltip="Copy link">
            <mat-icon>content_copy</mat-icon>
          </button>
          <a mat-icon-button [href]="publicCoachUrl()" target="_blank" matTooltip="Open">
            <mat-icon>open_in_new</mat-icon>
          </a>
        </div>
      }

      <!-- Calendar connection status -->
      <div class="cal-status-bar" [class.connected]="calendarStatus()?.connected">
        <mat-icon>{{ calendarStatus()?.connected ? 'cloud_done' : 'cloud_off' }}</mat-icon>
        <span>
          Google Calendar: {{ calendarStatus()?.connected ? 'Connected' : 'Not connected' }}
        </span>
        @if (!calendarStatus()?.connected) {
          <button mat-stroked-button (click)="connectCalendar()">
            <mat-icon>link</mat-icon> Connect
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else if (!eventTypes().length) {
        <div class="empty-state">
          <mat-icon>event_note</mat-icon>
          <h3>No event types yet</h3>
          <p>Create your first event type to start accepting bookings.</p>
          <button mat-flat-button color="primary" (click)="createEventType()">
            <mat-icon>add</mat-icon> Create Event Type
          </button>
        </div>
      } @else {
        <div class="event-type-grid">
          @for (et of eventTypes(); track et._id) {
            <div class="event-type-card" [class.inactive]="!et.isActive">
              <div class="card-color-bar" [style.background]="et.color"></div>
              <div class="card-body">
                <div class="card-top">
                  <div class="card-info">
                    <h3>{{ et.name }}</h3>
                    <div class="card-meta">
                      <span><mat-icon>schedule</mat-icon> {{ et.appointmentDuration }} min</span>
                      <span><mat-icon>public</mat-icon> {{ et.timezone }}</span>
                    </div>
                  </div>
                  <button mat-icon-button [matMenuTriggerFor]="menu">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <a mat-menu-item [routerLink]="'/booking/event-types/' + et._id">
                      <mat-icon>edit</mat-icon> Edit
                    </a>
                    <button mat-menu-item (click)="toggleActive(et)">
                      <mat-icon>{{ et.isActive ? 'visibility_off' : 'visibility' }}</mat-icon>
                      {{ et.isActive ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button mat-menu-item (click)="deleteEventType(et)" class="delete-item">
                      <mat-icon>delete</mat-icon> Delete
                    </button>
                  </mat-menu>
                </div>

                @if (et.bookingPageTitle) {
                  <p class="card-desc">{{ et.bookingPageTitle }}</p>
                }

                @if (!et.isActive) {
                  <span class="inactive-badge">Inactive</span>
                }

                <div class="card-footer">
                  <div class="slug-row">
                    <code class="slug-url">/book/{{ et.coachSlug }}</code>
                    <button mat-icon-button (click)="copyLink(et)" matTooltip="Copy link" class="copy-btn">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                  <a mat-stroked-button [routerLink]="'/booking/event-types/' + et._id" class="edit-btn">
                    <mat-icon>settings</mat-icon> Configure
                  </a>
                </div>
              </div>
            </div>
          }
          <button type="button" class="event-type-card new-card" (click)="createEventType()">
            <mat-icon>add</mat-icon>
            <span>New event type</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-container {
      max-width: 90%; margin: 0 auto; padding: 24px;
    }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px;
      h1 { margin: 0 0 4px; font-size: 24px; color: #1B2A47; }
      p { margin: 0; color: #6b7c93; max-width: 500px; }
      button mat-spinner { display: inline-block; margin-right: 8px; }
    }
    .cal-status-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; border-radius: 8px; margin-bottom: 20px;
      background: #fef2f2; color: #b91c1c; font-size: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      button { margin-left: auto; }
      &.connected { background: #f0f9f4; color: #0f8a5f; }
    }
    .loading {
      display: flex; justify-content: center; padding: 60px 0;
    }
    .empty-state {
      text-align: center; padding: 60px 24px; color: #6b7c93;
      background: #fff; border-radius: 12px; border: 1px solid #e8eef4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c8d3df; }
      h3 { margin: 12px 0 4px; color: #1B2A47; }
      button { margin-top: 16px; }
    }

    .event-type-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px;
    }
    .event-type-card {
      background: #fff; border-radius: 12px; border: 1px solid #e8eef4;
      overflow: hidden; transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
      &.inactive { opacity: 0.6; }
    }
    .event-type-card.new-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; min-height: 180px; cursor: pointer;
      border: 2px dashed #c3cfdd; background: #fafbfd; color: #5a6a7e;
      font: inherit; font-size: 14px; font-weight: 500;
      transition: all 0.15s;
      mat-icon {
        font-size: 36px; width: 36px; height: 36px;
        color: #3A9FD6;
      }
      &:hover {
        border-color: #3A9FD6; background: #EBF5FB; color: #1B2A47;
        box-shadow: 0 4px 16px rgba(58,159,214,0.12);
      }
    }
    .card-color-bar { height: 4px; }
    .card-body { padding: 20px; }
    .card-top {
      display: flex; align-items: flex-start; gap: 12px;
    }
    .card-info {
      flex: 1;
      h3 { margin: 0 0 6px; font-size: 17px; color: #1B2A47; }
    }
    .card-meta {
      display: flex; gap: 16px; color: #6b7c93; font-size: 13px;
      span { display: flex; align-items: center; gap: 4px; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .card-desc {
      margin: 10px 0 0; color: #6b7c93; font-size: 14px; line-height: 1.4;
    }
    .inactive-badge {
      display: inline-block; margin-top: 8px;
      padding: 2px 10px; border-radius: 10px;
      background: #fef2f2; color: #dc2626;
      font-size: 12px; font-weight: 600;
    }
    .card-footer {
      margin-top: 16px; padding-top: 14px; border-top: 1px solid #f0f3f7;
      display: flex; align-items: center; justify-content: space-between;
    }
    .slug-row {
      display: flex; align-items: center; gap: 4px;
    }
    .slug-url {
      font-size: 13px; color: #3A9FD6; background: #f7f9fc;
      padding: 4px 8px; border-radius: 4px;
    }
    .copy-btn { transform: scale(0.8); }
    .edit-btn { font-size: 13px; min-width: 130px; white-space: nowrap; }
    .delete-item { color: #dc2626 !important; }

    .public-page-card {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, #EBF5FB, #f0fbf5);
      border: 1px solid #d6ebf7;
      border-radius: 10px; padding: 14px 16px;
      margin-bottom: 12px;
      > mat-icon { color: #3A9FD6; font-size: 26px; width: 26px; height: 26px; }
    }
    .ppc-body { flex: 1; min-width: 0; }
    .ppc-label {
      font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;
      color: #6b7c93; font-weight: 600;
    }
    .ppc-url {
      display: block; font-size: 14px; color: #1B2A47;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    @media (max-width: 600px) {
      .settings-container { padding: 16px; }
      .event-type-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; gap: 12px; align-items: flex-start; }
    }
  `],
})
export class BookingSettingsComponent implements OnInit {
  loading = signal(true);
  creating = signal(false);
  eventTypes = signal<AvailabilityConfig[]>([]);
  calendarStatus = signal<CalendarStatus | null>(null);
  publicCoachUrl = signal<string>('');

  constructor(
    private bookingSvc: BookingService,
    private calendarSvc: CalendarIntegrationService,
    private snackBar: MatSnackBar,
    private clipboard: Clipboard,
    private router: Router,
    private dialog: MatDialog,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading.set(true);

    this.calendarSvc.getStatus().subscribe({
      next: (s) => this.calendarStatus.set(s),
      error: () => this.calendarStatus.set(null),
    });

    this.bookingSvc.getEventTypes().subscribe({
      next: (types: AvailabilityConfig[]) => {
        this.eventTypes.set(types);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.api.post<{ publicSlug: string }>('/users/me/public-slug', {}).subscribe({
      next: ({ publicSlug }) => {
        if (publicSlug) {
          this.publicCoachUrl.set(`${window.location.origin}/c/${publicSlug}`);
        }
      },
      error: () => {},
    });
  }

  copyPublicCoachUrl(): void {
    const url = this.publicCoachUrl();
    if (!url) return;
    this.clipboard.copy(url);
    this.snackBar.open('Public page link copied!', 'OK', { duration: 2000 });
  }

  connectCalendar(): void {
    this.calendarSvc.getAuthUrl().subscribe({
      next: ({ url }) => window.location.href = url,
      error: () => this.snackBar.open('Failed to start Google auth', 'OK', { duration: 3000 }),
    });
  }

  createEventType(): void {
    // Don't persist anything yet — the editor handles "new" mode locally and
    // only POSTs on save. This way Cancel leaves nothing behind.
    this.router.navigate(['/booking/event-types', 'new']);
  }

  toggleActive(et: AvailabilityConfig): void {
    this.bookingSvc.updateEventType(et._id!, { isActive: !et.isActive }).subscribe({
      next: () => {
        this.snackBar.open(et.isActive ? 'Deactivated' : 'Activated', 'OK', { duration: 2000 });
        this.loadAll();
      },
      error: () => this.snackBar.open('Failed to update', 'OK', { duration: 3000 }),
    });
  }

  deleteEventType(et: AvailabilityConfig): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Event Type',
        message: `Delete "${et.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.bookingSvc.deleteEventType(et._id!).subscribe({
          next: () => {
            this.snackBar.open('Event type deleted', 'OK', { duration: 3000 });
            this.loadAll();
          },
          error: (err: { error?: { error?: string } }) => {
            this.snackBar.open(err.error?.error || 'Failed to delete', 'OK', { duration: 4000 });
          },
        });
      }
    });
  }

  copyLink(et: AvailabilityConfig): void {
    this.clipboard.copy(`${window.location.origin}/book/${et.coachSlug}`);
    this.snackBar.open('Link copied!', 'OK', { duration: 2000 });
  }
}

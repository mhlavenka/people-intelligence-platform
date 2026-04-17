import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  CalendarIntegrationService,
  CalendarStatus,
  CalendarItem,
  CalendarProviderType,
} from './calendar-integration.service';

@Component({
  selector: 'app-calendar-integration',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule,
    MatProgressSpinnerModule, MatDividerModule, MatSnackBarModule,
  ],
  template: `
    <div class="card">
      <div class="card-header">
        <mat-icon>calendar_month</mat-icon>
        <div>
          <h2>Calendar Sync</h2>
          <p>Automatically sync coaching sessions to your calendar</p>
        </div>
      </div>
      <mat-divider />
      <div class="card-body">

        @if (loading()) {
          <div class="loading-row"><mat-spinner diameter="24" /></div>
        } @else {

          <!-- State A: Not connected -->
          @if (!status()?.connected) {
            <div class="connect-row">
              <div class="status-icon not-connected">
                <mat-icon>cloud_off</mat-icon>
              </div>
              <div class="info">
                <div class="label">Not connected</div>
                <div class="desc">Connect your calendar to automatically sync coaching sessions.</div>
              </div>
            </div>
            <div class="provider-buttons">
              <button mat-raised-button class="connect-btn google"
                      (click)="connect('google')" [disabled]="connecting()">
                @if (connecting()) {
                  <mat-spinner diameter="18" />
                } @else {
                  <mat-icon>event</mat-icon> Google Calendar
                }
              </button>
              <button mat-raised-button class="connect-btn microsoft"
                      (click)="connect('microsoft')" [disabled]="connecting()">
                @if (connecting()) {
                  <mat-spinner diameter="18" />
                } @else {
                  <mat-icon>calendar_month</mat-icon> Microsoft 365
                }
              </button>
            </div>
          }

          <!-- State B: Connected, no calendar selected -->
          @if (status()?.connected && !status()?.calendarId && !changingCalendar()) {
            <div class="connected-row">
              <div class="status-icon connected">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="info">
                <div class="label">{{ providerLabel() }} Connected <span class="badge">Connected</span></div>
                <div class="desc">Select a calendar to sync sessions to.</div>
              </div>
            </div>
            <div class="calendar-picker">
              @if (calendarsLoading()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-form-field appearance="outline" class="picker-field">
                  <mat-label>Select a calendar</mat-label>
                  <mat-select [(ngModel)]="selectedCalendarId"
                              (ngModelChange)="onCalendarSelected($event)">
                    @for (cal of calendars(); track cal.id) {
                      <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary"
                        (click)="saveCalendar()" [disabled]="!selectedCalendarId || saving()">
                  @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Calendar }
                </button>
              }
            </div>
            <div class="disconnect-link">
              <a (click)="disconnect()">Disconnect calendar</a>
            </div>
          }

          <!-- State B variant: changing calendar -->
          @if (status()?.connected && status()?.calendarId && changingCalendar()) {
            <div class="connected-row">
              <div class="status-icon connected">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="info">
                <div class="label">Change Calendar</div>
                <div class="desc">Select a different calendar to sync sessions to.</div>
              </div>
            </div>
            <div class="calendar-picker">
              @if (calendarsLoading()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-form-field appearance="outline" class="picker-field">
                  <mat-label>Select a calendar</mat-label>
                  <mat-select [(ngModel)]="selectedCalendarId"
                              (ngModelChange)="onCalendarSelected($event)">
                    @for (cal of calendars(); track cal.id) {
                      <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary"
                        (click)="saveCalendar()" [disabled]="!selectedCalendarId || saving()">
                  @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Calendar }
                </button>
                <button mat-button (click)="changingCalendar.set(false)">Cancel</button>
              }
            </div>
          }

          <!-- State C: Fully configured -->
          @if (status()?.connected && status()?.calendarId && !changingCalendar()) {
            <div class="connected-row">
              <div class="status-icon connected">
                <mat-icon>event_available</mat-icon>
              </div>
              <div class="info">
                <div class="label">
                  Syncing to: {{ status()?.calendarName }}
                  <span class="badge">Active</span>
                </div>
                <div class="desc">New sessions will automatically appear in this calendar.</div>
              </div>
            </div>
            <div class="actions-row">
              <a class="action-link" (click)="changeCalendar()">Change calendar</a>
              <a class="action-link disconnect" (click)="disconnect()">Disconnect</a>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }
    .card-header {
      display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px;
      > mat-icon { color: #3A9FD6; margin-top: 2px; flex-shrink: 0; }
      h2 { font-size: 16px; color: #1B2A47; margin: 0 0 2px; font-weight: 600; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
    }
    .card-body { padding: 16px 24px 20px; }

    .loading-row { display: flex; justify-content: center; padding: 20px; }

    .connect-row, .connected-row {
      display: flex; align-items: center; gap: 14px;
    }
    .status-icon {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }
    .status-icon.not-connected { background: rgba(154,165,180,0.12); color: #5a6a7e; }
    .status-icon.connected     { background: rgba(39,196,160,0.12);  color: #1a9678; }

    .info { flex: 1; }
    .label { font-size: 14px; color: #1B2A47; font-weight: 500; }
    .desc  { font-size: 12px; color: #9aa5b4; margin-top: 2px; }

    .badge {
      display: inline-block; margin-left: 8px;
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: rgba(39,196,160,0.15); color: #1a9678;
    }

    .provider-buttons {
      display: flex; gap: 12px; margin-top: 14px; padding-left: 54px; flex-wrap: wrap;
    }
    .connect-btn {
      color: white !important;
      mat-icon { margin-right: 4px; }
      &.google { background: #4285f4 !important; }
      &.microsoft { background: #0078d4 !important; }
    }

    .calendar-picker {
      display: flex; align-items: center; gap: 12px;
      margin-top: 16px; padding-left: 54px;
    }
    .picker-field { flex: 1; margin-bottom: -1.25em; }

    .actions-row {
      display: flex; gap: 16px; margin-top: 12px; padding-left: 54px;
    }
    .action-link {
      font-size: 13px; cursor: pointer; text-decoration: none;
      color: #3A9FD6;
      &:hover { text-decoration: underline; }
      &.disconnect { color: #dc2626; }
    }

    .disconnect-link {
      margin-top: 12px; padding-left: 54px;
      a { font-size: 12px; color: #dc2626; cursor: pointer; &:hover { text-decoration: underline; } }
    }
  `],
})
export class CalendarIntegrationComponent implements OnInit {
  loading = signal(true);
  connecting = signal(false);
  calendarsLoading = signal(false);
  saving = signal(false);
  changingCalendar = signal(false);

  status = signal<CalendarStatus | null>(null);
  calendars = signal<CalendarItem[]>([]);
  selectedCalendarId = '';
  private selectedCalendarName = '';

  constructor(
    private calService: CalendarIntegrationService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.calService.getStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
        // Auto-load calendars if connected but no calendar selected
        if (s.connected && !s.calendarId) {
          this.loadCalendars();
        }
      },
      error: () => this.loading.set(false),
    });
  }

  providerLabel(): string {
    const p = this.status()?.provider;
    return p === 'microsoft' ? 'Microsoft 365' : 'Google Calendar';
  }

  connect(provider: CalendarProviderType = 'google'): void {
    this.connecting.set(true);
    this.calService.getAuthUrl(provider).subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: () => {
        this.connecting.set(false);
        this.snack.open('Failed to start calendar connection', 'Dismiss', { duration: 4000 });
      },
    });
  }

  loadCalendars(): void {
    this.calendarsLoading.set(true);
    this.calService.listCalendars().subscribe({
      next: (cals) => {
        this.calendars.set(cals);
        this.calendarsLoading.set(false);
      },
      error: () => {
        this.calendarsLoading.set(false);
        this.snack.open('Failed to load calendars', 'Dismiss', { duration: 4000 });
      },
    });
  }

  onCalendarSelected(calId: string): void {
    const cal = this.calendars().find((c) => c.id === calId);
    this.selectedCalendarName = cal?.summary ?? calId;
  }

  saveCalendar(): void {
    if (!this.selectedCalendarId) return;
    this.saving.set(true);
    this.calService.selectCalendar(this.selectedCalendarId, this.selectedCalendarName).subscribe({
      next: () => {
        this.saving.set(false);
        this.changingCalendar.set(false);
        this.snack.open('Calendar saved', undefined, { duration: 2000 });
        this.loadStatus();
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to save calendar', 'Dismiss', { duration: 4000 });
      },
    });
  }

  changeCalendar(): void {
    this.changingCalendar.set(true);
    this.loadCalendars();
  }

  disconnect(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: `Disconnect ${this.providerLabel()}`,
        message: `This will stop syncing new sessions to ${this.providerLabel()}. Existing calendar events will remain.`,
        confirmLabel: 'Disconnect',
        confirmColor: 'warn',
        icon: 'link_off',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.calService.disconnect().subscribe({
        next: () => {
          this.snack.open('Calendar disconnected', undefined, { duration: 2000 });
          this.changingCalendar.set(false);
          this.loadStatus();
        },
        error: () => this.snack.open('Failed to disconnect', 'Dismiss', { duration: 4000 }),
      });
    });
  }
}

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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    TranslateModule,
  ],
  template: `
    <div class="card">
      <div class="card-header">
        <mat-icon>calendar_month</mat-icon>
        <div>
          <h2>{{ 'COACHING.calendarSync' | translate }}</h2>
          <p>{{ 'COACHING.calendarSyncDesc' | translate }}</p>
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
                <div class="label">{{ 'COACHING.notConnected' | translate }}</div>
                <div class="desc">{{ 'COACHING.connectCalDesc' | translate }}</div>
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
                <div class="label">{{ providerLabel() }} {{ 'BOOKING.connected' | translate }} <span class="badge">{{ 'BOOKING.connected' | translate }}</span></div>
                <div class="desc">{{ 'COACHING.selectCalendarDesc' | translate }}</div>
              </div>
            </div>
            <div class="calendar-picker">
              @if (calendarsLoading()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-form-field appearance="outline" class="picker-field">
                  <mat-label>{{ 'COACHING.selectCoachCalendar' | translate }}</mat-label>
                  <mat-select [(ngModel)]="selectedCalendarId"
                              (ngModelChange)="onCalendarSelected($event)">
                    @for (cal of calendars(); track cal.id) {
                      <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary"
                        (click)="saveCalendar()" [disabled]="!selectedCalendarId || saving()">
                  @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ 'COACHING.saveCalendar' | translate }} }
                </button>
              }
            </div>
            <div class="disconnect-link">
              <a (click)="disconnect()">{{ 'COACHING.disconnectCalendar' | translate }}</a>
            </div>
          }

          <!-- State B variant: changing calendar -->
          @if (status()?.connected && status()?.calendarId && changingCalendar()) {
            <div class="connected-row">
              <div class="status-icon connected">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="info">
                <div class="label">{{ 'COACHING.changeCalendar' | translate }}</div>
                <div class="desc">{{ 'COACHING.selectCalendarDesc' | translate }}</div>
              </div>
            </div>
            <div class="calendar-picker">
              @if (calendarsLoading()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-form-field appearance="outline" class="picker-field">
                  <mat-label>{{ 'COACHING.selectCoachCalendar' | translate }}</mat-label>
                  <mat-select [(ngModel)]="selectedCalendarId"
                              (ngModelChange)="onCalendarSelected($event)">
                    @for (cal of calendars(); track cal.id) {
                      <mat-option [value]="cal.id">{{ cal.summary }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary"
                        (click)="saveCalendar()" [disabled]="!selectedCalendarId || saving()">
                  @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ 'COACHING.saveCalendar' | translate }} }
                </button>
                <button mat-button (click)="changingCalendar.set(false)">{{ 'COMMON.cancel' | translate }}</button>
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
                  {{ 'COACHING.syncingTo' | translate }} {{ status()?.calendarName }}
                  <span class="badge">{{ 'COMMON.active' | translate }}</span>
                </div>
                <div class="desc">{{ 'COACHING.newSessionsAutoAppear' | translate }}</div>
              </div>
            </div>
            <div class="actions-row">
              <a class="action-link" (click)="changeCalendar()">{{ 'COACHING.changeCalendar' | translate }}</a>
              <a class="action-link disconnect" (click)="disconnect()">{{ 'BOOKING.disconnect' | translate }}</a>
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
      > mat-icon { color: var(--artes-accent); margin-top: 2px; flex-shrink: 0; }
      h2 { font-size: 16px; color: var(--artes-primary); margin: 0 0 2px; font-weight: 600; }
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
    .label { font-size: 14px; color: var(--artes-primary); font-weight: 500; }
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
      color: var(--artes-accent);
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
    private translate: TranslateService,
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
        this.snack.open(this.translate.instant('COACHING.failedStartConnection'), this.translate.instant('COMMON.dismiss'), { duration: 4000 });
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
        this.snack.open(this.translate.instant('COACHING.failedLoadCalendars'), this.translate.instant('COMMON.dismiss'), { duration: 4000 });
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
        this.snack.open(this.translate.instant('COACHING.calendarSaved'), undefined, { duration: 2000 });
        this.loadStatus();
      },
      error: () => {
        this.saving.set(false);
        this.snack.open(this.translate.instant('COACHING.failedSaveCalendar'), this.translate.instant('COMMON.dismiss'), { duration: 4000 });
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
        title: this.translate.instant('COACHING.disconnectProvider', { provider: this.providerLabel() }),
        message: this.translate.instant('COACHING.disconnectProviderMsg', { provider: this.providerLabel() }),
        confirmLabel: this.translate.instant('BOOKING.disconnect'),
        confirmColor: 'warn',
        icon: 'link_off',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.calService.disconnect().subscribe({
        next: () => {
          this.snack.open(this.translate.instant('COACHING.calendarDisconnected'), undefined, { duration: 2000 });
          this.changingCalendar.set(false);
          this.loadStatus();
        },
        error: () => this.snack.open(this.translate.instant('COACHING.failedDisconnect'), this.translate.instant('COMMON.dismiss'), { duration: 4000 }),
      });
    });
  }
}

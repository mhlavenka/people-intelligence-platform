import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';

interface LoginSessionItem {
  _id: string;
  device: string;
  ip: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-login-sessions-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatDividerModule, MatTooltipModule, TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'PROFILE.activeSessions' | translate }}</h2>

    <mat-dialog-content>
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="32"></mat-spinner></div>
      } @else if (sessions().length === 0) {
        <p class="empty">{{ 'SESSIONS.noActiveFound' | translate }}</p>
      } @else {
        <div class="session-list">
          @for (session of sessions(); track session._id) {
            <div class="session-row" [class.current]="session.isCurrent">
              <mat-icon class="device-icon">
                {{ session.device.includes('Mobile') ? 'phone_android' : 'computer' }}
              </mat-icon>
              <div class="session-info">
                <div class="device-name">
                  {{ session.device }}
                  @if (session.isCurrent) {
                    <span class="current-badge">{{ 'SESSIONS.current' | translate }}</span>
                  }
                </div>
                <div class="session-meta">
                  {{ session.ip || ('SESSIONS.unknownIp' | translate) }} &middot;
                  {{ 'SESSIONS.lastActivePrefix' | translate }} {{ session.lastActiveAt | date:'short' }}
                </div>
              </div>
              @if (!session.isCurrent) {
                <button mat-icon-button color="warn"
                  [matTooltip]="'SESSIONS.revokeThisSession' | translate"
                  (click)="revokeSession(session._id)"
                  [disabled]="revoking() === session._id">
                  @if (revoking() === session._id) {
                    <mat-spinner diameter="18"></mat-spinner>
                  } @else {
                    <mat-icon>close</mat-icon>
                  }
                </button>
              }
            </div>
            <mat-divider />
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (sessions().length > 1) {
        <button mat-stroked-button color="warn" (click)="revokeAll()" [disabled]="revokingAll()">
          @if (revokingAll()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            {{ 'SESSIONS.revokeAllOthers' | translate }}
          }
        </button>
      }
      <button mat-button mat-dialog-close>{{ 'COMMON.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .loading-center { display: flex; justify-content: center; padding: 24px; }
    .empty { text-align: center; color: #8fa4c0; padding: 24px; }
    .session-list { min-width: 360px; }
    .session-row {
      display: flex;
      align-items: center;
      padding: 12px 0;
      gap: 12px;
    }
    .session-row.current { background: #f0f9f4; border-radius: 8px; padding: 12px; margin: 0 -12px; }
    .device-icon { color: #5a6a7e; }
    .session-info { flex: 1; }
    .device-name { font-weight: 500; font-size: 14px; }
    .session-meta { font-size: 12px; color: #8fa4c0; margin-top: 2px; }
    .current-badge {
      display: inline-block;
      background: #27C4A0;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      vertical-align: middle;
    }
  `],
})
export class LoginSessionsDialogComponent implements OnInit {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef);

  sessions = signal<LoginSessionItem[]>([]);
  loading = signal(true);
  revoking = signal<string | null>(null);
  revokingAll = signal(false);

  ngOnInit() {
    this.loadSessions();
  }

  revokeSession(id: string) {
    this.revoking.set(id);
    this.api.delete(`/auth/sessions/${id}`).subscribe({
      next: () => {
        this.sessions.update((list) => list.filter((s) => s._id !== id));
        this.revoking.set(null);
      },
      error: () => this.revoking.set(null),
    });
  }

  revokeAll() {
    this.revokingAll.set(true);
    this.api.delete('/auth/sessions').subscribe({
      next: () => {
        this.sessions.update((list) => list.filter((s) => s.isCurrent));
        this.revokingAll.set(false);
      },
      error: () => this.revokingAll.set(false),
    });
  }

  private loadSessions() {
    this.loading.set(true);
    this.api.get<LoginSessionItem[]>('/auth/sessions').subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';

interface OrgLoginSession {
  _id: string;
  user: { _id: string; firstName: string; lastName: string; email: string; role: string };
  device: string;
  ip: string;
  lastActiveAt: string;
  createdAt: string;
}

@Component({
  selector: 'app-login-sessions-admin',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, TranslateModule,
  ],
  template: `
    <div class="sessions-page">
    <div class="page-header">
      <div class="header-row">
        <h2>
          <mat-icon>devices</mat-icon>
          Active Login Sessions
        </h2>
        <div class="header-actions">
          <button mat-stroked-button (click)="loadSessions()" [disabled]="loading()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-stroked-button color="warn" (click)="cleanStale()" [disabled]="cleaning()">
            @if (cleaning()) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <mat-icon>cleaning_services</mat-icon> Clean Stale
            }
          </button>
        </div>
      </div>
      <p class="subtitle">All active sessions across the organization. Revoke sessions to force re-authentication. Stale = inactive for 1+ hour.</p>
    </div>

    @if (loading()) {
      <div class="loading-center"><mat-spinner diameter="32"></mat-spinner></div>
    } @else if (sessions().length === 0) {
      <p class="empty">No active sessions.</p>
    } @else {
      <table mat-table [dataSource]="sessions()" class="sessions-table">
        <ng-container matColumnDef="user">
          <th mat-header-cell *matHeaderCellDef>User</th>
          <td mat-cell *matCellDef="let s">
            <div class="user-cell">
              <strong>
                {{ s.user.firstName }} {{ s.user.lastName }}
                @if (isMe(s)) {
                  <span class="you-badge">You</span>
                }
              </strong>
              <span class="email">{{ s.user.email }}</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="device">
          <th mat-header-cell *matHeaderCellDef>Device</th>
          <td mat-cell *matCellDef="let s">{{ s.device }}</td>
        </ng-container>

        <ng-container matColumnDef="ip">
          <th mat-header-cell *matHeaderCellDef>IP</th>
          <td mat-cell *matCellDef="let s">{{ s.ip || '—' }}</td>
        </ng-container>

        <ng-container matColumnDef="lastActive">
          <th mat-header-cell *matHeaderCellDef>Last Active</th>
          <td mat-cell *matCellDef="let s">{{ s.lastActiveAt | date:'short' }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let s">
            @if (!isMe(s)) {
              <button mat-icon-button color="warn" matTooltip="Revoke session" (click)="revoke(s._id)">
                <mat-icon>block</mat-icon>
              </button>
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    }
    </div>
  `,
  styles: [`
    .sessions-page { padding: 32px; width: 100%; max-width: 100%; box-sizing: border-box; }
    .page-header { margin-bottom: 24px; }
    .header-row { display: flex; align-items: center; justify-content: space-between; }
    .header-actions { display: flex; gap: 8px; }
    .page-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    .subtitle { color: #8fa4c0; font-size: 14px; margin: 4px 0 0; }
    .loading-center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; color: #8fa4c0; padding: 48px; }
    .sessions-table { width: 100%; }
    .user-cell { display: flex; flex-direction: column; }
    .email { font-size: 12px; color: #8fa4c0; }
    .you-badge {
      display: inline-block; background: #3A9FD6; color: #fff;
      font-size: 10px; font-weight: 600; padding: 2px 6px;
      border-radius: 4px; margin-left: 6px; vertical-align: middle;
    }
  `],
})
export class LoginSessionsAdminComponent implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private auth = inject(AuthService);

  sessions = signal<OrgLoginSession[]>([]);
  loading = signal(true);
  cleaning = signal(false);
  displayedColumns = ['user', 'device', 'ip', 'lastActive', 'actions'];

  ngOnInit() {
    this.loadSessions();
  }

  isMe(session: OrgLoginSession): boolean {
    return session.user._id === this.auth.currentUser()?.id;
  }

  cleanStale() {
    this.cleaning.set(true);
    this.api.delete<{ message: string }>('/auth/sessions/org/stale').subscribe({
      next: (res) => {
        this.cleaning.set(false);
        this.snackBar.open(res.message, 'OK', { duration: 3000 });
        this.loadSessions();
      },
      error: () => {
        this.cleaning.set(false);
        this.snackBar.open('Failed to clean stale sessions', 'OK', { duration: 3000 });
      },
    });
  }

  revoke(id: string) {
    this.api.delete(`/auth/sessions/org/${id}`).subscribe({
      next: () => {
        this.sessions.update((list) => list.filter((s) => s._id !== id));
        this.snackBar.open('Session revoked', 'OK', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to revoke session', 'OK', { duration: 3000 }),
    });
  }

  loadSessions() {
    this.loading.set(true);
    this.api.get<OrgLoginSession[]>('/auth/sessions/org').subscribe({
      next: (sessions) => { this.sessions.set(sessions); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}

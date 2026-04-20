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
    <div class="page-header">
      <h2>
        <mat-icon>devices</mat-icon>
        Active Login Sessions
      </h2>
      <p class="subtitle">All active sessions across the organization. Revoke sessions to force users to re-authenticate.</p>
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
              <strong>{{ s.user.firstName }} {{ s.user.lastName }}</strong>
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
            <button mat-icon-button color="warn" matTooltip="Revoke session" (click)="revoke(s._id)">
              <mat-icon>block</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
    .subtitle { color: #8fa4c0; font-size: 14px; margin: 4px 0 0; }
    .loading-center { display: flex; justify-content: center; padding: 48px; }
    .empty { text-align: center; color: #8fa4c0; padding: 48px; }
    .sessions-table { width: 100%; }
    .user-cell { display: flex; flex-direction: column; }
    .email { font-size: 12px; color: #8fa4c0; }
  `],
})
export class LoginSessionsAdminComponent implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  sessions = signal<OrgLoginSession[]>([]);
  loading = signal(true);
  displayedColumns = ['user', 'device', 'ip', 'lastActive', 'actions'];

  ngOnInit() {
    this.loadSessions();
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

  private loadSessions() {
    this.loading.set(true);
    this.api.get<OrgLoginSession[]>('/auth/sessions/org').subscribe({
      next: (sessions) => { this.sessions.set(sessions); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { EngagementDialogComponent } from '../engagement-dialog/engagement-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

interface DashboardStats {
  activeEngagements: number;
  totalEngagements: number;
  completedSessions: number;
  totalHours: number;
  upcomingSessions: number;
  byStatus: Record<string, number>;
}

interface Engagement {
  _id: string;
  coacheeId: { _id: string; firstName: string; lastName: string; email: string; department?: string } | string;
  coachId: { _id: string; firstName: string; lastName: string } | string;
  status: string;
  sessionsPurchased: number;
  sessionsUsed: number;
  goals: string[];
  startDate?: string;
  targetEndDate?: string;
  cadence?: string;
  sponsorName?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  prospect:   { label: 'Prospect',   color: '#9aa5b4', icon: 'person_search' },
  contracted: { label: 'Contracted', color: '#3A9FD6', icon: 'handshake' },
  active:     { label: 'Active',     color: '#27C4A0', icon: 'play_circle' },
  paused:     { label: 'Paused',     color: '#f0a500', icon: 'pause_circle' },
  completed:  { label: 'Completed',  color: '#1a9678', icon: 'check_circle' },
  alumni:     { label: 'Alumni',     color: '#7c5cbf', icon: 'school' },
};

@Component({
  selector: 'app-coaching-dashboard',
  standalone: true,
  imports: [
    CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule, MatMenuModule,
  ],
  template: `
    <div class="coaching-page">
      <div class="page-header">
        <div>
          <h1>Coaching</h1>
          <p>Manage coaching engagements and sessions</p>
        </div>
        @if (canManage()) {
          <button mat-raised-button color="primary" (click)="createEngagement()">
            <mat-icon>add</mat-icon> New Engagement
          </button>
        }
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {

        <!-- Stats -->
        <div class="stats-row">
          <div class="stat-card"><div class="stat-num">{{ stats()?.activeEngagements ?? 0 }}</div><div class="stat-label">Active</div></div>
          <div class="stat-card"><div class="stat-num">{{ stats()?.completedSessions ?? 0 }}</div><div class="stat-label">Sessions</div></div>
          <div class="stat-card"><div class="stat-num">{{ stats()?.totalHours ?? 0 }}h</div><div class="stat-label">Hours</div></div>
          <div class="stat-card"><div class="stat-num">{{ stats()?.upcomingSessions ?? 0 }}</div><div class="stat-label">Upcoming</div></div>
          <div class="stat-card"><div class="stat-num">{{ stats()?.totalEngagements ?? 0 }}</div><div class="stat-label">Total</div></div>
        </div>

        <!-- Engagements -->
        @if (engagements().length === 0) {
          <div class="empty-state">
            <mat-icon>psychology_alt</mat-icon>
            <h3>No coaching engagements yet</h3>
            <p>Create your first coaching engagement to get started.</p>
          </div>
        } @else {
          <div class="engagements-grid">
            @for (eng of engagements(); track eng._id) {
              <div class="engagement-card" [routerLink]="'/coaching/' + eng._id">
                <div class="eng-header">
                  <span class="status-chip" [style.background]="statusConfig(eng.status).color + '18'"
                        [style.color]="statusConfig(eng.status).color">
                    <mat-icon>{{ statusConfig(eng.status).icon }}</mat-icon>
                    {{ statusConfig(eng.status).label }}
                  </span>
                  <span class="eng-sessions">{{ eng.sessionsUsed }} / {{ eng.sessionsPurchased }} sessions</span>
                  @if (canManage()) {
                    <button mat-icon-button [matMenuTriggerFor]="engMenu" (click)="$event.stopPropagation(); $event.preventDefault()">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #engMenu="matMenu">
                      <button mat-menu-item (click)="editEngagement(eng)"><mat-icon>edit</mat-icon> Edit</button>
                      <button mat-menu-item class="delete-item" (click)="deleteEngagement(eng)"><mat-icon>delete</mat-icon> Delete</button>
                    </mat-menu>
                  }
                </div>

                <div class="eng-coachee">
                  @if (isPopulated(eng.coacheeId)) {
                    <div class="coachee-avatar">{{ eng.coacheeId.firstName[0] }}{{ eng.coacheeId.lastName[0] }}</div>
                    <div class="coachee-info">
                      <strong>{{ eng.coacheeId.firstName }} {{ eng.coacheeId.lastName }}</strong>
                      <span>{{ eng.coacheeId.email }}</span>
                      @if (eng.coacheeId.department) { <span>{{ eng.coacheeId.department }}</span> }
                    </div>
                  }
                </div>

                @if (eng.goals.length > 0) {
                  <div class="eng-goals">
                    @for (g of eng.goals.slice(0, 2); track g) {
                      <span class="goal-chip">{{ g }}</span>
                    }
                    @if (eng.goals.length > 2) { <span class="goal-more">+{{ eng.goals.length - 2 }}</span> }
                  </div>
                }

                <div class="eng-meta">
                  @if (eng.cadence) { <span><mat-icon>schedule</mat-icon> {{ eng.cadence }}</span> }
                  @if (eng.startDate) { <span><mat-icon>event</mat-icon> {{ eng.startDate | date:'MMM d, y' }}</span> }
                  @if (eng.sponsorName) { <span><mat-icon>business</mat-icon> {{ eng.sponsorName }}</span> }
                </div>

                <!-- Session progress bar -->
                <div class="progress-bar-wrap">
                  <div class="progress-bar" [style.width.%]="eng.sessionsPurchased ? (eng.sessionsUsed / eng.sessionsPurchased) * 100 : 0"></div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .coaching-page { padding: 32px; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card {
      background: white; border-radius: 12px; padding: 16px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      .stat-num { font-size: 28px; font-weight: 700; color: #1B2A47; }
      .stat-label { font-size: 12px; color: #5a6a7e; margin-top: 2px; }
    }

    .engagements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }

    .engagement-card {
      background: white; border-radius: 14px; padding: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); cursor: pointer;
      transition: box-shadow 0.15s, transform 0.15s;
      display: flex; flex-direction: column; gap: 12px;
      text-decoration: none; color: inherit;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-1px); }
    }

    .eng-header { display: flex; align-items: center; gap: 8px; }
    .status-chip {
      display: flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .eng-sessions { margin-left: auto; font-size: 12px; color: #5a6a7e; }

    .eng-coachee { display: flex; align-items: center; gap: 12px; }
    .coachee-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .coachee-info {
      display: flex; flex-direction: column; gap: 1px; min-width: 0;
      strong { font-size: 14px; color: #1B2A47; }
      span { font-size: 12px; color: #9aa5b4; }
    }

    .eng-goals { display: flex; gap: 6px; flex-wrap: wrap; }
    .goal-chip { font-size: 11px; background: #EBF5FB; color: #3A9FD6; padding: 2px 8px; border-radius: 4px; }
    .goal-more { font-size: 11px; color: #9aa5b4; }

    .eng-meta {
      display: flex; gap: 12px; flex-wrap: wrap;
      span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #5a6a7e; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
    }

    .progress-bar-wrap { background: #e8edf4; border-radius: 3px; height: 4px; overflow: hidden; }
    .progress-bar { height: 100%; background: #27C4A0; border-radius: 3px; transition: width 0.3s; }

    ::ng-deep .delete-item { color: #dc2626 !important; mat-icon { color: #dc2626 !important; } }

    @media (max-width: 768px) { .engagements-grid { grid-template-columns: 1fr; } }
  `],
})
export class CoachingDashboardComponent implements OnInit {
  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  engagements = signal<Engagement[]>([]);

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
  ) {}

  canManage = () => ['admin', 'hr_manager', 'coach'].includes(this.auth.currentUser()?.role ?? '');

  isPopulated(c: Engagement['coacheeId']): c is { _id: string; firstName: string; lastName: string; email: string; department?: string } {
    return typeof c === 'object' && c !== null;
  }

  statusConfig(status: string) { return STATUS_CONFIG[status] || STATUS_CONFIG['prospect']; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    Promise.all([
      this.api.get<DashboardStats>('/coaching/dashboard').toPromise(),
      this.api.get<Engagement[]>('/coaching/engagements').toPromise(),
    ]).then(([stats, engagements]) => {
      this.stats.set(stats!);
      this.engagements.set(engagements!);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  createEngagement(): void {
    const ref = this.dialog.open(EngagementDialogComponent, { data: null, minWidth: '560px', maxHeight: '92vh' });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  editEngagement(eng: Engagement): void {
    const ref = this.dialog.open(EngagementDialogComponent, { data: eng, minWidth: '560px', maxHeight: '92vh' });
    ref.afterClosed().subscribe((r) => { if (r) this.load(); });
  }

  deleteEngagement(eng: Engagement): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: { title: 'Delete Engagement', message: 'Delete this engagement and all its sessions? This cannot be undone.', confirmLabel: 'Delete', confirmColor: 'warn', icon: 'delete_forever' },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/coaching/engagements/${eng._id}`).subscribe({ next: () => this.load() });
    });
  }
}

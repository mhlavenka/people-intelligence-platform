import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
  coacheeId: { _id: string; firstName: string; lastName: string; email: string; department?: string; profilePicture?: string } | string;
  coachId: { _id: string; firstName: string; lastName: string; email?: string; profilePicture?: string } | string;
  status: string;
  sessionsPurchased: number;
  sessionsUsed: number;
  goals: string[];
  startDate?: string;
  targetEndDate?: string;
  cadence?: string;
  sponsorId?: { _id: string; name: string; email: string } | string | null;
  billingMode?: 'sponsor' | 'subscription';
  createdAt: string;
}

interface CalSession {
  _id: string;
  engagementId: string;
  coacheeId: { firstName: string; lastName: string } | string;
  date: string;
  duration: number;
  format: string;
  status: string;
  topics: string[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessions: CalSession[];
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

        <div class="main-layout">
          <!-- Left: Engagements -->
          <div class="engagements-col">
            @if (engagements().length === 0 && !canManage()) {
              <div class="empty-state">
                <mat-icon>psychology_alt</mat-icon>
                <h3>No coaching engagements yet</h3>
                <p>You'll see your engagements here once your coach sets one up.</p>
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
                      @if (isCoachee()) {
                        <!-- Coachees see their coach on each engagement card -->
                        @if (isPopulatedCoach(eng.coachId)) {
                          @if (eng.coachId.profilePicture) {
                            <img class="coachee-avatar coachee-avatar-img" [src]="eng.coachId.profilePicture" alt="" />
                          } @else {
                            <div class="coachee-avatar">{{ eng.coachId.firstName[0] }}{{ eng.coachId.lastName[0] }}</div>
                          }
                          <div class="coachee-info">
                            <strong>{{ eng.coachId.firstName }} {{ eng.coachId.lastName }}</strong>
                            @if (eng.coachId.email) { <span>{{ eng.coachId.email }}</span> }
                            <span class="role-label">Your coach</span>
                          </div>
                        }
                      } @else {
                        <!-- Coaches / admins / HR see the coachee -->
                        @if (isPopulated(eng.coacheeId)) {
                          @if (eng.coacheeId.profilePicture) {
                            <img class="coachee-avatar coachee-avatar-img" [src]="eng.coacheeId.profilePicture" alt="" />
                          } @else {
                            <div class="coachee-avatar">{{ eng.coacheeId.firstName[0] }}{{ eng.coacheeId.lastName[0] }}</div>
                          }
                          <div class="coachee-info">
                            <strong>{{ eng.coacheeId.firstName }} {{ eng.coacheeId.lastName }}</strong>
                            <span>{{ eng.coacheeId.email }}</span>
                            @if (eng.coacheeId.department) { <span>{{ eng.coacheeId.department }}</span> }
                          </div>
                        }
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
                      @if (sponsorName(eng)) { <span><mat-icon>business</mat-icon> {{ sponsorName(eng) }}</span> }
                    </div>

                    <div class="progress-bar-wrap">
                      <div class="progress-bar" [style.width.%]="eng.sessionsPurchased ? (eng.sessionsUsed / eng.sessionsPurchased) * 100 : 0"></div>
                    </div>
                  </div>
                }
                @if (canManage()) {
                  <button class="engagement-card add-card" (click)="createEngagement()" type="button">
                    <mat-icon class="add-icon">add</mat-icon>
                    <span class="add-label">New engagement</span>
                  </button>
                }
              </div>
            }
          </div>

          <!-- Right: Calendar -->
          @if (canManage()) {
            <div class="calendar-col">
              <div class="cal-card">
                <div class="cal-header">
                  <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
                  <span class="cal-month">{{ monthLabel() }}</span>
                  <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
                </div>
                <div class="cal-grid">
                  @for (d of dayHeaders; track d) {
                    <div class="cal-day-header">{{ d }}</div>
                  }
                  @for (day of calendarDays(); track day.date.toISOString()) {
                    <div class="cal-cell" [class.other]="!day.isCurrentMonth" [class.today]="day.isToday">
                      <span class="cal-num">{{ day.date.getDate() }}</span>
                      @for (s of day.sessions.slice(0, 2); track s._id) {
                        <a class="cal-event" [class]="s.status"
                           [matTooltip]="sessionTooltip(s)"
                           [routerLink]="'/coaching/' + s.engagementId">
                          <span class="cal-event-name">{{ coacheeName(s.coacheeId) }}</span>
                        </a>
                      }
                      @if (day.sessions.length > 2) {
                        <span class="cal-more">+{{ day.sessions.length - 2 }}</span>
                      }
                    </div>
                  }
                </div>

                <!-- Upcoming sessions list -->
                @if (upcomingSessions().length > 0) {
                  <div class="cal-upcoming">
                    <h4>Upcoming</h4>
                    @for (s of upcomingSessions(); track s._id) {
                      <a class="upcoming-item" [routerLink]="'/coaching/' + s.engagementId">
                        <span class="upcoming-date">{{ s.date | date:'MMM d' }}</span>
                        <span class="upcoming-time">{{ s.date | date:'h:mm a' }}</span>
                        <span class="upcoming-name">{{ coacheeName(s.coacheeId) }}</span>
                        <span class="upcoming-dur">{{ s.duration }}m</span>
                      </a>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .coaching-page { padding: 32px; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin-bottom: 24px; }

    .main-layout { display: grid; grid-template-columns: 1fr 450px; gap: 24px; align-items: start; }
    .stat-card {
      background: white; border-radius: 12px; padding: 16px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      .stat-num { font-size: 28px; font-weight: 700; color: var(--artes-primary); }
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

    .add-card {
      background: transparent;
      border: 2px dashed #c8d3df;
      box-shadow: none;
      align-items: center; justify-content: center;
      min-height: 200px;
      color: #6b7c93;
      font: inherit; gap: 6px;
      &:hover {
        border-color: var(--artes-accent); color: var(--artes-accent);
        box-shadow: none; transform: translateY(-1px); background: rgba(58,159,214,0.04);
      }
      .add-icon { font-size: 36px; width: 36px; height: 36px; }
      .add-label { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
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
      background: linear-gradient(135deg, var(--artes-accent), #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .coachee-avatar-img { object-fit: cover; background: none; }
    .coachee-info {
      display: flex; flex-direction: column; gap: 1px; min-width: 0;
      strong { font-size: 14px; color: var(--artes-primary); }
      span { font-size: 12px; color: #9aa5b4; }
      .role-label {
        text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
        color: var(--artes-accent); font-size: 10px; margin-top: 2px;
      }
    }

    .eng-goals { display: flex; gap: 6px; flex-wrap: wrap; }
    .goal-chip { font-size: 11px; background: var(--artes-bg); color: var(--artes-accent); padding: 2px 8px; border-radius: 4px; }
    .goal-more { font-size: 11px; color: #9aa5b4; }

    .eng-meta {
      display: flex; gap: 12px; flex-wrap: wrap;
      span { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #5a6a7e; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
    }

    .progress-bar-wrap { background: #e8edf4; border-radius: 3px; height: 4px; overflow: hidden; }
    .progress-bar { height: 100%; background: #27C4A0; border-radius: 3px; transition: width 0.3s; }

    ::ng-deep .delete-item { color: #dc2626 !important; mat-icon { color: #dc2626 !important; } }

    /* Calendar sidebar */
    .cal-card {
      background: white; border-radius: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      padding: 12px; position: sticky; top: 24px;
    }
    .cal-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
      .cal-month { font-size: 14px; font-weight: 600; color: var(--artes-primary); }
    }
    .cal-grid {
      display: grid; grid-template-columns: repeat(7, 1fr);
      border: 1px solid #f0f4f8; border-radius: 8px; overflow: hidden;
    }
    .cal-day-header {
      text-align: center; font-size: 9px; font-weight: 600; color: #9aa5b4;
      padding: 4px 0; background: #f8fafc; border-bottom: 1px solid #f0f4f8;
    }
    .cal-cell {
      min-height: 64px; padding: 2px; border-right: 1px solid #f0f4f8; border-bottom: 1px solid #f0f4f8;
      display: flex; flex-direction: column; gap: 1px;
      &:nth-child(7n) { border-right: none; }
      &.other { background: #fafbfc; .cal-num { color: #d1d5db; } }
      &.today { background: #f0f9ff; .cal-num { background: var(--artes-accent); color: white; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; } }
    }
    .cal-num { font-size: 10px; color: #5a6a7e; margin-bottom: 1px; }
    .cal-event {
      display: block; font-size: 9px; padding: 1px 3px; border-radius: 3px;
      text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      border-left: 2px solid transparent;
      &.completed { background: #e8faf4; color: #1a9678; border-left-color: #27C4A0; }
      &.scheduled { background: var(--artes-bg); color: #2080b0; border-left-color: var(--artes-accent); }
      &.cancelled { background: #f0f4f8; color: #9aa5b4; border-left-color: #c5d0db; }
      &.no_show { background: #fef2f2; color: #c53030; border-left-color: #e53e3e; }
    }
    .cal-event-name { }
    .cal-more { font-size: 8px; color: #9aa5b4; }

    .cal-upcoming {
      margin-top: 12px; border-top: 1px solid #f0f4f8; padding-top: 12px;
      h4 { font-size: 12px; font-weight: 600; color: var(--artes-primary); margin: 0 0 8px; }
    }
    .upcoming-item {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px;
      text-decoration: none; font-size: 12px; transition: background 0.15s;
      &:hover { background: #f8fafc; }
    }
    .upcoming-date { font-weight: 600; color: var(--artes-primary); min-width: 48px; }
    .upcoming-time { color: var(--artes-accent); min-width: 56px; }
    .upcoming-name { flex: 1; color: #5a6a7e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .upcoming-dur { color: #9aa5b4; font-size: 11px; }

    @media (max-width: 1024px) { .main-layout { grid-template-columns: 1fr; } .cal-card { position: static; } }
    @media (max-width: 768px) { .engagements-grid { grid-template-columns: 1fr; } }
  `],
})
export class CoachingDashboardComponent implements OnInit {
  loading = signal(true);
  stats = signal<DashboardStats | null>(null);
  engagements = signal<Engagement[]>([]);
  sessions = signal<CalSession[]>([]);
  currentMonth = signal(new Date());

  dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  monthLabel = computed(() => this.currentMonth().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  calendarDays = computed<CalendarDay[]>(() => {
    const month = this.currentMonth();
    const y = month.getFullYear(), m = month.getMonth();
    const today = new Date();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: CalendarDay[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(y, m, -i), isCurrentMonth: false, isToday: false, sessions: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const daySessions = this.sessions().filter((s) => new Date(s.date).toDateString() === date.toDateString());
      days.push({ date, isCurrentMonth: true, isToday: date.toDateString() === today.toDateString(), sessions: daySessions });
    }
    while (days.length < 42) {
      days.push({ date: new Date(y, m + 1, days.length - daysInMonth - firstDay + 1), isCurrentMonth: false, isToday: false, sessions: [] });
    }
    return days;
  });

  upcomingSessions = computed(() => {
    const now = new Date();
    return this.sessions()
      .filter((s) => s.status === 'scheduled' && new Date(s.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  });

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private router: Router,
  ) {}

  canManage = () => ['admin', 'hr_manager', 'coach'].includes(this.auth.currentUser()?.role ?? '');
  isCoachee = () => this.auth.currentUser()?.role === 'coachee';

  isPopulated(c: Engagement['coacheeId']): c is { _id: string; firstName: string; lastName: string; email: string; department?: string; profilePicture?: string } {
    return typeof c === 'object' && c !== null;
  }
  isPopulatedCoach(c: Engagement['coachId']): c is { _id: string; firstName: string; lastName: string; email?: string; profilePicture?: string } {
    return typeof c === 'object' && c !== null;
  }

  sponsorName(eng: Engagement): string {
    const s = eng.sponsorId;
    if (s && typeof s === 'object' && 'name' in s) return s.name;
    return '';
  }

  statusConfig(status: string) { return STATUS_CONFIG[status] || STATUS_CONFIG['prospect']; }

  ngOnInit(): void { this.load(); }

  prevMonth(): void { const d = new Date(this.currentMonth()); d.setMonth(d.getMonth() - 1); this.currentMonth.set(d); }
  nextMonth(): void { const d = new Date(this.currentMonth()); d.setMonth(d.getMonth() + 1); this.currentMonth.set(d); }

  coacheeName(c: CalSession['coacheeId']): string {
    return typeof c === 'object' && c ? `${c.firstName} ${c.lastName}` : 'Unknown';
  }

  sessionTooltip(s: CalSession): string {
    return `${this.coacheeName(s.coacheeId)} · ${s.duration}min ${s.format} · ${s.status}`;
  }

  load(): void {
    this.loading.set(true);

    // Coachees: redirect to their single engagement; otherwise show the
    // list with stats. Stats and sessions load alongside engagements so
    // the dashboard cards aren't all zeros.
    if (this.auth.currentUser()?.role === 'coachee') {
      this.api.get<DashboardStats>('/coaching/dashboard').subscribe({
        next: (s) => this.stats.set(s),
        error: (err) => console.error('[Coaching] Failed to load dashboard stats (coachee):', err),
      });
      this.api.get<CalSession[]>('/coaching/sessions').subscribe({
        next: (s) => this.sessions.set(s),
        error: (err) => console.error('[Coaching] Failed to load sessions (coachee):', err),
      });
      this.api.get<Engagement[]>('/coaching/engagements').subscribe({
        next: (engs) => {
          if (engs.length === 1) {
            this.router.navigate(['/coaching', engs[0]._id], { replaceUrl: true });
          } else {
            this.engagements.set(engs);
            this.loading.set(false);
          }
        },
        error: (err) => {
          console.error('[Coaching] Failed to load engagements (coachee):', err);
          this.loading.set(false);
        },
      });
      return;
    }

    // Independent fires so one failed call doesn't blank the others.
    this.api.get<DashboardStats>('/coaching/dashboard').subscribe({
      next: (s) => this.stats.set(s),
      error: (err) => console.error('[Coaching] Failed to load dashboard stats:', err),
    });
    this.api.get<Engagement[]>('/coaching/engagements').subscribe({
      next: (e) => {
        console.info('[Coaching] engagements loaded:', e.length);
        this.engagements.set(e);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[Coaching] Failed to load engagements:', err);
        this.loading.set(false);
      },
    });
    this.api.get<CalSession[]>('/coaching/sessions').subscribe({
      next: (s) => this.sessions.set(s),
      error: (err) => console.error('[Coaching] Failed to load sessions:', err),
    });
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

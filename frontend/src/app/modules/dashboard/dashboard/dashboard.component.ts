import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { AuthService, AppRole } from '../../../core/auth.service';
import { OrgContextService } from '../../../core/org-context.service';
import { BookingService, BookingRecord } from '../../booking/booking.service';

interface DashboardStats {
  conflict:       { value: number | null; label: string };
  neuroinclusion: { value: number | null; label: string };
  succession:     { value: number | null; label: string };
  surveys:        { responses: number; activeSurveys: number };
}

interface ModuleCard {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
  metric: string | null;
  metricLabel: string;
  status: 'active' | 'warning' | 'inactive';
  module?: string;        // org subscription module key required
  roles?: AppRole[];      // user roles allowed (undefined = all)
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, MatProgressSpinnerModule, MatTooltipModule, DatePipe],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1>Organization Dashboard</h1>
          <p>Welcome back, {{ firstName() }}. Here's your organization health overview.</p>
        </div>
        <div class="header-actions">
          <span class="last-updated">Updated just now</span>
        </div>
      </div>

      <!-- Module cards -->
      <div class="module-grid">
        @for (card of visibleCards(); track card.route) {
          <div class="module-card" [class]="'module-card--' + card.status" [routerLink]="card.route">
            <div class="card-header">
              <div class="card-icon" [style.background]="card.color">
                <mat-icon>{{ card.icon }}</mat-icon>
              </div>
              <span class="status-dot" [class]="card.status"></span>
            </div>
            <div class="card-body">
              <h3>{{ card.title }}</h3>
              <p>{{ card.subtitle }}</p>
            </div>
            <div class="card-metric">
              @if (card.metric !== null) {
                <span class="metric-value">{{ card.metric }}</span>
                <span class="metric-label">{{ card.metricLabel }}</span>
              } @else {
                <span class="metric-value metric-none">—</span>
                <span class="metric-label">no data yet</span>
              }
            </div>
            <div class="card-footer">
              <button mat-button color="primary">Open →</button>
            </div>
          </div>
        }
      </div>

      @if (visibleCards().length === 0 && orgCtx.loaded()) {
        <div class="empty-state">
          <mat-icon>dashboard_customize</mat-icon>
          <h3>No modules available</h3>
          <p>Your subscription does not include any modules, or your role does not have access. Contact your administrator.</p>
        </div>
      }

      <!-- Upcoming events -->
      @if (showUpcoming()) {
        <div class="section-card">
          <div class="section-header">
            <h2><mat-icon class="sh-icon">event</mat-icon> Upcoming events</h2>
            <a mat-button color="primary" routerLink="/booking">View all</a>
          </div>
          @if (upcomingLoading()) {
            <div class="upcoming-loading"><mat-spinner diameter="28" /></div>
          } @else if (!upcomingEvents().length) {
            <div class="upcoming-empty">
              <mat-icon>event_available</mat-icon>
              <span>No upcoming sessions.</span>
            </div>
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
                      <span class="upcoming-type">{{ b.eventTypeName || 'Session' }}</span>
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
      }
    </div>
  `,
  styles: [`
    .dashboard-page { padding: 32px; height: calc(100vh - 64px); display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
      .last-updated { font-size: 12px; color: #9aa5b4; }
    }

    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 28px;
    }

    .module-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      border: 2px solid transparent;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .card-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { color: white; font-size: 24px; }
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        &.active   { background: #27C4A0; }
        &.warning  { background: #f0a500; }
        &.inactive { background: #9aa5b4; }
      }

      h3 { font-size: 16px; color: #1B2A47; margin: 0 0 4px; }
      p  { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }

      .card-metric {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 16px;
        .metric-value { font-size: 32px; font-weight: 700; color: #1B2A47; }
        .metric-value.metric-none { color: #9aa5b4; }
        .metric-label { font-size: 13px; color: #9aa5b4; }
      }

      .card-footer button { font-weight: 600; color: #3A9FD6; }
    }

    .module-card--warning { border-color: rgba(240, 165, 0, 0.3); }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 48px; gap: 12px; text-align: center;
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 28px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c5d0db; }
      h3 { font-size: 18px; color: #1B2A47; margin: 0; }
      p  { font-size: 14px; color: #9aa5b4; margin: 0; max-width: 400px; }
    }

    .section-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
      h2 { font-size: 18px; color: #1B2A47; margin: 0; display: flex; align-items: center; gap: 8px; }
      .sh-icon { color: #3A9FD6; font-size: 22px; width: 22px; height: 22px; }
    }

    .upcoming-loading { display: flex; justify-content: center; padding: 28px; }
    .upcoming-empty {
      display: flex; align-items: center; gap: 10px;
      padding: 24px; color: #9aa5b4; font-size: 14px;
      mat-icon { font-size: 22px; width: 22px; height: 22px; color: #c8d3df; }
    }
    .upcoming-list {
      list-style: none; margin: 0; padding: 0;
      flex: 1; min-height: 0; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: #d1d5db transparent;
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    }
    .upcoming-item {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 4px;
      border-bottom: 1px solid #f0f4f8;
      &:last-child { border-bottom: none; }
    }
    .upcoming-date {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 48px; padding: 6px 4px; border-radius: 8px;
      background: #EBF5FB; color: #1B2A47;
      .upcoming-day   { font-size: 18px; font-weight: 700; line-height: 1; }
      .upcoming-month { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; color: #3A9FD6; }
    }
    .upcoming-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .upcoming-title { font-size: 14px; font-weight: 600; color: #1B2A47;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .upcoming-meta { font-size: 12px; color: #5a6a7e; }
    .upcoming-type { color: #3A9FD6; font-weight: 500; }
  `],
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private api = inject(ApiService);
  private bookingSvc = inject(BookingService);
  orgCtx = inject(OrgContextService);

  firstName = signal('');
  upcomingEvents = signal<BookingRecord[]>([]);
  upcomingLoading = signal(true);
  /** Upcoming events are meaningful for anyone who can have bookings
   *  (everyone except coachees, who already see their own sessions
   *  elsewhere). The backend returns coach-scoped bookings, so admins /
   *  HR see their own — typically empty and that's fine. */
  showUpcoming = computed(() => {
    const role = this.authService.currentUser()?.role;
    return !!role && role !== 'coachee';
  });
  moduleCards = signal<ModuleCard[]>(this.defaultCards());

  /** Module cards filtered by org subscription + user role. */
  visibleCards = computed(() => {
    const cards = this.moduleCards();
    const modules = this.orgCtx.modules();
    const role = this.authService.currentUser()?.role;
    if (!role) return [];

    return cards.filter((card) => {
      if (card.module && !modules.includes(card.module)) return false;
      if (card.roles && !card.roles.includes(role)) return false;
      return true;
    });
  });


  private defaultCards(): ModuleCard[] {
    return [
      {
        title: 'Conflict Intelligence\u2122',
        subtitle: 'Workplace conflict detection and mediation escalation',
        icon: 'warning_amber',
        color: 'linear-gradient(135deg, #e86c3a, #e53e3e)',
        route: '/conflict',
        metric: null,
        metricLabel: 'active analyses',
        status: 'active',
        module: 'conflict',
        roles: ['admin', 'hr_manager', 'manager', 'coach'],
      },
      {
        title: 'Neuro-Inclusion Compass\u2122',
        subtitle: 'Organizational neuroinclusion maturity assessment',
        icon: 'psychology',
        color: 'linear-gradient(135deg, #27C4A0, #1a9678)',
        route: '/neuroinclusion',
        metric: null,
        metricLabel: 'avg maturity score',
        status: 'active',
        module: 'neuroinclusion',
        roles: ['admin', 'hr_manager', 'manager'],
      },
      {
        title: 'Leadership & Succession Hub\u2122',
        subtitle: 'AI-generated IDPs and succession planning',
        icon: 'trending_up',
        color: 'linear-gradient(135deg, #3A9FD6, #2080b0)',
        route: '/succession',
        metric: null,
        metricLabel: 'active IDPs',
        status: 'active',
        module: 'succession',
        roles: ['admin', 'hr_manager', 'coach', 'coachee'],
      },
      {
        title: 'Coaching',
        subtitle: 'Manage coaching engagements and sessions',
        icon: 'psychology_alt',
        color: 'linear-gradient(135deg, #7c5cbf, #5a3ea0)',
        route: '/coaching',
        metric: null,
        metricLabel: 'active engagements',
        status: 'active',
        module: 'coaching',
        roles: ['admin', 'hr_manager', 'coach', 'coachee'],
      },
      {
        title: 'Intakes',
        subtitle: 'Active intake templates and responses collected',
        icon: 'assignment',
        color: 'linear-gradient(135deg, #9aa5b4, #5a6a7e)',
        route: '/intakes',
        metric: null,
        metricLabel: 'responses collected',
        status: 'active',
        roles: ['admin', 'hr_manager', 'coach'],
      },
    ];
  }

  private applyStats(stats: DashboardStats): void {
    this.moduleCards.update((cards) => cards.map((card) => {
      if (card.route === '/conflict') {
        const v = stats.conflict.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.conflict.label, status: (v && v > 0 ? 'warning' : 'active') as ModuleCard['status'] };
      }
      if (card.route === '/neuroinclusion') {
        const v = stats.neuroinclusion.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.neuroinclusion.label };
      }
      if (card.route === '/succession') {
        const v = stats.succession.value;
        return { ...card, metric: v !== null ? String(v) : null, metricLabel: stats.succession.label };
      }
      if (card.route === '/intakes') {
        const { responses, activeSurveys } = stats.surveys;
        return { ...card, metric: String(activeSurveys), metricLabel: `active intakes \u00b7 ${responses} responses` };
      }
      return card;
    }));
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) this.firstName.set(user.firstName);

    if (this.showUpcoming()) {
      this.bookingSvc.getBookings('upcoming', 1, 10).subscribe({
        next: (res) => {
          const sorted = [...res.bookings].sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          );
          this.upcomingEvents.set(sorted.slice(0, 8));
          this.upcomingLoading.set(false);
        },
        error: () => this.upcomingLoading.set(false),
      });
    }

    this.api.get<DashboardStats>('/dashboard/stats').subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {},
    });
  }
}

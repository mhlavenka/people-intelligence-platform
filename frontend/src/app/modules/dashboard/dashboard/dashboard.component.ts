import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';

interface DashboardStats {
  conflict:       { value: number | null; label: string };
  neuroinclusion: { value: number | null; label: string };
  succession:     { value: number | null; label: string };
  surveys:        { responses: number; activeSurveys: number };
}

interface ActivityItem {
  type: 'survey_response' | 'conflict_analysis' | 'idp' | 'neuroinclusion';
  label: string;
  detail: string;
  createdAt: string;
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
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, MatProgressSpinnerModule, DatePipe],
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
        @for (card of moduleCards(); track card.route) {
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
              <button mat-button color="primary">Open Module →</button>
            </div>
          </div>
        }
      </div>

      <!-- Recent activity -->
      <div class="section-card">
        <h2>Recent Activity</h2>
        @if (activityLoading()) {
          <div class="activity-loading"><mat-spinner diameter="28" /></div>
        } @else if (activity().length === 0) {
          <div class="activity-empty">
            <mat-icon>history</mat-icon>
            <span>No activity yet. Activity will appear here as your team uses the platform.</span>
          </div>
        } @else {
          <div class="activity-list">
            @for (item of activity(); track item.createdAt) {
              <div class="activity-item">
                <mat-icon class="activity-icon" [class]="activityIconClass(item.type)">{{ activityIcon(item.type) }}</mat-icon>
                <div class="activity-content">
                  <strong>{{ item.label }}</strong>
                  <span>{{ item.detail }}</span>
                </div>
                <span class="activity-time">{{ item.createdAt | date:'MMM d, h:mm a' }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page { padding: 32px; }

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
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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

    .section-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      h2 { font-size: 18px; color: #1B2A47; margin-bottom: 20px; }
    }

    .activity-loading { display: flex; justify-content: center; padding: 32px; }

    .activity-empty {
      display: flex; align-items: center; gap: 10px;
      padding: 24px; color: #9aa5b4; font-size: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .activity-list { display: flex; flex-direction: column; gap: 16px; }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      background: #f8fafc;

      .activity-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        &.conflict      { color: #e86c3a; background: rgba(232, 108, 58, 0.1); }
        &.succession    { color: #3A9FD6; background: rgba(58, 159, 214, 0.1); }
        &.neuroinclusion{ color: #27C4A0; background: rgba(39, 196, 160, 0.1); }
      }

      .activity-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        strong { font-size: 14px; color: #1B2A47; }
        span   { font-size: 12px; color: #5a6a7e; }
      }

      .activity-time { font-size: 12px; color: #9aa5b4; white-space: nowrap; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  firstName = signal('');
  activity = signal<ActivityItem[]>([]);
  activityLoading = signal(true);
  moduleCards = signal<ModuleCard[]>(this.defaultCards());

  activityIcon(type: ActivityItem['type']): string {
    const map: Record<ActivityItem['type'], string> = {
      survey_response:   'assignment_turned_in',
      conflict_analysis: 'warning_amber',
      idp:               'trending_up',
      neuroinclusion:    'psychology',
    };
    return map[type];
  }

  activityIconClass(type: ActivityItem['type']): string {
    const map: Record<ActivityItem['type'], string> = {
      survey_response:   'conflict',
      conflict_analysis: 'conflict',
      idp:               'succession',
      neuroinclusion:    'neuroinclusion',
    };
    return map[type];
  }

  private defaultCards(): ModuleCard[] {
    return [
      {
        title: 'Conflict Intelligence™',
        subtitle: 'Workplace conflict detection and mediation escalation',
        icon: 'warning_amber',
        color: 'linear-gradient(135deg, #e86c3a, #e53e3e)',
        route: '/conflict',
        metric: null,
        metricLabel: 'active analyses',
        status: 'active',
      },
      {
        title: 'Neuro-Inclusion Compass™',
        subtitle: 'Organizational neuroinclusion maturity assessment',
        icon: 'psychology',
        color: 'linear-gradient(135deg, #27C4A0, #1a9678)',
        route: '/neuroinclusion',
        metric: null,
        metricLabel: 'avg maturity score',
        status: 'active',
      },
      {
        title: 'Leadership & Succession Hub™',
        subtitle: 'AI-generated IDPs and succession planning',
        icon: 'trending_up',
        color: 'linear-gradient(135deg, #3A9FD6, #2080b0)',
        route: '/succession',
        metric: null,
        metricLabel: 'active IDPs',
        status: 'active',
      },
      {
        title: 'Intakes',
        subtitle: 'Active intake templates and responses collected',
        icon: 'assignment',
        color: 'linear-gradient(135deg, #7c5cbf, #5a3ea0)',
        route: '/intakes',
        metric: null,
        metricLabel: 'responses collected',
        status: 'active',
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
        return { ...card, metric: String(activeSurveys), metricLabel: `active intakes · ${responses} responses` };
      }
      return card;
    }));
  }

  constructor(private authService: AuthService, private api: ApiService) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) this.firstName.set(user.firstName);

    this.api.get<ActivityItem[]>('/dashboard/activity').subscribe({
      next: (items) => { this.activity.set(items); this.activityLoading.set(false); },
      error: () => this.activityLoading.set(false),
    });

    this.api.get<DashboardStats>('/dashboard/stats').subscribe({
      next: (stats) => this.applyStats(stats),
      error: () => {},
    });
  }
}

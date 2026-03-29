import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';

interface ModuleCard {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
  metric: string;
  metricLabel: string;
  status: 'active' | 'warning' | 'inactive';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule],
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
        @for (card of moduleCards; track card.route) {
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
              <span class="metric-value">{{ card.metric }}</span>
              <span class="metric-label">{{ card.metricLabel }}</span>
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
        <div class="activity-list">
          <div class="activity-item">
            <mat-icon class="activity-icon conflict">warning_amber</mat-icon>
            <div class="activity-content">
              <strong>Conflict Analysis completed</strong>
              <span>Engineering department — Risk score: 62 (Medium)</span>
            </div>
            <span class="activity-time">2 hours ago</span>
          </div>
          <div class="activity-item">
            <mat-icon class="activity-icon succession">trending_up</mat-icon>
            <div class="activity-content">
              <strong>IDP generated</strong>
              <span>Sarah M. — Leadership development plan created</span>
            </div>
            <span class="activity-time">Yesterday</span>
          </div>
          <div class="activity-item">
            <mat-icon class="activity-icon neuroinclusion">psychology</mat-icon>
            <div class="activity-content">
              <strong>Neuroinclusion assessment submitted</strong>
              <span>HR Manager role — Maturity score: 71/100</span>
            </div>
            <span class="activity-time">3 days ago</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page { padding: 32px; max-width: 1200px; }

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

  moduleCards: ModuleCard[] = [
    {
      title: 'Conflict Intelligence™',
      subtitle: 'Workplace conflict detection and mediation escalation',
      icon: 'warning_amber',
      color: 'linear-gradient(135deg, #e86c3a, #e53e3e)',
      route: '/conflict',
      metric: '3',
      metricLabel: 'active analyses',
      status: 'warning',
    },
    {
      title: 'Neuro-Inclusion Compass™',
      subtitle: 'Organizational neuroinclusion maturity assessment',
      icon: 'psychology',
      color: 'linear-gradient(135deg, #27C4A0, #1a9678)',
      route: '/neuroinclusion',
      metric: '71',
      metricLabel: 'maturity score',
      status: 'active',
    },
    {
      title: 'Leadership & Succession Hub™',
      subtitle: 'AI-generated IDPs and succession planning',
      icon: 'trending_up',
      color: 'linear-gradient(135deg, #3A9FD6, #2080b0)',
      route: '/succession',
      metric: '8',
      metricLabel: 'active IDPs',
      status: 'active',
    },
  ];

  constructor(private authService: AuthService, private api: ApiService) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) this.firstName.set(user.firstName);
  }
}

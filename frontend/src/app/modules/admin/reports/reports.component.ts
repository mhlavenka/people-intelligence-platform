import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

interface EngagementReport {
  users: { total: number; active: number; recentLogins: number };
  activity: Record<string, number>;
  roleBreakdown: Record<string, number>;
  deptBreakdown: { department: string; count: number }[];
}

interface ConflictReport {
  total: number;
  avgRiskScore: number;
  byLevel: Record<string, number>;
  byDepartment: Record<string, { count: number; avgScore: number }>;
  escalated: number;
  trend: { period: string; avgScore: number; count: number }[];
}

interface IdpReport {
  total: number;
  byStatus: Record<string, number>;
  milestones: { total: number; completed: number; rate: number };
  plans: { coachee: any; goal: string; status: string; sourceModule: string; milestonesDone: number; milestonesTotal: number; createdAt: string }[];
}

interface SurveyReport {
  totalResponses: number;
  activeTemplates: number;
  templates: { title: string; moduleType: string; responseCount: number }[];
  trend: { period: string; count: number }[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', hr_manager: 'HR Manager', manager: 'Manager', coach: 'Coach', coachee: 'Employee',
};

@Component({
  selector: 'app-org-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDividerModule, MatTooltipModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Reports</h1>
          <p>Organization analytics, engagement metrics, and module activity</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {

        <!-- Engagement -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>groups</mat-icon>
            <div>
              <h2>Team Engagement</h2>
              <p>User activity and login trends</p>
            </div>
          </div>
          @if (engagement()) {
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.total }}</div><div class="stat-label">Total Users</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.active }}</div><div class="stat-label">Active</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.recentLogins }}</div><div class="stat-label">Logged in (30d)</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['surveyResponses'] }}</div><div class="stat-label">Survey Responses</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['conflictAnalyses'] }}</div><div class="stat-label">Analyses</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['journalEntries'] }}</div><div class="stat-label">Journal Entries</div></div>
            </div>
            <div class="breakdown-row">
              <div class="breakdown-col">
                <h4>By Role</h4>
                @for (entry of objectEntries(engagement()!.roleBreakdown); track entry[0]) {
                  <div class="breakdown-item">
                    <span class="breakdown-key">{{ roleLabel(entry[0]) }}</span>
                    <span class="breakdown-val">{{ entry[1] }}</span>
                  </div>
                }
              </div>
              <div class="breakdown-col">
                <h4>By Department</h4>
                @if (engagement()!.deptBreakdown.length === 0) {
                  <div class="breakdown-empty">No department data</div>
                } @else {
                  @for (d of engagement()!.deptBreakdown; track d.department) {
                    <div class="breakdown-item">
                      <span class="breakdown-key">{{ d.department }}</span>
                      <span class="breakdown-val">{{ d.count }}</span>
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>

        <!-- Conflict Risk -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>warning_amber</mat-icon>
            <div>
              <h2>Conflict Risk Overview</h2>
              <p>Risk distribution, department breakdown, and trends</p>
            </div>
            @if (conflict()) {
              <span class="report-total" [style.color]="riskColor(conflict()!.avgRiskScore)">Avg: {{ conflict()!.avgRiskScore }}/100</span>
            }
          </div>
          @if (conflict()) {
            <div class="stats-grid">
              <div class="stat-box low"><div class="stat-num">{{ conflict()!.byLevel['low'] || 0 }}</div><div class="stat-label">Low</div></div>
              <div class="stat-box medium"><div class="stat-num">{{ conflict()!.byLevel['medium'] || 0 }}</div><div class="stat-label">Medium</div></div>
              <div class="stat-box high"><div class="stat-num">{{ conflict()!.byLevel['high'] || 0 }}</div><div class="stat-label">High</div></div>
              <div class="stat-box critical"><div class="stat-num">{{ conflict()!.byLevel['critical'] || 0 }}</div><div class="stat-label">Critical</div></div>
              <div class="stat-box"><div class="stat-num">{{ conflict()!.escalated }}</div><div class="stat-label">Escalated</div></div>
              <div class="stat-box"><div class="stat-num">{{ conflict()!.total }}</div><div class="stat-label">Total Analyses</div></div>
            </div>

            @if (conflict()!.trend.length > 0) {
              <h4>Monthly Risk Trend</h4>
              <div class="bar-chart">
                @for (item of conflict()!.trend; track item.period) {
                  <div class="bar-col" [matTooltip]="'Avg: ' + item.avgScore + '/100 (' + item.count + ' analyses)'">
                    <div class="bar" [style.height.%]="item.avgScore" [style.background]="riskColor(item.avgScore)"></div>
                    <div class="bar-label">{{ item.period | slice:5 }}</div>
                  </div>
                }
              </div>
            }
          }
        </div>

        <!-- IDP Progress -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>trending_up</mat-icon>
            <div>
              <h2>Development Plan Progress</h2>
              <p>IDP status, milestone completion, and individual progress</p>
            </div>
          </div>
          @if (idpReport()) {
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.total }}</div><div class="stat-label">Total Plans</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.byStatus['active'] || 0 }}</div><div class="stat-label">Active</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.byStatus['completed'] || 0 }}</div><div class="stat-label">Completed</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.milestones.rate }}%</div><div class="stat-label">Milestone Rate</div><div class="stat-sub">{{ idpReport()!.milestones.completed }}/{{ idpReport()!.milestones.total }}</div></div>
            </div>

            @if (idpReport()!.plans.length > 0) {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Goal</th>
                    <th>Module</th>
                    <th>Status</th>
                    <th>Milestones</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of idpReport()!.plans; track p.goal) {
                    <tr>
                      <td>{{ p.coachee?.firstName }} {{ p.coachee?.lastName }}</td>
                      <td class="goal-cell">{{ p.goal | slice:0:60 }}</td>
                      <td><span class="module-chip">{{ p.sourceModule }}</span></td>
                      <td><span class="status-chip" [class]="p.status">{{ p.status }}</span></td>
                      <td>{{ p.milestonesDone }}/{{ p.milestonesTotal }}</td>
                      <td>{{ p.createdAt | date:'MMM d' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>

        <!-- Survey Activity -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>assignment</mat-icon>
            <div>
              <h2>Survey & Intake Activity</h2>
              <p>Template usage and response trends</p>
            </div>
            @if (survey()) {
              <span class="report-total">{{ survey()!.totalResponses }} responses</span>
            }
          </div>
          @if (survey()) {
            @if (survey()!.templates.length > 0) {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Module</th>
                    <th>Responses</th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of survey()!.templates; track t.title) {
                    <tr>
                      <td>{{ t.title }}</td>
                      <td><span class="module-chip">{{ t.moduleType }}</span></td>
                      <td class="amount">{{ t.responseCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 1100px; }
    .report-card { background: white; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); padding: 24px; margin-bottom: 24px; }
    .report-header {
      display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px;
      mat-icon { font-size: 24px; color: #3A9FD6; margin-top: 2px; }
      h2 { font-size: 18px; color: #1B2A47; margin: 0 0 2px; font-weight: 700; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
      .report-total { margin-left: auto; font-size: 16px; font-weight: 700; color: #27C4A0; }
    }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-box {
      background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;
      .stat-num { font-size: 28px; font-weight: 700; color: #1B2A47; }
      .stat-label { font-size: 12px; color: #5a6a7e; margin-top: 2px; }
      .stat-sub { font-size: 11px; color: #9aa5b4; }
      &.low .stat-num { color: #27C4A0; }
      &.medium .stat-num { color: #f0a500; }
      &.high .stat-num { color: #e86c3a; }
      &.critical .stat-num { color: #e53e3e; }
    }

    .breakdown-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .breakdown-col { h4 { font-size: 13px; font-weight: 600; color: #1B2A47; margin: 0 0 10px; } }
    .breakdown-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f4f8; font-size: 13px; }
    .breakdown-key { color: #5a6a7e; }
    .breakdown-val { font-weight: 600; color: #1B2A47; }
    .breakdown-empty { font-size: 13px; color: #9aa5b4; }

    .bar-chart { display: flex; gap: 6px; align-items: flex-end; height: 140px; padding: 0 8px; margin-top: 12px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .bar { width: 100%; max-width: 36px; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
    .bar-label { font-size: 10px; color: #9aa5b4; margin-top: 6px; }

    .data-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #1B2A47; font-weight: 600; font-size: 12px; border-bottom: 2px solid #edf2f7; }
      td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; color: #374151; }
      tr:hover td { background: #fafbfc; }
      .amount { font-weight: 600; text-align: right; }
      .goal-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .module-chip { font-size: 10px; background: #EBF5FB; color: #3A9FD6; padding: 2px 8px; border-radius: 4px; text-transform: capitalize; }
    .status-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px;
      &.draft { background: #f0f4f8; color: #9aa5b4; }
      &.active { background: #EBF5FB; color: #3A9FD6; }
      &.completed { background: #e8faf4; color: #27C4A0; }
    }
    h4 { font-size: 14px; color: #1B2A47; margin: 16px 0 8px; }
  `],
})
export class OrgReportsComponent implements OnInit {
  loading = signal(true);
  engagement = signal<EngagementReport | null>(null);
  conflict = signal<ConflictReport | null>(null);
  idpReport = signal<IdpReport | null>(null);
  survey = signal<SurveyReport | null>(null);

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    Promise.all([
      this.api.get<EngagementReport>('/reports/org/engagement').toPromise(),
      this.api.get<ConflictReport>('/reports/org/conflict-risk').toPromise(),
      this.api.get<IdpReport>('/reports/org/idp-progress').toPromise(),
      this.api.get<SurveyReport>('/reports/org/survey-activity').toPromise(),
    ]).then(([eng, conf, idp, surv]) => {
      this.engagement.set(eng!);
      this.conflict.set(conf!);
      this.idpReport.set(idp!);
      this.survey.set(surv!);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  roleLabel(key: string): string { return ROLE_LABELS[key] || key; }

  riskColor(score: number): string {
    if (score <= 25) return '#27C4A0';
    if (score <= 50) return '#f0a500';
    if (score <= 75) return '#e86c3a';
    return '#e53e3e';
  }

  objectEntries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj);
  }
}

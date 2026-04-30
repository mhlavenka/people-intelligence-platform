import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { TranslateModule } from '@ngx-translate/core';

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
  trendByDepartment?: Array<{
    department: string;
    points: { period: string; avgScore: number; count: number }[];
  }>;
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
  admin: 'Admin', hr_manager: 'HR Manager', manager: 'Manager', coach: 'Coach', coachee: 'Coachee',
};

@Component({
  selector: 'app-org-reports',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDividerModule, MatTooltipModule,
    TranslateModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ "ADMIN.reports" | translate }}</h1>
          <p>{{ "ADMIN.reportsDesc" | translate }}</p>
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
              <h2>{{ "ADMIN.teamEngagement" | translate }}</h2>
              <p>{{ "ADMIN.teamEngagementDesc" | translate }}</p>
            </div>
          </div>
          @if (engagement()) {
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.total }}</div><div class="stat-label">{{ 'ADMIN.totalUsers' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.active }}</div><div class="stat-label">{{ 'ADMIN.activeUsers' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.users.recentLogins }}</div><div class="stat-label">{{ 'ADMIN.recentLogins' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['surveyResponses'] }}</div><div class="stat-label">{{ 'ADMIN.surveyResponses' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['conflictAnalyses'] }}</div><div class="stat-label">{{ 'ADMIN.conflictAnalyses' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ engagement()!.activity['journalEntries'] }}</div><div class="stat-label">{{ 'ADMIN.journalEntries' | translate }}</div></div>
            </div>
            <div class="breakdown-row">
              <div class="breakdown-col">
                <h4>{{ 'ADMIN.byRole' | translate }}</h4>
                @for (entry of objectEntries(engagement()!.roleBreakdown); track entry[0]) {
                  <div class="breakdown-item">
                    <span class="breakdown-key">{{ roleLabel(entry[0]) }}</span>
                    <span class="breakdown-val">{{ entry[1] }}</span>
                  </div>
                }
              </div>
              <div class="breakdown-col">
                <h4>{{ 'ADMIN.byDepartment' | translate }}</h4>
                @if (engagement()!.deptBreakdown.length === 0) {
                  <div class="breakdown-empty">{{ 'ADMIN.noDeptData' | translate }}</div>
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
              <h2>{{ 'ADMIN.conflictRiskOverview' | translate }}</h2>
              <p>{{ 'ADMIN.conflictRiskDesc' | translate }}</p>
            </div>
            @if (conflict()) {
              <span class="report-total" [style.color]="riskColor(conflict()!.avgRiskScore)">Avg: {{ conflict()!.avgRiskScore }}/100</span>
            }
          </div>
          @if (conflict()) {
            <div class="stats-grid">
              <div class="stat-box low"><div class="stat-num">{{ conflict()!.byLevel['low'] || 0 }}</div><div class="stat-label">{{ 'CONFLICT.lowRisk' | translate }}</div></div>
              <div class="stat-box medium"><div class="stat-num">{{ conflict()!.byLevel['medium'] || 0 }}</div><div class="stat-label">{{ 'CONFLICT.mediumRisk' | translate }}</div></div>
              <div class="stat-box high"><div class="stat-num">{{ conflict()!.byLevel['high'] || 0 }}</div><div class="stat-label">{{ 'CONFLICT.highRisk' | translate }}</div></div>
              <div class="stat-box critical"><div class="stat-num">{{ conflict()!.byLevel['critical'] || 0 }}</div><div class="stat-label">{{ 'CONFLICT.critical' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ conflict()!.escalated }}</div><div class="stat-label">{{ 'ADMIN.escalations' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ conflict()!.total }}</div><div class="stat-label">{{ 'ADMIN.totalAnalyses' | translate }}</div></div>
            </div>

            @if (conflict()!.trend.length > 0) {
              <h4>{{ 'ADMIN.monthlyRiskTrend' | translate }}</h4>
              <div class="bar-chart">
                @for (item of conflict()!.trend; track item.period) {
                  <div class="bar-col" [matTooltip]="'Avg: ' + item.avgScore + '/100 (' + item.count + ' analyses)'">
                    <div class="bar" [style.height.%]="item.avgScore" [style.background]="riskColor(item.avgScore)"></div>
                    <div class="bar-label">{{ item.period | slice:5 }}</div>
                  </div>
                }
              </div>
            }

            <!-- Per-department trend (longitudinal risk by team) ------------- -->
            @if ((conflict()!.trendByDepartment?.length ?? 0) > 1 && trendPeriods().length > 1) {
              <h4>{{ 'ADMIN.riskTrendByDepartment' | translate }}</h4>
              <div class="dept-trend-wrap">
                <svg class="dept-trend-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
                  <!-- Risk-band reference lines: 25 / 50 / 75 -->
                  <line x1="0" x2="600" y1="150" y2="150" class="grid-line low-mid"/>
                  <line x1="0" x2="600" y1="100" y2="100" class="grid-line mid-high"/>
                  <line x1="0" x2="600" y1="50"  y2="50"  class="grid-line high-crit"/>
                  <text x="6"  y="148" class="grid-lbl">25</text>
                  <text x="6"  y="98"  class="grid-lbl">50</text>
                  <text x="6"  y="48"  class="grid-lbl">75</text>
                  @for (s of conflict()!.trendByDepartment ?? []; track s.department; let i = $index) {
                    <polyline class="dept-line" fill="none"
                              [attr.stroke]="deptColor(i)"
                              [attr.points]="trendPolyline(s.points, 600, 200)"/>
                    @for (d of trendDots(s.points, 600, 200); track d.period) {
                      <circle class="dept-dot" r="3"
                              [attr.cx]="d.x" [attr.cy]="d.y"
                              [attr.fill]="deptColor(i)">
                        <title>{{ s.department }} · {{ d.period }} · {{ d.score }}/100</title>
                      </circle>
                    }
                  }
                </svg>
                <div class="dept-axis">
                  @for (p of trendPeriods(); track p) {
                    <span class="dept-tick">{{ p | slice:5 }}</span>
                  }
                </div>
                <div class="dept-legend">
                  @for (s of conflict()!.trendByDepartment ?? []; track s.department; let i = $index) {
                    <span class="dept-legend-item">
                      <span class="dept-swatch" [style.background]="deptColor(i)"></span>
                      {{ s.department }}
                    </span>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- IDP Progress -->
        <div class="report-card">
          <div class="report-header">
            <mat-icon>trending_up</mat-icon>
            <div>
              <h2>{{ 'ADMIN.devPlanProgress' | translate }}</h2>
              <p>{{ 'ADMIN.devPlanProgressDesc' | translate }}</p>
            </div>
          </div>
          @if (idpReport()) {
            <div class="stats-grid">
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.total }}</div><div class="stat-label">{{ 'ADMIN.totalPlans' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.byStatus['active'] || 0 }}</div><div class="stat-label">{{ 'COMMON.active' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.byStatus['completed'] || 0 }}</div><div class="stat-label">{{ 'ADMIN.completed' | translate }}</div></div>
              <div class="stat-box"><div class="stat-num">{{ idpReport()!.milestones.rate }}%</div><div class="stat-label">{{ 'ADMIN.milestoneRate' | translate }}</div><div class="stat-sub">{{ idpReport()!.milestones.completed }}/{{ idpReport()!.milestones.total }}</div></div>
            </div>

            @if (idpReport()!.plans.length > 0) {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>{{ 'ADMIN.person' | translate }}</th>
                    <th>{{ 'ADMIN.goalHeader' | translate }}</th>
                    <th>{{ 'ADMIN.module' | translate }}</th>
                    <th>{{ 'COMMON.status' | translate }}</th>
                    <th>{{ 'ADMIN.milestonesHeader' | translate }}</th>
                    <th>{{ 'COMMON.created' | translate }}</th>
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
              <h2>{{ 'ADMIN.surveyAssessmentActivity' | translate }}</h2>
              <p>{{ 'ADMIN.surveyAssessmentActivityDesc' | translate }}</p>
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
                    <th>{{ 'ADMIN.templateHeader' | translate }}</th>
                    <th>{{ 'ADMIN.module' | translate }}</th>
                    <th>{{ 'ADMIN.responsesHeader' | translate }}</th>
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
      mat-icon { font-size: 24px; color: var(--artes-accent); margin-top: 2px; }
      h2 { font-size: 18px; color: var(--artes-primary); margin: 0 0 2px; font-weight: 700; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
      .report-total { margin-left: auto; font-size: 16px; font-weight: 700; color: #27C4A0; }
    }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-box {
      background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center;
      .stat-num { font-size: 28px; font-weight: 700; color: var(--artes-primary); }
      .stat-label { font-size: 12px; color: #5a6a7e; margin-top: 2px; }
      .stat-sub { font-size: 11px; color: #9aa5b4; }
      &.low .stat-num { color: #27C4A0; }
      &.medium .stat-num { color: #f0a500; }
      &.high .stat-num { color: #e86c3a; }
      &.critical .stat-num { color: #e53e3e; }
    }

    .breakdown-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .breakdown-col { h4 { font-size: 13px; font-weight: 600; color: var(--artes-primary); margin: 0 0 10px; } }
    .breakdown-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f4f8; font-size: 13px; }
    .breakdown-key { color: #5a6a7e; }
    .breakdown-val { font-weight: 600; color: var(--artes-primary); }
    .breakdown-empty { font-size: 13px; color: #9aa5b4; }

    .bar-chart { display: flex; gap: 6px; align-items: flex-end; height: 140px; padding: 0 8px; margin-top: 12px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
    .bar { width: 100%; max-width: 36px; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; }
    .bar-label { font-size: 10px; color: #9aa5b4; margin-top: 6px; }

    .data-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th { text-align: left; padding: 10px 12px; background: #f8fafc; color: var(--artes-primary); font-weight: 600; font-size: 12px; border-bottom: 2px solid #edf2f7; }
      td { padding: 10px 12px; border-bottom: 1px solid #f0f4f8; color: #374151; }
      tr:hover td { background: #fafbfc; }
      .amount { font-weight: 600; text-align: right; }
      .goal-cell { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }
    .module-chip { font-size: 10px; background: var(--artes-bg); color: var(--artes-accent); padding: 2px 8px; border-radius: 4px; text-transform: capitalize; }
    .status-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 999px;
      &.draft { background: #f0f4f8; color: #9aa5b4; }
      &.active { background: var(--artes-bg); color: var(--artes-accent); }
      &.completed { background: #e8faf4; color: #27C4A0; }
    }
    h4 { font-size: 14px; color: var(--artes-primary); margin: 16px 0 8px; }

    .dept-trend-wrap { margin-top: 8px; }
    .dept-trend-svg {
      width: 100%; height: 200px;
      background: linear-gradient(
        to top,
        rgba(39,196,160,0.05) 0%,
        rgba(39,196,160,0.05) 25%,
        rgba(240,165,0,0.06) 25%,
        rgba(240,165,0,0.06) 50%,
        rgba(232,108,58,0.06) 50%,
        rgba(232,108,58,0.06) 75%,
        rgba(229,62,62,0.07) 75%
      );
      border-radius: 8px;
    }
    .grid-line { stroke: rgba(0,0,0,0.06); stroke-width: 1; stroke-dasharray: 3 4; }
    .grid-lbl { font-size: 9px; fill: #9aa5b4; }
    .dept-line { stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .dept-dot { stroke: white; stroke-width: 1.5; }

    .dept-axis {
      display: flex; justify-content: space-between;
      padding: 4px 4px 0; font-size: 11px; color: #8fa4c0;
      .dept-tick { flex: 1 1 0; text-align: center; }
    }
    .dept-legend {
      display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px;
      .dept-legend-item {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; color: #5a6a7e;
      }
      .dept-swatch {
        display: inline-block; width: 12px; height: 3px; border-radius: 2px;
      }
    }
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

  // ── Per-department risk trend chart helpers ────────────────────────────
  // Renders an SVG poly-line chart with one line per department. The shared
  // x-axis is the union of every period that appears across all departments.

  /** Stable categorical palette — first colour is reserved for "All Departments". */
  private deptPalette = [
    '#5a6a7e', '#3A9FD6', '#27C4A0', '#e86c3a',
    '#7c3aed', '#f0a500', '#c53030', '#1a9678',
    '#2080b0', '#6b3aa0',
  ];
  deptColor(idx: number): string { return this.deptPalette[idx % this.deptPalette.length]!; }

  /** Sorted union of all periods across every department's points[]. */
  trendPeriods(): string[] {
    const series = this.conflict()?.trendByDepartment ?? [];
    const set = new Set<string>();
    for (const s of series) for (const p of s.points) set.add(p.period);
    return Array.from(set).sort();
  }

  /** Convert a department's points array into an SVG `points` attribute. */
  trendPolyline(points: { period: string; avgScore: number }[], width: number, height: number): string {
    const periods = this.trendPeriods();
    if (periods.length === 0) return '';
    const xStep = periods.length > 1 ? width / (periods.length - 1) : 0;
    const byPeriod = new Map(points.map((p) => [p.period, p.avgScore]));
    const coords: string[] = [];
    periods.forEach((period, i) => {
      const score = byPeriod.get(period);
      if (typeof score !== 'number') return;
      const x = i * xStep;
      const y = height - (score / 100) * height;
      coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return coords.join(' ');
  }

  /** Per-point markers — one circle per (period, dept) where data exists. */
  trendDots(points: { period: string; avgScore: number }[], width: number, height: number): Array<{ x: number; y: number; score: number; period: string }> {
    const periods = this.trendPeriods();
    if (periods.length === 0) return [];
    const xStep = periods.length > 1 ? width / (periods.length - 1) : 0;
    const byPeriod = new Map(points.map((p) => [p.period, p.avgScore]));
    const dots: Array<{ x: number; y: number; score: number; period: string }> = [];
    periods.forEach((period, i) => {
      const score = byPeriod.get(period);
      if (typeof score !== 'number') return;
      dots.push({
        x: i * xStep,
        y: height - (score / 100) * height,
        score,
        period,
      });
    });
    return dots;
  }
}

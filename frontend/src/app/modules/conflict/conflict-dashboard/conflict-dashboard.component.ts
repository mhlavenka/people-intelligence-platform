import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';
import { ConflictDetailDialogComponent } from '../conflict-detail-dialog/conflict-detail-dialog.component';

interface SurveyTemplate { _id: string; title: string; moduleType: string; }

interface ConflictAnalysis {
  _id: string;
  departmentId: string;
  surveyPeriod: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  escalationRequested: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-conflict-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="conflict-page">
      <div class="page-header">
        <div>
          <h1>Conflict Intelligence™</h1>
          <p>Monitor workplace conflict risk across departments</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="copySurveyLink()" [disabled]="!surveyTemplateId()">
            <mat-icon>link</mat-icon> Copy Survey Link
          </button>
          <button mat-raised-button color="primary" (click)="runNewAnalysis()">
            <mat-icon>add</mat-icon> New Analysis
          </button>
        </div>
      </div>

      <!-- Risk overview cards -->
      <div class="risk-overview">
        @for (level of riskLevels; track level.key) {
          <div class="risk-card" [class]="'risk-card--' + level.key">
            <div class="risk-count">{{ level.count }}</div>
            <div class="risk-label">{{ level.label }}</div>
          </div>
        }
      </div>

      <!-- Gauge + summary -->
      <div class="analysis-grid">
        <div class="gauge-card">
          <h3>Overall Organization Risk</h3>
          <div class="gauge-container">
            <svg viewBox="0 0 200 120" class="gauge-svg">
              <!-- Background arc -->
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e8edf4" stroke-width="16" stroke-linecap="round"/>
              <!-- Risk arc -->
              <path
                [attr.d]="gaugeArcPath()"
                fill="none"
                [attr.stroke]="gaugeColor()"
                stroke-width="16"
                stroke-linecap="round"
                class="gauge-arc"
              />
              <!-- Score text -->
              <text x="100" y="90" text-anchor="middle" class="gauge-score">{{ avgRiskScore() }}</text>
              <text x="100" y="110" text-anchor="middle" class="gauge-label">Avg Risk Score</text>
            </svg>
          </div>
          <div class="risk-legend">
            <span class="legend-item low">Low 0-25</span>
            <span class="legend-item medium">Medium 26-50</span>
            <span class="legend-item high">High 51-75</span>
            <span class="legend-item critical">Critical 76-100</span>
          </div>
        </div>

        <div class="dept-heatmap">
          <h3>Department Heatmap</h3>
          @if (loading()) {
            <div class="loading-center"><mat-spinner diameter="32" /></div>
          } @else if (analyses().length === 0) {
            <div class="empty-state">
              <mat-icon>analytics</mat-icon>
              <p>No analyses yet. Run your first conflict analysis.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="analyses()" class="heatmap-table">
              <ng-container matColumnDef="department">
                <th mat-header-cell *matHeaderCellDef>Department</th>
                <td mat-cell *matCellDef="let row">{{ row.departmentId || 'All' }}</td>
              </ng-container>
              <ng-container matColumnDef="period">
                <th mat-header-cell *matHeaderCellDef>Period</th>
                <td mat-cell *matCellDef="let row">{{ row.surveyPeriod }}</td>
              </ng-container>
              <ng-container matColumnDef="score">
                <th mat-header-cell *matHeaderCellDef>Risk Score</th>
                <td mat-cell *matCellDef="let row">
                  <div class="score-bar">
                    <div class="score-fill" [class]="row.riskLevel" [style.width.%]="row.riskScore"></div>
                    <span>{{ row.riskScore }}</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="level">
                <th mat-header-cell *matHeaderCellDef>Risk Level</th>
                <td mat-cell *matCellDef="let row">
                  <span class="risk-badge" [class]="row.riskLevel">{{ row.riskLevel }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-button (click)="viewAnalysis(row._id)">View</button>
                  @if (!row.escalationRequested && row.riskLevel !== 'low') {
                    <button mat-button color="warn" (click)="escalate(row._id)">Escalate</button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .conflict-page { padding: 32px; max-width: 1200px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .risk-overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .risk-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border-left: 4px solid transparent;

      .risk-count { font-size: 36px; font-weight: 700; color: #1B2A47; }
      .risk-label { font-size: 13px; color: #5a6a7e; margin-top: 4px; }
    }

    .risk-card--low      { border-color: #27C4A0; .risk-count { color: #27C4A0; } }
    .risk-card--medium   { border-color: #f0a500; .risk-count { color: #f0a500; } }
    .risk-card--high     { border-color: #e86c3a; .risk-count { color: #e86c3a; } }
    .risk-card--critical { border-color: #e53e3e; .risk-count { color: #e53e3e; } }

    .analysis-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 20px;
    }

    .gauge-card, .dept-heatmap {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      h3 { font-size: 16px; color: #1B2A47; margin-bottom: 16px; }
    }

    .gauge-svg {
      width: 100%;
      .gauge-score { font-size: 28px; font-weight: 700; fill: #1B2A47; }
      .gauge-label { font-size: 10px; fill: #9aa5b4; }
    }

    .risk-legend {
      display: flex; flex-direction: column; gap: 6px; margin-top: 12px;
      .legend-item {
        font-size: 11px; padding: 3px 8px; border-radius: 4px;
        &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
        &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
        &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
        &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
      }
    }

    .heatmap-table { width: 100%; }

    .score-bar {
      display: flex; align-items: center; gap: 8px;
      .score-fill {
        height: 8px; border-radius: 4px; min-width: 4px;
        &.low      { background: #27C4A0; }
        &.medium   { background: #f0a500; }
        &.high     { background: #e86c3a; }
        &.critical { background: #e53e3e; }
      }
      span { font-size: 13px; font-weight: 600; }
    }

    .risk-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
      &.low      { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.medium   { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.high     { background: rgba(232,108,58,0.15); color: #c04a14; }
      &.critical { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    .loading-center { display: flex; justify-content: center; padding: 48px; }

    .empty-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
      p { font-size: 14px; }
    }
  `],
})
export class ConflictDashboardComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);
  displayedColumns = ['department', 'period', 'score', 'level', 'actions'];

  riskLevels = [
    { key: 'low', label: 'Low Risk', count: 0 },
    { key: 'medium', label: 'Medium Risk', count: 0 },
    { key: 'high', label: 'High Risk', count: 0 },
    { key: 'critical', label: 'Critical', count: 0 },
  ];

  avgRiskScore = signal(0);

  gaugeColor = () => {
    const s = this.avgRiskScore();
    if (s <= 25) return '#27C4A0';
    if (s <= 50) return '#f0a500';
    if (s <= 75) return '#e86c3a';
    return '#e53e3e';
  };

  gaugeArcPath = () => {
    const score = this.avgRiskScore();
    if (score <= 0) return '';
    const angle = (score / 100) * Math.PI;
    const x = (100 - 80 * Math.cos(angle)).toFixed(2);
    const y = (100 - 80 * Math.sin(angle)).toFixed(2);
    // large-arc-flag is always 0: the filled portion is always ≤ 180°
    return `M 20 100 A 80 80 0 0 1 ${x} ${y}`;
  };

  surveyTemplateId = signal('');

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadAnalyses();
  }

  loadAnalyses(): void {
    // Load first conflict template ID for survey link
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
      next: (templates) => {
        const first = templates.find((t) => t.moduleType === 'conflict');
        if (first) this.surveyTemplateId.set(first._id);
      },
    });

    this.loading.set(true);
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => {
        this.analyses.set(data);
        this.updateStats(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  updateStats(data: ConflictAnalysis[]): void {
    this.riskLevels.forEach((l) => {
      l.count = data.filter((a) => a.riskLevel === l.key).length;
    });
    const avg = data.length
      ? Math.round(data.reduce((s, a) => s + a.riskScore, 0) / data.length)
      : 0;
    this.avgRiskScore.set(avg);
  }

  viewAnalysis(id: string): void {
    const analysis = this.analyses().find((a) => a._id === id);
    if (!analysis) return;

    const ref = this.dialog.open(ConflictDetailDialogComponent, {
      width: '740px',
      maxHeight: '90vh',
      data: analysis,
    });

    ref.afterClosed().subscribe((result) => {
      if (result?.action === 'escalate') {
        this.escalate(result.id);
      }
    });
  }

  escalate(id: string): void {
    this.api.post(`/conflict/escalate/${id}`, {}).subscribe({
      next: () => this.loadAnalyses(),
    });
  }

  copySurveyLink(): void {
    const url = `${window.location.origin}/survey/${this.surveyTemplateId()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('Survey link copied to clipboard!', 'Close', { duration: 3000 });
    });
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, {
      width: '560px',
      disableClose: true,
    });

    ref.afterClosed().subscribe((result) => {
      if (result) this.loadAnalyses();
    });
  }
}

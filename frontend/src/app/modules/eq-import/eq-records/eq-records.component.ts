import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../core/api.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

interface ScoreRecord {
  _id: string;
  importId: string;
  privacyMode: string;
  clientName?: string;
  clientCode?: string;
  reportType: string;
  assessmentYear: number | null;
  industrySector?: string;
  roleLevel?: string;
  subscaleScores: Record<string, number>;
  compositeScores: Record<string, number>;
  totalEI: number | null;
  wellBeingIndicator: number | null;
  requiresManualReview: boolean;
  createdAt: string;
}

const SUBSCALE_LABELS: Record<string, string> = {
  selfRegard: 'Self-Regard', selfActualization: 'Self-Actualization',
  emotionalSelfAwareness: 'Emotional Self-Awareness', emotionalExpression: 'Emotional Expression',
  assertiveness: 'Assertiveness', independence: 'Independence',
  interpersonalRelationships: 'Interpersonal Relationships', empathy: 'Empathy',
  socialResponsibility: 'Social Responsibility', problemSolving: 'Problem Solving',
  realityTesting: 'Reality Testing', impulseControl: 'Impulse Control',
  flexibility: 'Flexibility', stressTolerance: 'Stress Tolerance', optimism: 'Optimism',
};

const COMPOSITE_LABELS: Record<string, string> = {
  selfPerceptionComposite: 'Self-Perception', selfExpressionComposite: 'Self-Expression',
  interpersonalComposite: 'Interpersonal', decisionMakingComposite: 'Decision Making',
  stressManagementComposite: 'Stress Management',
};

@Component({
  selector: 'app-eq-records',
  standalone: true,
  imports: [
    CommonModule, DatePipe, RouterLink, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTooltipModule, MatExpansionModule,
    MatDividerModule, MatSnackBarModule, EmptyStateComponent,
  ],
  template: `
    <div class="records-page">
      <div class="page-header">
        <div>
          <h1>EQi Assessments</h1>
          <p>Imported EQi 2.0 assessment records</p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/eq-import/audit"><mat-icon>receipt_long</mat-icon> Audit Log</a>
          <a mat-raised-button color="primary" routerLink="/eq-import"><mat-icon>upload_file</mat-icon> Import New</a>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (records().length === 0) {
        <app-empty-state icon="psychology" title="No assessments imported yet" message="Import your first EQi 2.0 PDF report to get started.">
          <a mat-raised-button color="primary" routerLink="/eq-import"><mat-icon>upload_file</mat-icon> Import Assessment</a>
        </app-empty-state>
      } @else {
        <div class="stats-bar">
          <div class="stat-box"><div class="stat-num">{{ records().length }}</div><div class="stat-label">Total Imported</div></div>
          <div class="stat-box"><div class="stat-num">{{ avgTotalEI() }}</div><div class="stat-label">Avg Total EI</div></div>
          <div class="stat-box"><div class="stat-num">{{ modeCount('ANONYMIZED') }}</div><div class="stat-label">Anonymized</div></div>
          <div class="stat-box"><div class="stat-num">{{ modeCount('PSEUDONYMIZED') }}</div><div class="stat-label">Pseudonymized</div></div>
          <div class="stat-box"><div class="stat-num">{{ modeCount('IDENTIFIED') }}</div><div class="stat-label">Identified</div></div>
        </div>

        <div class="records-grid">
          @for (rec of records(); track rec._id) {
            <div class="record-card">
              <div class="record-header">
                <div class="record-id">
                  <span class="mode-chip" [class]="rec.privacyMode.toLowerCase()">{{ rec.privacyMode }}</span>
                  <span class="report-type">{{ rec.reportType }}</span>
                </div>
                <span class="record-date">{{ rec.createdAt | date:'MMM d, y' }}</span>
                @if (rec.privacyMode !== 'ANONYMIZED') {
                  <button mat-icon-button class="delete-btn" matTooltip="Erase data" (click)="eraseRecord(rec)">
                    <mat-icon>delete_forever</mat-icon>
                  </button>
                }
              </div>

              <div class="record-identity">
                @if (rec.clientName) {
                  <span><mat-icon>person</mat-icon> {{ rec.clientName }}</span>
                } @else if (rec.clientCode) {
                  <span><mat-icon>badge</mat-icon> {{ rec.clientCode }}</span>
                } @else {
                  <span><mat-icon>shield</mat-icon> Anonymous</span>
                }
                @if (rec.assessmentYear) { <span>{{ rec.assessmentYear }}</span> }
                @if (rec.industrySector) { <span>{{ rec.industrySector }}</span> }
              </div>

              <!-- Total EI -->
              <div class="total-ei">
                <div class="ei-score" [style.color]="scoreColor(rec.totalEI)">{{ rec.totalEI ?? '—' }}</div>
                <div class="ei-label">Total EI</div>
              </div>

              <!-- Composites bar -->
              <div class="composites-row">
                @for (entry of compositeEntries(rec); track entry[0]) {
                  <div class="composite-item" [matTooltip]="entry[0] + ': ' + entry[1]">
                    <div class="composite-bar" [style.width.%]="barWidth(entry[1])" [style.background]="scoreColor(entry[1])"></div>
                    <span class="composite-label">{{ compositeShort(entry[0]) }}</span>
                    <span class="composite-val">{{ entry[1] }}</span>
                  </div>
                }
              </div>

              <!-- Expandable subscales -->
              <mat-expansion-panel class="subscales-panel">
                <mat-expansion-panel-header>
                  <mat-panel-title>15 Subscales</mat-panel-title>
                </mat-expansion-panel-header>
                <div class="subscale-grid">
                  @for (entry of subscaleEntries(rec); track entry[0]) {
                    <div class="subscale-item">
                      <span class="subscale-name">{{ subscaleLabel(entry[0]) }}</span>
                      <span class="subscale-score" [style.color]="scoreColor(entry[1])">{{ entry[1] }}</span>
                    </div>
                  }
                </div>
              </mat-expansion-panel>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .records-page { padding: 32px; }
    .header-actions { display: flex; gap: 10px; }

    .stats-bar {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .stat-box {
      background: white; border-radius: 12px; padding: 16px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      .stat-num { font-size: 28px; font-weight: 700; color: var(--artes-primary); }
      .stat-label { font-size: 12px; color: #5a6a7e; }
    }

    .records-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px;
    }

    .record-card {
      background: white; border-radius: 14px; padding: 20px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; gap: 12px;
    }

    .record-header {
      display: flex; align-items: center; gap: 8px;
      .record-date { margin-left: auto; font-size: 12px; color: #9aa5b4; }
    }
    .record-id { display: flex; align-items: center; gap: 6px; }
    .mode-chip {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;
      &.identified { background: var(--artes-bg); color: var(--artes-accent); }
      &.pseudonymized { background: #FFF8E6; color: #b07800; }
      &.anonymized { background: #e8faf4; color: #1a9678; }
    }
    .report-type { font-size: 12px; color: #5a6a7e; }
    .delete-btn { color: #c5d0db; &:hover { color: #e53e3e; } }

    .record-identity {
      display: flex; align-items: center; gap: 12px; font-size: 13px; color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #9aa5b4; vertical-align: middle; }
      span { display: flex; align-items: center; gap: 4px; }
    }

    .total-ei {
      display: flex; align-items: baseline; gap: 8px;
      .ei-score { font-size: 36px; font-weight: 700; }
      .ei-label { font-size: 13px; color: #9aa5b4; }
    }

    .composites-row { display: flex; flex-direction: column; gap: 6px; }
    .composite-item {
      display: flex; align-items: center; gap: 8px; position: relative;
    }
    .composite-bar { height: 6px; border-radius: 3px; min-width: 4px; transition: width 0.3s; }
    .composite-label { font-size: 11px; color: #5a6a7e; width: 60px; flex-shrink: 0; }
    .composite-val { font-size: 12px; font-weight: 600; color: var(--artes-primary); }

    .subscales-panel {
      box-shadow: none !important; border: 1px solid #e8edf4 !important;
      border-radius: 10px !important;
    }
    ::ng-deep .subscales-panel .mat-expansion-panel-header { height: 40px !important; font-size: 13px !important; }
    .subscale-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .subscale-item {
      display: flex; justify-content: space-between; padding: 4px 8px;
      font-size: 12px; border-radius: 4px;
      &:hover { background: #f8fafc; }
    }
    .subscale-name { color: #5a6a7e; }
    .subscale-score { font-weight: 600; }

    @media (max-width: 768px) {
      .records-grid { grid-template-columns: 1fr; }
      .subscale-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class EqRecordsComponent implements OnInit {
  records = signal<ScoreRecord[]>([]);
  loading = signal(true);

  constructor(private api: ApiService, private snack: MatSnackBar, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.api.get<ScoreRecord[]>('/eq/import/records').subscribe({
      next: (r) => { this.records.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  avgTotalEI(): number {
    const scores = this.records().map((r) => r.totalEI).filter((v): v is number => v !== null);
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  modeCount(mode: string): number {
    return this.records().filter((r) => r.privacyMode === mode).length;
  }

  compositeEntries(rec: ScoreRecord): [string, number][] {
    return Object.entries(rec.compositeScores || {});
  }

  subscaleEntries(rec: ScoreRecord): [string, number][] {
    return Object.entries(rec.subscaleScores || {});
  }

  subscaleLabel(key: string): string { return SUBSCALE_LABELS[key] || key; }

  compositeShort(key: string): string {
    return (COMPOSITE_LABELS[key] || key).replace('Composite', '').trim();
  }

  scoreColor(score: number | null): string {
    if (score === null) return '#9aa5b4';
    if (score >= 110) return '#27C4A0';
    if (score >= 90) return '#3A9FD6';
    if (score >= 70) return '#f0a500';
    return '#e53e3e';
  }

  barWidth(score: number): number {
    return Math.max(5, ((score - 55) / (145 - 55)) * 100);
  }

  eraseRecord(rec: ScoreRecord): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Erase Assessment Data',
        message: 'Permanently erase this assessment record? The audit log will be preserved. This cannot be undone.',
        confirmLabel: 'Erase', confirmColor: 'warn', icon: 'delete_forever',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/eq/import/record/${rec._id}`).subscribe({
        next: () => {
          this.records.update((list) => list.filter((r) => r._id !== rec._id));
          this.snack.open('Assessment data erased', 'OK', { duration: 3000 });
        },
        error: (err) => this.snack.open(err.error?.error || 'Erasure failed', 'Dismiss', { duration: 4000 }),
      });
    });
  }
}

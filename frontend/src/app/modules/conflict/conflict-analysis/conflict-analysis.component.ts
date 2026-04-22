import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';
import { MiniGaugeComponent } from '../../../shared/mini-gauge/mini-gauge.component';
import { RiskBadgeComponent } from '../../../shared/risk-badge/risk-badge.component';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface ConflictAnalysis {
  _id: string;
  intakeTemplateId?: { _id: string; title: string } | null;
  name: string;
  departmentId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  conflictTypes: string[];
  aiNarrative: string;
  managerScript: string;
  escalationRequested: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-conflict-analysis',
  standalone: true,
  imports: [
    CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MiniGaugeComponent, RiskBadgeComponent,
    TranslateModule,
  ],
  template: `
    <!-- Analysis-specific banner: what AI Analysis actually does -->
    <div class="analysis-banner">
      <div class="analysis-banner-head">
        <div class="analysis-banner-icon"><mat-icon>psychology</mat-icon></div>
        <div>
          <h2>{{ 'CONFLICT.analysisBannerTitle' | translate }}</h2>
          <p>{{ 'CONFLICT.analysisBannerDesc' | translate }}</p>
        </div>
      </div>
      <div class="analysis-layers">
        <div class="layer"><mat-icon>article</mat-icon><span [innerHTML]="'CONFLICT.analysisLayerNarrative' | translate"></span></div>
        <div class="layer"><mat-icon>speed</mat-icon><span [innerHTML]="'CONFLICT.analysisLayerQuantitative' | translate"></span></div>
        <div class="layer"><mat-icon>category</mat-icon><span [innerHTML]="'CONFLICT.analysisLayerPattern' | translate"></span></div>
      </div>
    </div>

    <!-- Analyses list -->
    <div class="analyses-section">
      <div class="analyses-header">
        <h2>{{ "CONFLICT.analyses" | translate }}</h2>
        <span class="analyses-count">{{ analyses().length }} total</span>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="analyses-grid">
          @for (a of analyses(); track a._id) {
            <div class="analysis-card" [class]="'accent-' + a.riskLevel" (click)="viewAnalysis(a)">
              <div class="analysis-card-top">
                <div class="mini-gauge-wrap">
                  <app-mini-gauge [score]="a.riskScore" [riskLevel]="a.riskLevel" />
                  <app-risk-badge [level]="a.riskLevel" />
                </div>
                <div class="analysis-meta">
                  <div class="meta-name">
                    <strong>{{ a.name }}</strong>
                  </div>
                  <div class="meta-period">
                    <mat-icon>calendar_today</mat-icon>
                    {{ a.createdAt | date:'MMM d, y' }}
                  </div>
                  @if (a.intakeTemplateId?.title; as tplTitle) {
                    <div class="meta-template">
                      <mat-icon>assignment</mat-icon>
                      <span>{{ tplTitle }}</span>
                    </div>
                  }
                  @if (a.escalationRequested) {
                    <span class="escalated-badge">
                      <mat-icon>gavel</mat-icon> {{ "CONFLICT.escalated" | translate }}
                    </span>
                  }
                </div>
                <button mat-icon-button class="delete-analysis-btn"
                        [matTooltip]="'CONFLICT.deleteAnalysis' | translate"
                        (click)="deleteAnalysis(a); $event.stopPropagation()">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
              @if (a.conflictTypes.length) {
                <div class="type-chips">
                  @for (t of a.conflictTypes; track t) {
                    <span class="type-chip">{{ t }}</span>
                  }
                </div>
              }
              @if (!a.escalationRequested && (a.riskLevel === 'high' || a.riskLevel === 'critical')) {
                <div class="analysis-card-actions">
                  <button mat-stroked-button color="warn" (click)="escalate(a._id); $event.stopPropagation()">
                    <mat-icon>escalator_warning</mat-icon> {{ 'CONFLICT.escalate' | translate }}
                  </button>
                </div>
              }
            </div>
          }

          <div class="analysis-card new-analysis-card" (click)="runNewAnalysis()">
            <mat-icon class="new-analysis-icon">add</mat-icon>
            <span>{{ "CONFLICT.newAnalysis" | translate }}</span>
          </div>
        </div>
      }
    </div>

  `,
  styles: [`
    .analysis-banner {
      background: linear-gradient(135deg, #1B2A47 0%, #243558 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; color: white;
    }
    .analysis-banner-head {
      display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px;
      h2 { font-size: 17px; margin: 0 0 6px; font-weight: 700; letter-spacing: -0.1px; color: #ffffff; }
      p  { font-size: 13px; line-height: 1.6; margin: 0; color: rgba(255,255,255,0.85); }
    }
    .analysis-banner-icon {
      width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(58,159,214,0.25); color: #8bd0ff;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .analysis-layers {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;
    }
    .layer {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      font-size: 12.5px; line-height: 1.5; color: rgba(255,255,255,0.9);
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #f0c040; flex-shrink: 0; margin-top: 1px; }
      strong { color: white; }
    }

    .analyses-section {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 24px;
    }
    .analyses-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 24px; border-bottom: 1px solid #f0f4f8;
      h2 { font-size: 16px; color: var(--artes-primary); margin: 0; font-weight: 700; }
      .analyses-count { font-size: 12px; background: #f0f4f8; color: #5a6a7e; padding: 2px 9px; border-radius: 999px; }
      .new-analysis-btn { margin-left: auto; }
    }

    .analyses-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
      gap: 16px; padding: 16px 20px 20px;
    }
    .analysis-card {
      background: white; border: 1px solid #e8edf4; border-radius: 14px; padding: 18px;
      border-left: 4px solid transparent; transition: box-shadow 0.15s; cursor: pointer;
      display: flex; flex-direction: column; gap: 12px;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      &.accent-low      { border-left-color: #27C4A0; }
      &.accent-medium   { border-left-color: #f0a500; }
      &.accent-high     { border-left-color: #e86c3a; }
      &.accent-critical { border-left-color: #e53e3e; }
    }
    .analysis-card-top { display: flex; align-items: flex-start; gap: 16px; }
    .mini-gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    app-mini-gauge { width: 80px; }
    .new-analysis-card {
      border: 2px dashed #d0d8e4; border-left-width: 2px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; cursor: pointer; min-height: 120px; color: #6b7c93;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      &:hover { border-color: var(--artes-accent); color: var(--artes-accent); background: rgba(58,159,214,0.04); }
    }
    .new-analysis-icon { font-size: 36px; width: 36px; height: 36px; }
    .analysis-meta { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
    .meta-name { font-size: 14px; color: var(--artes-primary); strong { font-weight: 600; } }
    .meta-template { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--artes-accent); mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .meta-dept, .meta-period { display: flex; align-items: center; gap: 5px; font-size: 13px; mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; } strong { color: var(--artes-primary); } }
    .meta-period { color: #5a6a7e; }
    .type-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .type-chip { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: capitalize; background: #eef2f7; color: #4a5568; }
    .escalated-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #e86c3a; font-weight: 600; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .analysis-card-actions { display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid #f0f4f8; }
    .delete-analysis-btn { color: #c5d0db; width: 28px; height: 28px; margin-left: auto; flex-shrink: 0; &:hover { color: #e53e3e !important; } }

  `],
})
export class ConflictAnalysisComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);

  constructor(private api: ApiService, private dialog: MatDialog, private snackBar: MatSnackBar, private router: Router, private translate: TranslateService) {}

  ngOnInit(): void { this.loadAnalyses(); }

  loadAnalyses(): void {
    this.loading.set(true);
    this.api.get<ConflictAnalysis[]>('/conflict/analyses').subscribe({
      next: (data) => {
        const topLevel = data.filter((a: any) => !a.parentId);
        this.analyses.set(topLevel);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  viewAnalysis(analysis: ConflictAnalysis): void {
    this.router.navigate(['/conflict/analysis', analysis._id]);
  }

  escalate(id: string): void {
    this.api.post(`/conflict/escalate/${id}`, {}).subscribe({ next: () => this.loadAnalyses() });
  }

  deleteAnalysis(a: ConflictAnalysis): void {
    if (!confirm(`Delete analysis for "${a.departmentId || 'All Departments'}" (${a.name})?`)) return;
    this.api.delete(`/conflict/analyses/${a._id}`).subscribe({
      next: () => { this.analyses.update((list) => list.filter((x) => x._id !== a._id)); this.snackBar.open(this.translate.instant('CONFLICT.analysisDeleted'), this.translate.instant('COMMON.ok'), { duration: 3000 }); },
    });
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, { width: '560px', disableClose: true });
    ref.afterClosed().subscribe((result) => { if (result) this.loadAnalyses(); });
  }

}

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/api.service';
import { MiniGaugeComponent } from '../../../shared/mini-gauge/mini-gauge.component';
import { RiskBadgeComponent } from '../../../shared/risk-badge/risk-badge.component';
import { ConflictAnalyzeDialogComponent } from '../conflict-analyze-dialog/conflict-analyze-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { parseConflictType } from '../conflict-type.util';

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

type SortOption = 'recent' | 'risk-desc' | 'risk-asc' | 'name';

const SORT_LABEL_KEYS: Record<SortOption, string> = {
  'recent':    'CONFLICT.sortRecent',
  'risk-desc': 'CONFLICT.sortRiskDesc',
  'risk-asc':  'CONFLICT.sortRiskAsc',
  'name':      'CONFLICT.sortName',
};

const RISK_RANK: Record<ConflictAnalysis['riskLevel'], number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

@Component({
  selector: 'app-conflict-analysis',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatMenuModule,
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
        <span class="analyses-count">
          @if (searchQuery() || sort() !== 'recent') {
            {{ filteredAnalyses().length }} / {{ analyses().length }}
          } @else {
            {{ analyses().length }}
          }
          {{ 'CONFLICT.totalSuffix' | translate }}
        </span>

        <div class="header-controls">
          <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput
                   [placeholder]="'CONFLICT.searchAnalyses' | translate"
                   [ngModel]="searchQuery()"
                   (ngModelChange)="searchQuery.set($event)" />
            @if (searchQuery()) {
              <button matSuffix mat-icon-button aria-label="Clear" (click)="searchQuery.set('')">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>

          <button mat-stroked-button [matMenuTriggerFor]="sortMenu" class="sort-btn">
            <mat-icon>sort</mat-icon>
            <span>{{ sortLabelKey() | translate }}</span>
            <mat-icon class="caret">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #sortMenu="matMenu">
            <button mat-menu-item (click)="sort.set('recent')">
              <mat-icon>schedule</mat-icon>{{ 'CONFLICT.sortRecent' | translate }}
            </button>
            <button mat-menu-item (click)="sort.set('risk-desc')">
              <mat-icon>arrow_downward</mat-icon>{{ 'CONFLICT.sortRiskDesc' | translate }}
            </button>
            <button mat-menu-item (click)="sort.set('risk-asc')">
              <mat-icon>arrow_upward</mat-icon>{{ 'CONFLICT.sortRiskAsc' | translate }}
            </button>
            <button mat-menu-item (click)="sort.set('name')">
              <mat-icon>sort_by_alpha</mat-icon>{{ 'CONFLICT.sortName' | translate }}
            </button>
          </mat-menu>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {
        <div class="analyses-grid">
          @for (a of filteredAnalyses(); track a._id) {
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
                <ul class="type-list">
                  @for (t of a.conflictTypes; track t) {
                    <li class="type-list-item" [matTooltip]="parseType(t).rationale">
                      <mat-icon>{{ typeIcon(parseType(t).label) }}</mat-icon>
                      <span>{{ parseType(t).label }}</span>
                    </li>
                  }
                </ul>
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
      background: var(--artes-panel); border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 24px;
    }
    .analyses-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 24px; border-bottom: 1px solid #f0f4f8;
      h2 { font-size: 16px; color: var(--artes-on-panel, var(--artes-primary)); margin: 0; font-weight: 700; }
      .analyses-count { font-size: 12px; background: #f0f4f8; color: var(--artes-on-panel-muted, #5a6a7e); padding: 2px 9px; border-radius: 999px; }
      .header-controls { display: flex; align-items: center; gap: 8px; margin-left: auto; }
      .search-field { width: 240px; ::ng-deep .mat-mdc-form-field-infix { min-height: 36px; padding: 4px 0; } }
      .sort-btn { white-space: nowrap; .caret { font-size: 18px; width: 18px; height: 18px; margin-left: 2px; } }
    }

    .analyses-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(550px, 1fr));
      gap: 16px; padding: 16px 20px 20px;
    }
    .analysis-card {
      /* Each riskLevel sets --accent-color so the card pulls a barely-there
         tint from the same colour as its left border. color-mix lets us blend
         on top of whatever the org's surface colour is, so the tint stays
         subtle on light themes and visible on dark ones. */
      --accent-color: transparent;
      background: color-mix(in srgb, var(--accent-color) 5%, var(--artes-surface));
      border: 1px solid #e8edf4; border-radius: 14px; padding: 24px;
      border-left: 4px solid var(--accent-color);
      transition: box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
      cursor: pointer;
      display: flex; flex-direction: column; gap: 16px;
      min-height: 210px;
      &:hover {
        background: color-mix(in srgb, var(--accent-color) 10%, var(--artes-surface));
        box-shadow: 0 6px 20px color-mix(in srgb, var(--accent-color) 18%, transparent);
        border-color: color-mix(in srgb, var(--accent-color) 30%, #e8edf4);
        transform: translateY(-2px);
      }
      &.accent-low      { --accent-color: #27C4A0; }
      &.accent-medium   { --accent-color: #f0a500; }
      &.accent-high     { --accent-color: #e86c3a; }
      &.accent-critical { --accent-color: #e53e3e; }
    }
    .analysis-card-top { display: flex; align-items: flex-start; gap: 20px; }
    .mini-gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    app-mini-gauge { width: 80px; }
    .new-analysis-card {
      border: 2px dashed #d0d8e4; border-left-width: 2px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; cursor: pointer; min-height: 210px; color: #6b7c93;
      font-size: 15px;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      &:hover { border-color: var(--artes-accent); color: var(--artes-accent); background: rgba(58,159,214,0.04); }
    }
    .new-analysis-icon { font-size: 44px; width: 44px; height: 44px; }
    .analysis-meta { display: flex; flex-direction: column; gap: 7px; min-width: 0; flex: 1; }
    .meta-name { font-size: 17px; color: var(--artes-primary); strong { font-weight: 600; } }
    .meta-template { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--artes-accent); mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .meta-dept, .meta-period { display: flex; align-items: center; gap: 6px; font-size: 14px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #9aa5b4; } strong { color: var(--artes-primary); } }
    .meta-period { color: #5a6a7e; }
    .type-list {
      list-style: none;
      margin: 0; padding: 0;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .type-list-item {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px; font-weight: 600; text-transform: capitalize;
      background: #eef2f7; color: #4a5568;
      line-height: 1.3;
      max-width: 100%;
      cursor: help;
      mat-icon {
        font-size: 14px; width: 14px; height: 14px;
        line-height: 14px;
        flex-shrink: 0;
        color: #6b7c93;
        overflow: visible;
      }
      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    .escalated-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #e86c3a; font-weight: 600; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .analysis-card-actions { display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid #f0f4f8; }
    .delete-analysis-btn { color: #c5d0db; width: 38px; height: 38px; margin-left: auto; flex-shrink: 0; &:hover { color: #e53e3e !important; } }

  `],
})
export class ConflictAnalysisComponent implements OnInit {
  analyses = signal<ConflictAnalysis[]>([]);
  loading = signal(true);

  searchQuery = signal('');
  sort = signal<SortOption>('recent');

  /** Filtered + sorted view of analyses, recomputed when query/sort/data change. */
  filteredAnalyses = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = q
      ? this.analyses().filter((a) =>
          (a.name ?? '').toLowerCase().includes(q) ||
          (a.departmentId ?? '').toLowerCase().includes(q),
        )
      : this.analyses().slice();

    switch (this.sort()) {
      case 'risk-desc':
        return list.sort((a, b) =>
          (RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel]) || (b.riskScore - a.riskScore));
      case 'risk-asc':
        return list.sort((a, b) =>
          (RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel]) || (a.riskScore - b.riskScore));
      case 'name':
        return list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      case 'recent':
      default:
        return list.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
  });

  sortLabelKey = computed(() => SORT_LABEL_KEYS[this.sort()]);

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
    this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('CONFLICT.confirmDeleteAnalysisTitle'),
        message: this.translate.instant('CONFLICT.confirmDeleteAnalysisMessage', {
          name: a.name,
          dept: a.departmentId || this.translate.instant('COMMON.allDepartments'),
        }),
        confirmLabel: this.translate.instant('COMMON.delete'),
      },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.delete(`/conflict/analyses/${a._id}`).subscribe({
        next: () => {
          this.analyses.update((list) => list.filter((x) => x._id !== a._id));
          this.snackBar.open(this.translate.instant('CONFLICT.analysisDeleted'), this.translate.instant('COMMON.ok'), { duration: 3000 });
        },
      });
    });
  }

  runNewAnalysis(): void {
    const ref = this.dialog.open(ConflictAnalyzeDialogComponent, { width: '780px', maxWidth: '94vw', disableClose: true });
    ref.afterClosed().subscribe((result) => { if (result) this.loadAnalyses(); });
  }

  /** Pick a Material icon for a free-form conflict-type label returned by the AI. */
  parseType(raw: string) { return parseConflictType(raw); }

  typeIcon(type: string): string {
    const t = type.toLowerCase();
    if (t.includes('communication'))                            return 'forum';
    if (t.includes('role') || t.includes('ambig') || t.includes('clarity')) return 'help_outline';
    if (t.includes('leader') || t.includes('manage'))           return 'supervisor_account';
    if (t.includes('trust'))                                    return 'handshake';
    if (t.includes('psych') || t.includes('safety'))            return 'shield';
    if (t.includes('feel') || t.includes('emotion'))            return 'mood';
    if (t.includes('identity') || t.includes('belong') || t.includes('inclu')) return 'diversity_3';
    if (t.includes('workload') || t.includes('burnout') || t.includes('stress')) return 'hourglass_bottom';
    if (t.includes('process') || t.includes('procedure') || t.includes('structure')) return 'account_tree';
    if (t.includes('resource'))                                 return 'inventory_2';
    if (t.includes('recogn') || t.includes('reward'))           return 'emoji_events';
    if (t.includes('feedback'))                                 return 'rate_review';
    if (t.includes('change') || t.includes('transition'))       return 'sync_alt';
    if (t.includes('power') || t.includes('politic'))           return 'gavel';
    if (t.includes('value') || t.includes('culture'))           return 'compass_calibration';
    if (t.includes('team') || t.includes('collab'))             return 'groups';
    if (t.includes('workflow') || t.includes('task'))           return 'task_alt';
    if (t.includes('goal') || t.includes('mission'))            return 'flag';
    return 'label';
  }
}

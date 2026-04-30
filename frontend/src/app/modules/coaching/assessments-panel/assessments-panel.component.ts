import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import {
  AssessmentDialogComponent,
  AssessmentDialogData,
  AssessmentRecord,
} from '../assessment-dialog/assessment-dialog.component';
import {
  AssessmentComparisonDialogComponent,
  AssessmentComparisonDialogData,
} from '../assessment-comparison-dialog/assessment-comparison-dialog.component';

const PHASES_ORDER: AssessmentRecord['phase'][] = ['baseline', 'midpoint', 'final', 'ad_hoc'];

interface PhaseGroup {
  phase: AssessmentRecord['phase'];
  records: AssessmentRecord[];
}

@Component({
  selector: 'app-assessments-panel',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatDialogModule, MatTooltipModule, MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="panel">
      <div class="panel-header">
        <h3>
          <mat-icon>assessment</mat-icon>
          {{ 'COACHING.assessmentsPanelTitle' | translate }}
          <span class="count">{{ records().length }}</span>
        </h3>
        @if (canManage) {
          <div class="header-actions">
            @for (group of comparableGroups(); track group.type) {
              <button mat-stroked-button (click)="compare(group.type)">
                <mat-icon>compare_arrows</mat-icon>
                {{ 'COACHING.compareLabel' | translate:{ type: typeLabel(group.type) } }}
              </button>
            }
            <button mat-raised-button color="primary" (click)="openCreate()">
              <mat-icon>add</mat-icon> {{ 'COACHING.newAssessment' | translate }}
            </button>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="28"/></div>
      } @else if (records().length === 0) {
        <div class="empty">
          <mat-icon>assessment</mat-icon>
          <p>{{ 'COACHING.noAssessments' | translate }}</p>
          @if (canManage) {
            <button mat-stroked-button (click)="openCreate()">
              <mat-icon>add</mat-icon> {{ 'COACHING.recordFirstAssessment' | translate }}
            </button>
          }
        </div>
      } @else {
        @for (group of groups(); track group.phase) {
          <div class="phase-block">
            <h4 class="phase-h">
              <mat-icon>{{ phaseIcon(group.phase) }}</mat-icon>
              {{ ('COACHING.phase_' + group.phase) | translate }}
              <span class="phase-count">{{ group.records.length }}</span>
            </h4>
            <div class="cards">
              @for (r of group.records; track r._id) {
                <div class="card" (click)="openEdit(r)">
                  <div class="card-top">
                    <span class="type-chip">{{ typeLabel(r.assessmentType) }}</span>
                    @if (r.pdfFilename) {
                      <mat-icon class="pdf-icon" [matTooltip]="r.pdfFilename">picture_as_pdf</mat-icon>
                    }
                  </div>
                  <div class="card-title">
                    {{ r.assessmentLabel || typeLabel(r.assessmentType) }}
                  </div>
                  <div class="card-meta">
                    <span>{{ r.administeredAt | date:'mediumDate' }}</span>
                    <span class="dot">·</span>
                    <span>{{ scoreCount(r) }} {{ 'COACHING.dimensions' | translate }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .panel {
      background: white; border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      padding: 20px 24px; margin-top: 16px;
    }
    .panel-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
      h3 { display: flex; align-items: center; gap: 8px; margin: 0;
        font-size: 16px; color: var(--artes-primary);
        mat-icon { color: var(--artes-accent); }
        .count { font-size: 12px; color: #9aa5b4; font-weight: 500; }
      }
    }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .loading { display: flex; justify-content: center; padding: 32px; }
    .empty {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 32px 20px; color: #8fa4c0; text-align: center;
      > mat-icon { font-size: 36px; width: 36px; height: 36px; color: #c0ccdb; }
      p { margin: 0; font-size: 14px; }
    }

    .phase-block { margin-bottom: 16px; }
    .phase-h {
      display: flex; align-items: center; gap: 6px; margin: 12px 0 8px;
      font-size: 12px; color: var(--artes-primary); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--artes-accent); }
      .phase-count { font-size: 11px; color: #9aa5b4; font-weight: 500; letter-spacing: 0; }
    }
    .cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .card {
      background: #fafcff; border: 1px solid #e5edf5; border-radius: 10px;
      padding: 12px 14px; cursor: pointer; transition: box-shadow 0.15s, border-color 0.15s;
      &:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.06); border-color: var(--artes-accent); }
    }
    .card-top { display: flex; align-items: center; justify-content: space-between; }
    .type-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      background: rgba(58,159,214,0.10); color: #2080b0; padding: 2px 8px; border-radius: 999px;
    }
    .pdf-icon { font-size: 18px; width: 18px; height: 18px; color: #c53030; }
    .card-title { font-size: 14px; font-weight: 600; color: var(--artes-primary); margin: 6px 0 4px; }
    .card-meta { font-size: 11px; color: #8fa4c0; display: flex; gap: 4px; align-items: center; }
    .dot { color: #cbd5e0; }
  `],
})
export class AssessmentsPanelComponent implements OnInit, OnChanges {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  @Input({ required: true }) engagementId!: string;
  /** When true, shows New / Edit / Compare actions. False = read-only view (e.g. coachee). */
  @Input() canManage = false;

  loading = signal(true);
  records = signal<AssessmentRecord[]>([]);

  /** Records grouped by phase, ordered baseline → midpoint → final → ad_hoc.
   *  Within a phase, most-recent first. */
  groups = computed<PhaseGroup[]>(() => {
    const byPhase = new Map<AssessmentRecord['phase'], AssessmentRecord[]>();
    for (const r of this.records()) {
      if (!byPhase.has(r.phase)) byPhase.set(r.phase, []);
      byPhase.get(r.phase)!.push(r);
    }
    return PHASES_ORDER
      .filter((p) => byPhase.has(p))
      .map((phase) => ({
        phase,
        records: (byPhase.get(phase) || []).slice().sort(
          (a, b) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime(),
        ),
      }));
  });

  /** Assessment types where ≥2 records exist on this engagement — those can
   *  be compared pre/post. Reuses the whole records list. */
  comparableGroups = computed(() => {
    const counts = new Map<string, number>();
    for (const r of this.records()) counts.set(r.assessmentType, (counts.get(r.assessmentType) ?? 0) + 1);
    return Array.from(counts.entries())
      .filter(([, n]) => n >= 2)
      .map(([type, n]) => ({ type, n }));
  });

  ngOnInit(): void { this.load(); }

  ngOnChanges(c: SimpleChanges): void {
    if (c['engagementId'] && !c['engagementId'].firstChange) this.load();
  }

  private load() {
    if (!this.engagementId) return;
    this.loading.set(true);
    this.api.get<AssessmentRecord[]>(`/assessments?engagementId=${this.engagementId}`).subscribe({
      next: (rs) => { this.records.set(rs); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.snack.open(this.translate.instant('COACHING.assessmentsLoadFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 });
      },
    });
  }

  openCreate() {
    const ref = this.dialog.open<AssessmentDialogComponent, AssessmentDialogData, AssessmentRecord | 'deleted' | undefined>(
      AssessmentDialogComponent,
      { width: '760px', maxWidth: '95vw', maxHeight: '90vh', disableClose: true,
        data: { engagementId: this.engagementId } },
    );
    ref.afterClosed().subscribe((result) => { if (result) this.load(); });
  }

  openEdit(r: AssessmentRecord) {
    const ref = this.dialog.open<AssessmentDialogComponent, AssessmentDialogData, AssessmentRecord | 'deleted' | undefined>(
      AssessmentDialogComponent,
      { width: '760px', maxWidth: '95vw', maxHeight: '90vh', disableClose: true,
        data: { engagementId: this.engagementId, record: r } },
    );
    ref.afterClosed().subscribe((result) => { if (result) this.load(); });
  }

  compare(type: string) {
    const subset = this.records().filter((r) => r.assessmentType === type);
    if (subset.length < 2) return;
    this.dialog.open<AssessmentComparisonDialogComponent, AssessmentComparisonDialogData>(
      AssessmentComparisonDialogComponent,
      { width: '900px', maxWidth: '96vw', maxHeight: '90vh', data: { records: subset } },
    );
  }

  scoreCount(r: AssessmentRecord): number { return Object.keys(r.scores ?? {}).length; }

  phaseIcon(p: AssessmentRecord['phase']): string {
    const map: Record<string, string> = {
      baseline: 'flag', midpoint: 'timeline', final: 'emoji_events', ad_hoc: 'event_note',
    };
    return map[p] ?? 'event_note';
  }

  typeLabel(t: string): string {
    const map: Record<string, string> = {
      'eq-i': 'EQ-i 2.0', disc: 'DISC', hogan: 'Hogan',
      leadership_circle: 'Leadership Circle', mbti: 'MBTI',
      '360': '360', cliftonstrengths: 'CliftonStrengths', tki: 'TKI',
      custom: this.translate.instant('COACHING.typeCustom'),
    };
    return map[t] ?? t;
  }
}

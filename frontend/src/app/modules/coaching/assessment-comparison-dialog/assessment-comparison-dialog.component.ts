import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';
import { AssessmentRecord } from '../assessment-dialog/assessment-dialog.component';

export interface AssessmentComparisonDialogData {
  records: AssessmentRecord[];   // pre-filtered to a single assessmentType
  initialBaselineId?: string;
  initialFinalId?: string;
}

interface DimensionRow {
  key: string;
  baseline: number | null;
  final: number | null;
  delta: number | null;
}

@Component({
  selector: 'app-assessment-comparison-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    MatDialogModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule,
    TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>compare_arrows</mat-icon>
      {{ 'COACHING.assessmentComparisonTitle' | translate }}
      <span class="type-chip">{{ typeLabel() }}</span>
    </h2>

    <mat-dialog-content>
      <div class="picker-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.baselineRecord' | translate }}</mat-label>
          <mat-select [ngModel]="baselineId()" (ngModelChange)="baselineId.set($event)">
            @for (r of data.records; track r._id) {
              <mat-option [value]="r._id" [disabled]="r._id === finalId()">
                {{ phaseLabel(r.phase) }} · {{ r.administeredAt | date:'mediumDate' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-icon class="arrow">arrow_forward</mat-icon>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.finalRecord' | translate }}</mat-label>
          <mat-select [ngModel]="finalId()" (ngModelChange)="finalId.set($event)">
            @for (r of data.records; track r._id) {
              <mat-option [value]="r._id" [disabled]="r._id === baselineId()">
                {{ phaseLabel(r.phase) }} · {{ r.administeredAt | date:'mediumDate' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (rows().length === 0) {
        <div class="empty">{{ 'COACHING.noComparableScores' | translate }}</div>
      } @else {
        <table class="comp-table">
          <thead>
            <tr>
              <th>{{ 'COACHING.dimension' | translate }}</th>
              <th class="num">{{ 'COACHING.baseline' | translate }}</th>
              <th class="num">{{ 'COACHING.final' | translate }}</th>
              <th class="bars">{{ 'COACHING.distribution' | translate }}</th>
              <th class="num">{{ 'COACHING.delta' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.key) {
              <tr>
                <td class="dim">{{ r.key }}</td>
                <td class="num">{{ formatScore(r.baseline) }}</td>
                <td class="num">{{ formatScore(r.final) }}</td>
                <td class="bars">
                  <div class="bar-track">
                    <div class="bar baseline" [style.width.%]="barPct(r.baseline)"></div>
                    <div class="bar final" [style.width.%]="barPct(r.final)"></div>
                  </div>
                </td>
                <td class="num delta" [class.up]="(r.delta ?? 0) > 0" [class.down]="(r.delta ?? 0) < 0">
                  @if (r.delta === null) { — }
                  @else if (r.delta > 0) { +{{ formatScore(r.delta) }} }
                  @else { {{ formatScore(r.delta) }} }
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="legend">
          <span class="leg baseline"></span>{{ 'COACHING.baseline' | translate }}
          <span class="leg final"></span>{{ 'COACHING.final' | translate }}
          @if (scaleNote()) { <span class="scale-note">{{ scaleNote() }}</span> }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); } }
    .type-chip {
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px;
      background: rgba(58,159,214,0.10); color: #2080b0; padding: 2px 10px; border-radius: 999px;
    }
    mat-dialog-content { min-width: 720px; max-width: 900px; max-height: 78vh; padding-top: 8px !important; }

    .picker-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
      mat-form-field { flex: 1 1 0; min-width: 0; }
      .arrow { color: var(--artes-accent); }
    }
    .empty { padding: 24px; text-align: center; color: #8fa4c0; font-size: 14px; }

    .comp-table {
      width: 100%; border-collapse: collapse;
      th, td { padding: 8px 10px; border-bottom: 1px solid #eef2f7; vertical-align: middle; font-size: 13px; }
      th { text-align: left; text-transform: uppercase; letter-spacing: 0.4px;
        font-size: 11px; color: #8fa4c0; font-weight: 700; }
      td.num, th.num { text-align: right; }
      td.dim { font-weight: 600; color: var(--artes-primary); }
      td.bars { width: 36%; min-width: 200px; }
    }
    .bar-track {
      position: relative; background: #f1f5f9; height: 14px; border-radius: 7px; overflow: hidden;
    }
    .bar {
      position: absolute; left: 0; top: 0; height: 7px;
      &.baseline { background: #c0d6ed; top: 0; }
      &.final    { background: var(--artes-accent); top: 7px; }
    }
    .delta.up   { color: #1a9678; font-weight: 700; }
    .delta.down { color: #c53030; font-weight: 700; }

    .legend {
      display: flex; align-items: center; gap: 12px; margin-top: 12px;
      font-size: 12px; color: #5a6a7e;
      .leg { display: inline-block; width: 14px; height: 8px; border-radius: 2px;
        &.baseline { background: #c0d6ed; }
        &.final    { background: var(--artes-accent); }
      }
      .scale-note { margin-left: auto; color: #8fa4c0; font-style: italic; }
    }
  `],
})
export class AssessmentComparisonDialogComponent implements OnInit {
  private translate = inject(TranslateService);
  dialogRef = inject(MatDialogRef<AssessmentComparisonDialogComponent>);
  data = inject<AssessmentComparisonDialogData>(MAT_DIALOG_DATA);

  baselineId = signal<string>('');
  finalId    = signal<string>('');

  ngOnInit(): void {
    // Default: earliest record as baseline, latest as final.
    const sorted = [...this.data.records].sort(
      (a, b) => new Date(a.administeredAt).getTime() - new Date(b.administeredAt).getTime(),
    );
    this.baselineId.set(this.data.initialBaselineId ?? sorted[0]?._id ?? '');
    this.finalId.set(this.data.initialFinalId ?? sorted[sorted.length - 1]?._id ?? '');
  }

  baseline = computed(() => this.data.records.find((r) => r._id === this.baselineId()) ?? null);
  final    = computed(() => this.data.records.find((r) => r._id === this.finalId()) ?? null);

  /** Union of dimension keys across both records, ordered baseline-first. */
  rows = computed<DimensionRow[]>(() => {
    const b = this.baseline(); const f = this.final();
    if (!b || !f || b._id === f._id) return [];
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const k of Object.keys(b.scores ?? {})) { if (!seen.has(k)) { keys.push(k); seen.add(k); } }
    for (const k of Object.keys(f.scores ?? {})) { if (!seen.has(k)) { keys.push(k); seen.add(k); } }
    return keys.map<DimensionRow>((k) => {
      const bv = b.scores?.[k] ?? null;
      const fv = f.scores?.[k] ?? null;
      const delta = (typeof bv === 'number' && typeof fv === 'number') ? +(fv - bv).toFixed(2) : null;
      return { key: k, baseline: bv, final: fv, delta };
    });
  });

  /** Bar percentage. Use scoresMeta.scaleMin/Max from either record if available;
   *  otherwise the empirical max across all values in the table. */
  barPct(value: number | null): number {
    if (value === null || !Number.isFinite(value)) return 0;
    const meta = this.final()?.scoresMeta ?? this.baseline()?.scoresMeta;
    const min = meta?.scaleMin ?? this.empiricalMin();
    const max = meta?.scaleMax ?? this.empiricalMax();
    if (max === null || min === null || max === min) return 0;
    const pct = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  private empiricalValues(): number[] {
    const out: number[] = [];
    for (const r of this.rows()) {
      if (r.baseline !== null) out.push(r.baseline);
      if (r.final !== null) out.push(r.final);
    }
    return out;
  }
  empiricalMin(): number | null { const vs = this.empiricalValues(); return vs.length ? Math.min(...vs, 0) : null; }
  empiricalMax(): number | null { const vs = this.empiricalValues(); return vs.length ? Math.max(...vs) : null; }

  scaleNote(): string {
    const meta = this.final()?.scoresMeta ?? this.baseline()?.scoresMeta;
    if (!meta) return '';
    const parts: string[] = [];
    if (meta.unit) parts.push(this.translate.instant(`COACHING.unit_${meta.unit}`, { defaultValue: meta.unit }));
    if (typeof meta.scaleMin === 'number' && typeof meta.scaleMax === 'number') {
      parts.push(`${meta.scaleMin}–${meta.scaleMax}`);
    }
    if (meta.normGroup) parts.push(meta.normGroup);
    return parts.join(' · ');
  }

  formatScore(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '—';
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }

  phaseLabel(p: string): string { return this.translate.instant(`COACHING.phase_${p}`); }
  typeLabel(): string {
    const t = this.data.records[0]?.assessmentType ?? '';
    const map: Record<string, string> = {
      'eq-i': 'EQ-i 2.0', disc: 'DISC', hogan: 'Hogan',
      leadership_circle: 'Leadership Circle', mbti: 'MBTI',
      '360': '360', cliftonstrengths: 'CliftonStrengths', tki: 'TKI',
      custom: this.translate.instant('COACHING.typeCustom'),
    };
    return map[t] ?? t;
  }
}

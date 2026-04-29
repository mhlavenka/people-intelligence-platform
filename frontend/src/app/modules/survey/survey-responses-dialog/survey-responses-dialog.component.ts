import { Component, OnInit, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/api.service';
import { TranslateModule } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface Question {
  id: string;
  text: string;
  type: 'scale' | 'boolean' | 'text';
  category: string;
}

export interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: string;
  intakeType?: 'survey' | 'interview' | 'assessment';
  minResponsesForAnalysis?: number;
  questions: Question[];
}

/** Dialog input. Either a bare template (legacy callers) or a wrapper
 *  carrying optional scoping:
 *   - sessionId        — show responses for one pre-session intake session
 *   - departmentFilter — only responses tagged with this departmentId
 *  Bare template form may also carry departmentFilter inline as a hint. */
export type SurveyResponsesDialogData =
  | (SurveyTemplate & { departmentFilter?: string })
  | { template: SurveyTemplate; sessionId?: string; departmentFilter?: string };

interface RawResponse {
  departmentId?: string;
  cycle?: string;                            // cycle stamp from a recurring fire
  responses: { questionId: string; value: string | number | boolean }[];
  submittedAt: string;
}

interface ScaleBucket { value: number; count: number; pct: number; }

interface QuestionStats {
  question: Question;
  answeredCount: number;
  skippedCount: number;
  // scale
  average?: number;
  min?: number;
  max?: number;
  scaleMax?: number;
  distribution?: ScaleBucket[];
  // boolean
  yesCount?: number;
  yesPct?: number;
  noCount?: number;
  noPct?: number;
  // text
  textAnswers?: string[];
}

interface DeptBreakdown { dept: string; count: number; pct: number; }

@Component({
  selector: 'app-survey-responses-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslateModule,
    DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <div class="dialog-header">
      <div class="header-left">
        <mat-icon class="header-icon">bar_chart</mat-icon>
        <div>
          <h2>{{ template.title }}</h2>
          <span class="module-badge" [class]="template.moduleType">{{ template.moduleType }}</span>
        </div>
      </div>
    </div>

    <mat-dialog-content>

      @if (loading()) {
        <div class="center-state">
          <mat-spinner diameter="40" />
          <p>{{ 'COMMON.loading' | translate }}</p>
        </div>
      }

      @else if (tooFew()) {
        <div class="center-state">
          <div class="lock-circle"><mat-icon>lock</mat-icon></div>
          <h3>{{ 'SURVEY.notEnoughResponses' | translate }}</h3>
          <p>A minimum of <strong>{{ minRequired() }} response{{ minRequired() === 1 ? '' : 's' }}</strong> is required before results are shown.</p>
          <div class="count-pill">{{ actualCount() }} / {{ minRequired() }} responses collected</div>
        </div>
      }

      @else if (errorMsg()) {
        <div class="center-state">
          <mat-icon class="err-icon">error_outline</mat-icon>
          <p>{{ errorMsg() }}</p>
        </div>
      }

      @else {
        <!-- Filters -->
        @if (availableDepts().length > 1 || availableCycles().length > 0) {
          <div class="resp-filter-bar">
            @if (availableDepts().length > 1) {
              <mat-form-field appearance="outline" class="filter-fld">
                <mat-label>{{ 'SURVEY.filterByDept' | translate }}</mat-label>
                <mat-select [(ngModel)]="deptFilter" (selectionChange)="onFilterChange()">
                  <mat-option value="">{{ 'SURVEY.filterAllDepts' | translate }}</mat-option>
                  @for (d of availableDepts(); track d) {
                    <mat-option [value]="d">{{ d }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            @if (availableCycles().length > 0) {
              <mat-form-field appearance="outline" class="filter-fld">
                <mat-label>{{ 'SURVEY.filterByCycle' | translate }}</mat-label>
                <mat-select [(ngModel)]="cycleFilter" (selectionChange)="onFilterChange()">
                  <mat-option value="">{{ 'SURVEY.filterAllCycles' | translate }}</mat-option>
                  @for (c of availableCycles(); track c) {
                    <mat-option [value]="c">{{ c }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            @if (deptFilter || cycleFilter) {
              <button mat-stroked-button (click)="resetFilters()" class="reset-btn">
                <mat-icon>clear</mat-icon> {{ 'SURVEY.filterReset' | translate }}
              </button>
            }
          </div>
        }

        <!-- Overview -->
        <div class="overview-row">
          <div class="ov-stat">
            <div class="ov-value">{{ totalCount() }}</div>
            <div class="ov-label">{{ 'SURVEY.responses' | translate }}</div>
          </div>
          <div class="ov-stat">
            <div class="ov-value">{{ template.questions.length }}</div>
            <div class="ov-label">{{ 'SURVEY.questions' | translate }}</div>
          </div>
          <div class="ov-stat">
            <div class="ov-value small">{{ dateRange() }}</div>
            <div class="ov-label">{{ 'SURVEY.dateRange' | translate }}</div>
          </div>
          <div class="ov-stat">
            <div class="ov-value privacy"><mat-icon>shield</mat-icon> {{ 'SURVEY.anonymous' | translate }}</div>
            <div class="ov-label">{{ 'SURVEY.dataAnonymised' | translate }}</div>
          </div>
        </div>

        <!-- Department breakdown -->
        @if (deptBreakdown().length > 1) {
          <div class="section-wrap">
            <div class="section-label">{{ 'ADMIN.byDepartment' | translate }}</div>
            @for (d of deptBreakdown(); track d.dept) {
              <div class="dept-row">
                <span class="dept-name">{{ d.dept }}</span>
                <div class="bar-track">
                  <div class="bar-fill blue" [style.width.%]="d.pct"></div>
                </div>
                <span class="dept-count">{{ d.count }} ({{ d.pct | number:'1.0-0' }}%)</span>
              </div>
            }
          </div>
          <mat-divider />
        }

        <!-- Per-question results -->
        <div class="section-wrap">
          <div class="section-label">{{ 'SURVEY.questionResults' | translate }}</div>
          @for (qs of stats(); track qs.question.id) {
            <div class="q-block">
              <div class="q-meta">
                <span class="cat-chip">{{ qs.question.category }}</span>
                <span class="type-chip">{{ qs.question.type }}</span>
                <span class="answered-lbl">{{ qs.answeredCount }}/{{ totalCount() }} answered</span>
              </div>
              <div class="q-text">{{ qs.question.text }}</div>

              <!-- Scale -->
              @if (qs.question.type === 'scale' && qs.distribution) {
                <div class="scale-wrap">
                  <div class="avg-block" [style.color]="avgColor(qs.average ?? 0, qs.scaleMax ?? 5)">
                    <span class="avg-num">{{ qs.average | number:'1.1-1' }}</span>
                    <span class="avg-denom">/{{ qs.scaleMax }}</span>
                    <div class="avg-sub">avg &bull; range {{ qs.min }}–{{ qs.max }}</div>
                  </div>
                  <div class="dist-bars">
                    @for (b of qs.distribution; track b.value) {
                      <div class="dist-row">
                        <span class="dist-val">{{ b.value }}</span>
                        <div class="bar-track">
                          <div class="bar-fill"
                               [style.width.%]="b.pct"
                               [style.background]="avgColor(b.value, qs.scaleMax ?? 5)">
                          </div>
                        </div>
                        <span class="dist-count">{{ b.count }} <span class="muted">({{ b.pct | number:'1.0-0' }}%)</span></span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Boolean -->
              @if (qs.question.type === 'boolean') {
                <div class="bool-wrap">
                  <div class="bool-row">
                    <mat-icon class="yes-icon">check_circle</mat-icon>
                    <span class="bool-lbl">Yes</span>
                    <div class="bar-track">
                      <div class="bar-fill green" [style.width.%]="qs.yesPct ?? 0"></div>
                    </div>
                    <span class="bool-count">{{ qs.yesCount }} <span class="muted">({{ qs.yesPct | number:'1.0-0' }}%)</span></span>
                  </div>
                  <div class="bool-row">
                    <mat-icon class="no-icon">cancel</mat-icon>
                    <span class="bool-lbl">No</span>
                    <div class="bar-track">
                      <div class="bar-fill red" [style.width.%]="qs.noPct ?? 0"></div>
                    </div>
                    <span class="bool-count">{{ qs.noCount }} <span class="muted">({{ qs.noPct | number:'1.0-0' }}%)</span></span>
                  </div>
                </div>
              }

              <!-- Text -->
              @if (qs.question.type === 'text') {
                <div class="text-wrap">
                  @if (!qs.textAnswers?.length) {
                    <p class="muted">No written answers provided.</p>
                  } @else {
                    @for (ans of qs.textAnswers; track ans) {
                      <div class="text-answer">"{{ ans }}"</div>
                    }
                  }
                </div>
              }

              @if (qs.skippedCount > 0) {
                <div class="skipped-note">
                  {{ qs.skippedCount }} respondent{{ qs.skippedCount > 1 ? 's' : '' }} skipped this question
                </div>
              }
            </div>
            <mat-divider />
          }
        </div>
      }

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'COMMON.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px; border-bottom: 1px solid #edf2f7;
    }
    .header-left {
      display: flex; align-items: center; gap: 14px;
      .header-icon { font-size: 28px; width: 28px; height: 28px; color: var(--artes-accent); }
      h2 { font-size: 18px; color: var(--artes-primary); margin: 0 0 4px; font-weight: 700; }
    }
    .module-badge {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      &.conflict       { background: rgba(232,108,58,0.12); color: #c04a14; }
      &.neuroinclusion { background: rgba(39,196,160,0.12);  color: #1a9678; }
      &.succession     { background: rgba(58,159,214,0.12);  color: #2080b0; }
      &.coaching       { background: rgba(124,92,191,0.12);  color: #5e3fa8; }
    }

    mat-dialog-content {
      min-width: 580px; max-width: 700px; max-height: 72vh;
      padding: 0 !important; overflow-y: auto;
    }

    .center-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 40px; text-align: center; gap: 12px;
      h3 { font-size: 18px; color: var(--artes-primary); margin: 0; }
      p  { font-size: 14px; color: #5a6a7e; margin: 0; max-width: 340px; line-height: 1.5; }
    }
    .lock-circle {
      width: 64px; height: 64px; border-radius: 50%; background: #f0f4f8;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #9aa5b4; }
    }
    .err-icon { font-size: 40px; width: 40px; height: 40px; color: #e53e3e; }
    .count-pill {
      padding: 8px 20px; border-radius: 999px; background: #f0f4f8;
      font-size: 14px; font-weight: 600; color: #5a6a7e;
    }

    .resp-filter-bar {
      display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
      padding: 12px 20px 4px;
      border-bottom: 1px solid #edf2f7;
    }
    .filter-fld { min-width: 200px; flex: 1; max-width: 280px; }
    .resp-filter-bar ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .reset-btn { margin-bottom: 22px; }

    .overview-row {
      display: grid; grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid #edf2f7;
    }
    .ov-stat {
      padding: 18px 12px; text-align: center; border-right: 1px solid #edf2f7;
      &:last-child { border-right: none; }
      .ov-value { font-size: 22px; font-weight: 700; color: var(--artes-primary); margin-bottom: 4px;
        &.small { font-size: 13px; font-weight: 600; }
        &.privacy { display: flex; align-items: center; justify-content: center; gap: 4px;
          font-size: 13px; color: #27C4A0; font-weight: 600;
          mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      }
      .ov-label { font-size: 11px; color: #9aa5b4; }
    }

    .section-wrap { padding: 16px 24px; }
    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #9aa5b4; margin-bottom: 12px;
    }

    /* Dept */
    .dept-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
      .dept-name  { width: 120px; font-size: 13px; color: var(--artes-primary); flex-shrink: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dept-count { width: 80px; font-size: 12px; color: #9aa5b4; text-align: right; flex-shrink: 0; }
    }

    /* Shared bar */
    .bar-track {
      flex: 1; height: 14px; background: #edf2f7; border-radius: 99px; overflow: hidden;
    }
    .bar-fill {
      height: 100%; border-radius: 99px; min-width: 2px; transition: width 0.4s ease;
      &.blue  { background: var(--artes-accent); }
      &.green { background: #27C4A0; }
      &.red   { background: #e86c3a; }
    }

    /* Question block */
    .q-block { padding: 16px 0; }
    .q-meta {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;
    }
    .cat-chip {
      padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
      background: rgba(58,159,214,0.1); color: #2080b0;
    }
    .type-chip {
      padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; background: #f0f4f8; color: #5a6a7e;
    }
    .answered-lbl { font-size: 11px; color: #9aa5b4; margin-left: auto; }
    .q-text { font-size: 14px; font-weight: 600; color: var(--artes-primary); margin-bottom: 14px; line-height: 1.4; }

    /* Scale */
    .scale-wrap { display: flex; gap: 24px; align-items: flex-start; }
    .avg-block {
      display: flex; flex-direction: column; align-items: center; min-width: 80px;
      .avg-num  { font-size: 32px; font-weight: 800; line-height: 1; }
      .avg-denom { font-size: 16px; color: #9aa5b4; }
      .avg-sub  { font-size: 11px; color: #9aa5b4; margin-top: 6px; text-align: center; }
    }
    .dist-bars { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .dist-row {
      display: flex; align-items: center; gap: 8px;
      .dist-val   { width: 20px; font-size: 12px; font-weight: 600; color: #5a6a7e; text-align: right; flex-shrink: 0; }
      .dist-count { width: 60px; font-size: 12px; color: #5a6a7e; flex-shrink: 0; }
    }
    .bar-track { height: 18px; border-radius: 4px; }
    .dist-bars .bar-fill { border-radius: 4px; }

    /* Boolean */
    .bool-wrap { display: flex; flex-direction: column; gap: 10px; }
    .bool-row {
      display: flex; align-items: center; gap: 10px;
      .bool-lbl   { width: 28px; font-size: 13px; font-weight: 600; color: var(--artes-primary); flex-shrink: 0; }
      .bool-count { width: 70px; font-size: 13px; color: #5a6a7e; flex-shrink: 0; }
    }
    .yes-icon { color: #27C4A0; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .no-icon  { color: #e86c3a; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    /* Text */
    .text-wrap { display: flex; flex-direction: column; gap: 6px; }
    .text-answer {
      padding: 10px 14px; background: #f8fafc; border-left: 3px solid var(--artes-accent);
      border-radius: 0 6px 6px 0; font-size: 13px; color: #374151;
      font-style: italic; line-height: 1.5;
    }

    .skipped-note { margin-top: 8px; font-size: 11px; color: #9aa5b4; font-style: italic; }
    .muted { color: #9aa5b4; }

    mat-dialog-actions { padding: 12px 24px; border-top: 1px solid #edf2f7; }
  `],
})
export class SurveyResponsesDialogComponent implements OnInit {
  loading   = signal(true);
  tooFew    = signal(false);
  errorMsg  = signal('');
  actualCount = signal(0);
  minRequired = signal(5);
  totalCount  = signal(0);
  dateRange   = signal('');
  stats       = signal<QuestionStats[]>([]);
  deptBreakdown = signal<DeptBreakdown[]>([]);

  /** All responses returned by the server. Filters work over this set
   *  client-side; recomputeFromFilters() refreshes the derived signals. */
  rawResponses = signal<RawResponse[]>([]);

  /** Filter state — bound to the dropdowns via ngModel. */
  deptFilter  = '';                   // empty = all
  cycleFilter = '';                   // empty = all

  /** Distinct values present in the loaded responses, used to populate the
   *  dropdowns. */
  availableDepts  = computed(() => {
    const set = new Set<string>();
    for (const r of this.rawResponses()) {
      if (r.departmentId) set.add(r.departmentId);
    }
    return [...set].sort();
  });
  availableCycles = computed(() => {
    const set = new Set<string>();
    for (const r of this.rawResponses()) {
      if (r.cycle) set.add(r.cycle);
    }
    return [...set].sort().reverse();   // newest cycle first
  });

  template!: SurveyTemplate;
  sessionId?: string;
  departmentFilter?: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: SurveyResponsesDialogData,
    public dialogRef: MatDialogRef<SurveyResponsesDialogComponent>,
    private api: ApiService,
  ) {
    if ('template' in (this.data as { template?: SurveyTemplate })) {
      const wrapped = this.data as { template: SurveyTemplate; sessionId?: string; departmentFilter?: string };
      this.template = wrapped.template;
      this.sessionId = wrapped.sessionId;
      this.departmentFilter = wrapped.departmentFilter;
    } else {
      // Plain template object — may carry an inline departmentFilter prop
      // when callers don't wrap (e.g. conflict-detail).
      this.template = this.data as SurveyTemplate;
      this.departmentFilter = (this.data as SurveyTemplate & { departmentFilter?: string }).departmentFilter;
    }
  }

  ngOnInit(): void {
    this.minRequired.set(
      this.sessionId
        ? 1
        : this.template.minResponsesForAnalysis
          ?? (this.template.intakeType && this.template.intakeType !== 'survey' ? 1 : 5),
    );
    const params = new URLSearchParams();
    if (this.sessionId) params.set('sessionId', this.sessionId);
    if (this.departmentFilter) params.set('departmentId', this.departmentFilter);
    const qs = params.toString();
    const url = `/surveys/responses/${this.template._id}${qs ? '?' + qs : ''}`;
    this.api.get<{ count: number; responses: RawResponse[] }>(url).subscribe({
      next: (data) => {
        this.rawResponses.set(data.responses);
        this.recomputeFromFilters();
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 403) {
          const match = /Current: (\d+)/.exec((err.error?.error ?? '') as string);
          this.actualCount.set(match ? parseInt(match[1], 10) : 0);
          this.tooFew.set(true);
        } else {
          this.errorMsg.set((err.error?.error ?? 'Failed to load responses.') as string);
        }
      },
    });
  }

  /** Apply the active dept + cycle filters and refresh derived stats. */
  recomputeFromFilters(): void {
    const dept = this.deptFilter;
    const cycle = this.cycleFilter;
    const filtered = this.rawResponses().filter((r) => {
      if (dept  && r.departmentId !== dept) return false;
      if (cycle && r.cycle !== cycle) return false;
      return true;
    });
    this.totalCount.set(filtered.length);
    this.dateRange.set(this.buildDateRange(filtered));
    this.deptBreakdown.set(this.buildDeptBreakdown(filtered));
    this.stats.set(this.buildStats(filtered));
  }

  /** Triggered when the user changes a filter dropdown. */
  onFilterChange(): void { this.recomputeFromFilters(); }

  resetFilters(): void {
    this.deptFilter = '';
    this.cycleFilter = '';
    this.recomputeFromFilters();
  }

  avgColor(avg: number, max: number): string {
    const ratio = avg / max;
    if (ratio >= 0.75) return '#27C4A0';
    if (ratio >= 0.55) return '#f0a500';
    return '#e86c3a';
  }

  private buildDateRange(responses: RawResponse[]): string {
    if (!responses.length) return '—';
    const times = responses.map((r) => new Date(r.submittedAt).getTime());
    const fmt = (d: Date) => d.toLocaleDateString(localStorage.getItem('artes_language') || 'en', { day: 'numeric', month: 'short', year: 'numeric' });
    const earliest = new Date(Math.min(...times));
    const latest   = new Date(Math.max(...times));
    return earliest.getTime() === latest.getTime() ? fmt(earliest) : `${fmt(earliest)} – ${fmt(latest)}`;
  }

  private buildDeptBreakdown(responses: RawResponse[]): DeptBreakdown[] {
    const counts: Record<string, number> = {};
    for (const r of responses) {
      const key = r.departmentId || 'Unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const total = responses.length;
    return Object.entries(counts)
      .map(([dept, count]) => ({ dept, count, pct: total ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  private buildStats(responses: RawResponse[]): QuestionStats[] {
    return this.template.questions.map((q) => {
      const rawValues = responses.map((r) => r.responses.find((ri) => ri.questionId === q.id)?.value);
      const defined   = rawValues.filter((v): v is string | number | boolean => v !== undefined && v !== null);
      const answered  = defined.filter((v) => v !== '').length;
      const skipped   = responses.length - answered;

      if (q.type === 'scale') {
        const nums = defined.map((v) => Number(v)).filter((n) => !isNaN(n));
        if (!nums.length) return { question: q, answeredCount: answered, skippedCount: skipped };
        const sum      = nums.reduce((a, b) => a + b, 0);
        const average  = sum / nums.length;
        const min      = Math.min(...nums);
        const max      = Math.max(...nums);
        const scaleMax = max <= 5 ? 5 : max <= 7 ? 7 : 10;
        const distribution: ScaleBucket[] = [];
        for (let v = 1; v <= scaleMax; v++) {
          const count = nums.filter((n) => n === v).length;
          distribution.push({ value: v, count, pct: (count / nums.length) * 100 });
        }
        return { question: q, answeredCount: answered, skippedCount: skipped, average, min, max, scaleMax, distribution };
      }

      if (q.type === 'boolean') {
        const yesCount = defined.filter((v) => v === true || v === 'true' || v === 1).length;
        const noCount  = answered - yesCount;
        const yesPct   = answered ? (yesCount / answered) * 100 : 0;
        const noPct    = answered ? (noCount  / answered) * 100 : 0;
        return { question: q, answeredCount: answered, skippedCount: skipped, yesCount, noCount, yesPct, noPct };
      }

      // text
      const textAnswers = defined.map((v) => String(v)).filter((v) => v.trim().length > 0);
      return { question: q, answeredCount: answered, skippedCount: skipped, textAnswers };
    });
  }
}

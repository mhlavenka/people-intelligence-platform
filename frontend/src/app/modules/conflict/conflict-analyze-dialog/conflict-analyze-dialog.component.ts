import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../core/api.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: string;
  intakeType: 'survey' | 'interview' | 'assessment';
  minResponsesForAnalysis?: number;
  questions: unknown[];
  responseCount?: number;
}

interface OrgResponse {
  departments: string[];
}

@Component({
  selector: 'app-conflict-analyze-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
    DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>analytics</mat-icon>
      {{ "CONFLICT.newConflictAnalysis" | translate }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      @if (noTemplates()) {
        <div class="warn-banner">
          <mat-icon>info</mat-icon>
          {{ "CONFLICT.noTemplatesWarn" | translate }}
        </div>
      } @else {
        <form [formGroup]="form" class="dialog-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "CONFLICT.analysisTitle" | translate }}</mat-label>
            <input matInput formControlName="name"
              placeholder="e.g. Q1 2026 Team Health, March Pulse" />
            <mat-hint>{{ "CONFLICT.analysisTitleHint" | translate }}</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "CONFLICT.assessmentTemplate" | translate }}</mat-label>
            <mat-select formControlName="templateId"
                        panelClass="template-picker-panel"
                        (selectionChange)="selectedTemplateId.set($event.value)">
              <mat-select-trigger>
                @if (selectedTemplate(); as t) {
                  {{ t.title }}
                }
              </mat-select-trigger>
              <mat-option [disabled]="true" class="tpl-header-option">
                <div class="tpl-row tpl-head">
                  <span class="tpl-name">{{ 'CONFLICT.tplColName' | translate }}</span>
                  <span class="tpl-num">{{ 'CONFLICT.tplColQuestions' | translate }}</span>
                  <span class="tpl-num">{{ 'CONFLICT.tplColResponses' | translate }}</span>
                </div>
              </mat-option>
              @for (t of templates(); track t._id) {
                <mat-option [value]="t._id"
                            [disabled]="!meetsMinimum(t)"
                            class="tpl-option"
                            [class.tpl-insufficient]="!meetsMinimum(t)">
                  <div class="tpl-row">
                    <span class="tpl-name" [matTooltip]="t.title">{{ t.title }}</span>
                    <span class="tpl-num">{{ t.questions.length }}</span>
                    <span class="tpl-num"
                          [class.tpl-bad]="!meetsMinimum(t)"
                          [matTooltip]="!meetsMinimum(t) ? (('CONFLICT.tplBelowMin' | translate:{ min: minFor(t) })) : ''">
                      {{ t.responseCount ?? '–' }}
                      @if (!meetsMinimum(t)) {
                        <span class="tpl-min-suffix">/ {{ minFor(t) }}</span>
                      }
                    </span>
                  </div>
                </mat-option>
              }
            </mat-select>
            @if (loadingTemplates()) {
              <mat-hint>{{ "CONFLICT.loadingTemplates" | translate }}</mat-hint>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "CONFLICT.departmentOptional" | translate }}</mat-label>
            <mat-select formControlName="departmentId">
              <mat-option value="">{{ "COMMON.allDepartments" | translate }}</mat-option>
              @for (dept of departments(); track dept) {
                <mat-option [value]="dept">{{ dept }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ "CONFLICT.cycleRange" | translate }}</mat-label>
            <mat-select formControlName="cycleMode">
              <mat-option value="all">{{ "CONFLICT.cycleAllTime" | translate }}</mat-option>
              <mat-option value="last14">{{ "CONFLICT.cycleLast14" | translate }}</mat-option>
              <mat-option value="last30">{{ "CONFLICT.cycleLast30" | translate }}</mat-option>
              <mat-option value="sinceLastCycle">{{ "CONFLICT.cycleSinceLast" | translate }}</mat-option>
              <mat-option value="custom">{{ "CONFLICT.cycleCustom" | translate }}</mat-option>
            </mat-select>
            <mat-hint>{{ "CONFLICT.cycleRangeHint" | translate }}</mat-hint>
          </mat-form-field>

          @if (form.get('cycleMode')?.value === 'custom') {
            <div class="custom-range">
              <mat-form-field appearance="outline">
                <mat-label>{{ "CONFLICT.cycleFrom" | translate }}</mat-label>
                <input matInput type="date" formControlName="fromDate" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ "CONFLICT.cycleTo" | translate }}</mat-label>
                <input matInput type="date" formControlName="toDate" />
              </mat-form-field>
            </div>
          }

          @if (selectedMinRequired() > 1) {
            <div class="info-box">
              <mat-icon>shield</mat-icon>
              <p [innerHTML]="'CONFLICT.privacyMinResponses' | translate:{ count: selectedMinRequired() }"></p>
            </div>
          }
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="analyzing()">{{ "COMMON.cancel" | translate }}</button>
      @if (!noTemplates()) {
        <button mat-raised-button color="primary"
                (click)="analyze()" [disabled]="form.invalid || analyzing()">
          @if (analyzing()) {
            <mat-spinner diameter="18" />
            &nbsp; {{ "COMMON.analyzing" | translate }}
          } @else {
            <mat-icon>auto_awesome</mat-icon> {{ "CONFLICT.runAIAnalysis" | translate }}
          }
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: #e86c3a; }
    }

    mat-dialog-content { min-width: 720px; max-width: 880px; padding-top: 8px !important; }

    .custom-range { display: flex; gap: 12px; }
    .custom-range mat-form-field { flex: 1; }

    .tpl-row {
      display: grid;
      grid-template-columns: 1fr 110px 130px;
      align-items: center;
      gap: 12px;
      width: 100%;
    }
    .tpl-head {
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
      color: #7f8ea3;
    }
    .tpl-name {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .tpl-num { text-align: right; font-variant-numeric: tabular-nums; }
    .tpl-bad { color: #dc2626; font-weight: 600; }
    .tpl-min-suffix { color: #9aa5b4; font-weight: 400; margin-left: 2px; }
    .tpl-insufficient .tpl-name { color: #9aa5b4; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .warn-banner {
      display: flex; align-items: flex-start; gap: 10px;
      background: rgba(58,159,214,0.08); border-radius: 8px;
      padding: 14px; color: #2080b0; font-size: 14px; line-height: 1.5;
      mat-icon { color: var(--artes-accent); flex-shrink: 0; margin-top: 1px; }
    }

    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
    .full-width { width: 100%; }

    .info-box {
      display: flex; align-items: flex-start; gap: 10px;
      background: rgba(39,196,160,0.08); border-radius: 8px;
      padding: 12px 14px; color: #1a9678; font-size: 13px; line-height: 1.5;
      margin-top: 4px;
      mat-icon { color: #27C4A0; flex-shrink: 0; font-size: 20px; margin-top: 1px; }
      p { margin: 0; }
    }
  `],
})
export class ConflictAnalyzeDialogComponent implements OnInit {
  form: FormGroup;
  templates = signal<SurveyTemplate[]>([]);
  selectedTemplateId = signal('');
  selectedIntakeType = computed(() => {
    const t = this.templates().find((t) => t._id === this.selectedTemplateId());
    return t?.intakeType ?? 'survey';
  });
  selectedMinRequired = computed(() => {
    const t = this.templates().find((t) => t._id === this.selectedTemplateId());
    if (!t) return 5;
    return t.minResponsesForAnalysis ?? (t.intakeType === 'survey' ? 5 : 1);
  });
  selectedTemplate = computed(() =>
    this.templates().find((t) => t._id === this.selectedTemplateId()) ?? null,
  );

  /** Per-template minimum response count required to run an analysis. */
  minFor(t: SurveyTemplate): number {
    return t.minResponsesForAnalysis ?? (t.intakeType === 'survey' ? 5 : 1);
  }

  /** True iff the template has enough responses to run analysis on. */
  meetsMinimum(t: SurveyTemplate): boolean {
    return (t.responseCount ?? 0) >= this.minFor(t);
  }
  loadingTemplates = signal(true);
  analyzing = signal(false);
  error = signal('');
  noTemplates = signal(false);
  departments = signal<string[]>([]);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    public dialogRef: MatDialogRef<ConflictAnalyzeDialogComponent>,
    private translate: TranslateService
  ) {
    this.form = this.fb.group({
      name:         ['', Validators.required],
      templateId:   ['', Validators.required],
      departmentId: [''],
      cycleMode:    ['all'],
      fromDate:     [''],
      toDate:       [''],
    });
  }

  ngOnInit(): void {
    this.api.get<SurveyTemplate[]>('/surveys/templates?moduleType=conflict').subscribe({
      next: (conflictTemplates) => {
        this.templates.set(conflictTemplates);
        this.noTemplates.set(conflictTemplates.length === 0);
        if (conflictTemplates.length === 1) {
          this.form.patchValue({ templateId: conflictTemplates[0]._id });
          this.selectedTemplateId.set(conflictTemplates[0]._id);
        }
        this.loadingTemplates.set(false);

        // Fetch response count per template in parallel so the picker can flag
        // templates that don't meet their minimum-response threshold.
        if (conflictTemplates.length === 0) return;
        const counts$ = conflictTemplates.map((t) =>
          this.api.get<{ count: number }>(`/surveys/responses/${t._id}/count`).pipe(
            map((r) => ({ id: t._id, count: r.count ?? 0 })),
            catchError(() => of({ id: t._id, count: 0 })),
          ),
        );
        forkJoin(counts$).subscribe((results) => {
          const map = new Map(results.map((r) => [r.id, r.count]));
          this.templates.update((list) =>
            list.map((t) => ({ ...t, responseCount: map.get(t._id) ?? 0 })),
          );
        });
      },
      error: () => this.loadingTemplates.set(false),
    });

    this.api.get<OrgResponse>('/organizations/me').subscribe({
      next: (org) => this.departments.set(org.departments ?? []),
    });

    // Default analysis name to current month/year
    const now = new Date();
    const label = now.toLocaleString(localStorage.getItem('artes_language') || 'en', { month: 'long', year: 'numeric' });
    this.form.patchValue({ name: label });
  }

  analyze(): void {
    if (this.form.invalid) return;
    this.analyzing.set(true);
    this.error.set('');

    const { name, templateId, departmentId, cycleMode, fromDate, toDate } = this.form.value;

    this.api.post('/conflict/analyze', {
      templateId,
      departmentId: departmentId || undefined,
      name,
      cycleMode: cycleMode || 'all',
      ...(cycleMode === 'custom' && fromDate ? { fromDate } : {}),
      ...(cycleMode === 'custom' && toDate ? { toDate } : {}),
    }).subscribe({
      next: (result) => {
        this.analyzing.set(false);
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.error.set(err.error?.error || this.translate.instant('CONFLICT.analysisFailed'));
        this.analyzing.set(false);
      },
    });
  }
}

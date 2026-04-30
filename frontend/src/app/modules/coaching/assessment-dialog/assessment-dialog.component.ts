import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { environment } from '../../../../environments/environment';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

export interface AssessmentRecord {
  _id: string;
  organizationId: string;
  engagementId: string;
  coacheeId: string;
  coachId: string;
  assessmentType: string;
  assessmentLabel?: string;
  administeredAt: string;
  phase: 'baseline' | 'midpoint' | 'final' | 'ad_hoc';
  scores: Record<string, number>;
  scoresMeta?: { unit?: string; scaleMin?: number; scaleMax?: number; normGroup?: string };
  pdfFilename?: string;
  pdfSizeBytes?: number;
  pdfS3Key?: string;
  coachInterpretation?: string;
}

export interface AssessmentDialogData {
  engagementId: string;
  record?: AssessmentRecord;
}

interface ScoreRow {
  key: FormControl<string>;
  value: FormControl<number | null>;
}

const ASSESSMENT_TYPES = [
  'disc', 'hogan', 'leadership_circle', 'mbti', 'cliftonstrengths', 'tki', '360', 'eq-i', 'custom',
] as const;
const PHASES = ['baseline', 'midpoint', 'final', 'ad_hoc'] as const;

@Component({
  selector: 'app-assessment-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, MatDividerModule,
    TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <app-dialog-close-btn (closed)="dialogRef.close()" />
    <h2 mat-dialog-title>
      <mat-icon>assessment</mat-icon>
      {{ (isEdit() ? 'COACHING.editAssessment' : 'COACHING.newAssessment') | translate }}
    </h2>

    <mat-dialog-content [formGroup]="form">

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.assessmentType' | translate }}</mat-label>
          <mat-select formControlName="assessmentType" required>
            @for (t of types; track t) {
              <mat-option [value]="t">{{ typeLabel(t) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.assessmentPhase' | translate }}</mat-label>
          <mat-select formControlName="phase" required>
            @for (p of phases; track p) {
              <mat-option [value]="p">{{ phaseLabel(p) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.assessmentLabel' | translate }}</mat-label>
          <input matInput formControlName="assessmentLabel" maxlength="120"
                 [placeholder]="'COACHING.assessmentLabelHint' | translate" />
          <mat-hint>{{ 'COACHING.assessmentLabelOptional' | translate }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.administeredAt' | translate }}</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="administeredAt" required />
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
      </div>

      <!-- Scores ------------------------------------------------------------ -->
      <h3 class="section-h">{{ 'COACHING.scores' | translate }}</h3>
      <div class="scores-help">{{ 'COACHING.scoresHelp' | translate }}</div>
      <div class="scores-list">
        @for (row of scoreRows(); track $index; let i = $index) {
          <div class="score-row">
            <mat-form-field appearance="outline" class="score-key">
              <mat-label>{{ 'COACHING.scoreDimension' | translate }}</mat-label>
              <input matInput [formControl]="row.key" maxlength="80" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="score-val">
              <mat-label>{{ 'COACHING.scoreValue' | translate }}</mat-label>
              <input matInput type="number" step="0.01" [formControl]="row.value" />
            </mat-form-field>
            <button mat-icon-button type="button" color="warn" (click)="removeScoreRow(i)"
                    [matTooltip]="'COMMON.remove' | translate">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }
      </div>
      <button mat-stroked-button type="button" (click)="addScoreRow()">
        <mat-icon>add</mat-icon> {{ 'COACHING.addScore' | translate }}
      </button>

      <h3 class="section-h">{{ 'COACHING.scoresMeta' | translate }}</h3>
      <div class="form-row" formGroupName="scoresMeta">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.scoreUnit' | translate }}</mat-label>
          <mat-select formControlName="unit">
            <mat-option [value]="null">—</mat-option>
            <mat-option value="percentile">{{ 'COACHING.unitPercentile' | translate }}</mat-option>
            <mat-option value="standard_score">{{ 'COACHING.unitStandard' | translate }}</mat-option>
            <mat-option value="raw">{{ 'COACHING.unitRaw' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.scaleMin' | translate }}</mat-label>
          <input matInput type="number" formControlName="scaleMin" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'COACHING.scaleMax' | translate }}</mat-label>
          <input matInput type="number" formControlName="scaleMax" />
        </mat-form-field>
      </div>

      <!-- PDF ---------------------------------------------------------------- -->
      <h3 class="section-h">{{ 'COACHING.assessmentPdf' | translate }}</h3>
      @if (data.record?.pdfFilename) {
        <div class="pdf-current">
          <mat-icon>picture_as_pdf</mat-icon>
          <span class="pdf-name">{{ data.record!.pdfFilename }}</span>
          <button mat-stroked-button type="button" (click)="viewPdf()" [disabled]="loadingPdf()">
            @if (loadingPdf()) { <mat-spinner diameter="14"/> }
            @else { <mat-icon>visibility</mat-icon> }
            {{ 'COACHING.viewPdf' | translate }}
          </button>
          <button mat-stroked-button type="button" color="warn" (click)="removePdf()" [disabled]="removingPdf()">
            @if (removingPdf()) { <mat-spinner diameter="14"/> }
            @else { <mat-icon>delete</mat-icon> }
            {{ 'COACHING.removePdf' | translate }}
          </button>
        </div>
      } @else {
        <div class="pdf-empty">{{ 'COACHING.noPdfAttached' | translate }}</div>
      }
      @if (isEdit()) {
        <div class="pdf-upload-row">
          <input #fileInput type="file" accept="application/pdf" hidden
                 (change)="onPdfSelected($event)" />
          <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploadingPdf()">
            @if (uploadingPdf()) { <mat-spinner diameter="14"/> }
            @else { <mat-icon>upload_file</mat-icon> }
            {{ (data.record?.pdfFilename ? 'COACHING.replacePdf' : 'COACHING.uploadPdf') | translate }}
          </button>
          <span class="pdf-hint">{{ 'COACHING.pdfMaxSize' | translate }}</span>
        </div>
      } @else {
        <div class="pdf-hint">{{ 'COACHING.pdfAfterCreate' | translate }}</div>
      }

      <!-- Coach interpretation ---------------------------------------------- -->
      <h3 class="section-h">{{ 'COACHING.coachInterpretation' | translate }}</h3>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'COACHING.coachInterpretationLabel' | translate }}</mat-label>
        <textarea matInput formControlName="coachInterpretation" rows="4" maxlength="8000"
                  [placeholder]="'COACHING.coachInterpretationHint' | translate"></textarea>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (isEdit()) {
        <button mat-button color="warn" (click)="deleteRecord()" [disabled]="saving()">
          <mat-icon>delete</mat-icon> {{ 'COMMON.delete' | translate }}
        </button>
        <span class="spacer"></span>
      }
      <button mat-button mat-dialog-close [disabled]="saving()">{{ 'COMMON.cancel' | translate }}</button>
      <button mat-raised-button color="primary" (click)="save()"
              [disabled]="saving() || form.invalid">
        @if (saving()) { <mat-spinner diameter="18"/> }
        @else { <mat-icon>save</mat-icon> }
        {{ 'COMMON.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); } }
    mat-dialog-content { min-width: 640px; max-width: 760px; max-height: 78vh; padding-top: 8px !important; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; mat-form-field { flex: 1 1 200px; min-width: 0; } }
    .full-width { width: 100%; }
    .section-h { margin: 18px 0 6px; font-size: 13px; font-weight: 700; color: var(--artes-primary);
      text-transform: uppercase; letter-spacing: 0.4px; }
    .scores-help { font-size: 12px; color: #8fa4c0; margin-bottom: 8px; }
    .scores-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .score-row {
      display: flex; gap: 8px; align-items: flex-start;
      .score-key { flex: 2 1 200px; }
      .score-val { flex: 1 1 120px; }
    }
    .pdf-current {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border-radius: 8px;
      background: rgba(58,159,214,0.08); border: 1px solid rgba(58,159,214,0.22);
      mat-icon { color: var(--artes-accent); }
      .pdf-name { flex: 1; font-size: 14px; color: var(--artes-primary); }
    }
    .pdf-empty { font-size: 13px; color: #8fa4c0; padding: 8px 0; }
    .pdf-upload-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
    .pdf-hint { font-size: 12px; color: #8fa4c0; }
    .spacer { flex: 1; }
    mat-dialog-actions { padding: 12px 24px; }
  `],
})
export class AssessmentDialogComponent implements OnInit {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  dialogRef = inject(MatDialogRef<AssessmentDialogComponent, AssessmentRecord | 'deleted' | undefined>);
  data = inject<AssessmentDialogData>(MAT_DIALOG_DATA);

  types = ASSESSMENT_TYPES;
  phases = PHASES;

  saving = signal(false);
  uploadingPdf = signal(false);
  loadingPdf = signal(false);
  removingPdf = signal(false);

  scoreRows = signal<ScoreRow[]>([]);

  form = new FormGroup({
    assessmentType: new FormControl<string>('disc', { nonNullable: true, validators: [Validators.required] }),
    assessmentLabel: new FormControl<string>(''),
    administeredAt: new FormControl<Date | null>(new Date(), { validators: [Validators.required] }),
    phase: new FormControl<typeof PHASES[number]>('ad_hoc', { nonNullable: true, validators: [Validators.required] }),
    coachInterpretation: new FormControl<string>(''),
    scoresMeta: new FormGroup({
      unit: new FormControl<string | null>(null),
      scaleMin: new FormControl<number | null>(null),
      scaleMax: new FormControl<number | null>(null),
    }),
  });

  isEdit = () => !!this.data.record?._id;

  ngOnInit(): void {
    const r = this.data.record;
    if (r) {
      this.form.patchValue({
        assessmentType: r.assessmentType,
        assessmentLabel: r.assessmentLabel ?? '',
        administeredAt: r.administeredAt ? new Date(r.administeredAt) : new Date(),
        phase: r.phase,
        coachInterpretation: r.coachInterpretation ?? '',
        scoresMeta: {
          unit: r.scoresMeta?.unit ?? null,
          scaleMin: r.scoresMeta?.scaleMin ?? null,
          scaleMax: r.scoresMeta?.scaleMax ?? null,
        },
      });
      const rows: ScoreRow[] = Object.entries(r.scores ?? {}).map(([k, v]) => ({
        key: new FormControl<string>(k, { nonNullable: true }),
        value: new FormControl<number | null>(v),
      }));
      if (rows.length === 0) rows.push(this.makeBlankRow());
      this.scoreRows.set(rows);
    } else {
      this.scoreRows.set([this.makeBlankRow()]);
    }
  }

  private makeBlankRow(): ScoreRow {
    return {
      key: new FormControl<string>('', { nonNullable: true }),
      value: new FormControl<number | null>(null),
    };
  }
  addScoreRow() { this.scoreRows.update((rows) => [...rows, this.makeBlankRow()]); }
  removeScoreRow(i: number) {
    this.scoreRows.update((rows) => {
      const next = [...rows]; next.splice(i, 1);
      return next.length ? next : [this.makeBlankRow()];
    });
  }

  typeLabel(t: string): string {
    const map: Record<string, string> = {
      'eq-i': 'EQ-i 2.0',
      disc: 'DISC',
      hogan: 'Hogan',
      leadership_circle: 'Leadership Circle',
      mbti: 'MBTI',
      '360': '360',
      cliftonstrengths: 'CliftonStrengths',
      tki: 'TKI',
      custom: this.translate.instant('COACHING.typeCustom'),
    };
    return map[t] ?? t;
  }
  phaseLabel(p: string): string {
    return this.translate.instant(`COACHING.phase_${p}`);
  }

  private collectScores(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.scoreRows()) {
      const k = (r.key.value || '').trim();
      const v = r.value.value;
      if (k && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const body = {
      engagementId: this.data.engagementId,
      assessmentType: v.assessmentType,
      assessmentLabel: v.assessmentLabel || undefined,
      administeredAt: v.administeredAt instanceof Date ? v.administeredAt.toISOString() : v.administeredAt,
      phase: v.phase,
      scores: this.collectScores(),
      scoresMeta: {
        unit: v.scoresMeta?.unit || undefined,
        scaleMin: v.scoresMeta?.scaleMin ?? undefined,
        scaleMax: v.scoresMeta?.scaleMax ?? undefined,
      },
      coachInterpretation: v.coachInterpretation || undefined,
    };
    const req$ = this.isEdit()
      ? this.api.patch<AssessmentRecord>(`/assessments/${this.data.record!._id}`, body)
      : this.api.post<AssessmentRecord>('/assessments', body);
    req$.subscribe({
      next: (rec) => { this.saving.set(false); this.dialogRef.close(rec); },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err.error?.error || this.translate.instant('COACHING.assessmentSaveFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 });
      },
    });
  }

  deleteRecord() {
    if (!this.data.record?._id) return;
    if (!confirm(this.translate.instant('COACHING.deleteAssessmentConfirm'))) return;
    this.api.delete(`/assessments/${this.data.record._id}`).subscribe({
      next: () => this.dialogRef.close('deleted'),
      error: () => this.snack.open(this.translate.instant('COACHING.deleteFailed'),
        this.translate.instant('COMMON.close'), { duration: 3000 }),
    });
  }

  // ── PDF actions ───────────────────────────────────────────────────────────

  onPdfSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.data.record) return;
    if (file.size > 10 * 1024 * 1024) {
      this.snack.open(this.translate.instant('COACHING.pdfTooLarge'),
        this.translate.instant('COMMON.close'), { duration: 3000 });
      return;
    }
    const fd = new FormData();
    fd.append('pdf', file);
    this.uploadingPdf.set(true);
    // Multipart — ApiService doesn't help here; raw HttpClient with auth.
    this.http.post<{ pdfFilename: string; pdfSizeBytes: number; hasPdf: boolean }>(
      `${environment.apiUrl}/assessments/${this.data.record._id}/pdf`, fd,
    ).subscribe({
      next: (r) => {
        this.uploadingPdf.set(false);
        if (this.data.record) {
          this.data.record.pdfFilename = r.pdfFilename;
          this.data.record.pdfSizeBytes = r.pdfSizeBytes;
        }
        this.snack.open(this.translate.instant('COACHING.pdfUploaded'),
          this.translate.instant('COMMON.close'), { duration: 2000 });
      },
      error: (err) => {
        this.uploadingPdf.set(false);
        this.snack.open(err.error?.error || this.translate.instant('COACHING.pdfUploadFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 });
      },
    });
  }

  viewPdf() {
    if (!this.data.record?._id) return;
    this.loadingPdf.set(true);
    this.api.get<{ url: string }>(`/assessments/${this.data.record._id}/pdf/url`).subscribe({
      next: (r) => { this.loadingPdf.set(false); window.open(r.url, '_blank'); },
      error: () => {
        this.loadingPdf.set(false);
        this.snack.open(this.translate.instant('COACHING.pdfOpenFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 });
      },
    });
  }

  removePdf() {
    if (!this.data.record?._id) return;
    if (!confirm(this.translate.instant('COACHING.removePdfConfirm'))) return;
    this.removingPdf.set(true);
    this.api.delete(`/assessments/${this.data.record._id}/pdf`).subscribe({
      next: () => {
        this.removingPdf.set(false);
        if (this.data.record) {
          this.data.record.pdfFilename = undefined;
          this.data.record.pdfSizeBytes = undefined;
        }
        this.snack.open(this.translate.instant('COACHING.pdfRemoved'),
          this.translate.instant('COMMON.close'), { duration: 2000 });
      },
      error: () => {
        this.removingPdf.set(false);
        this.snack.open(this.translate.instant('COACHING.pdfRemoveFailed'),
          this.translate.instant('COMMON.close'), { duration: 3000 });
      },
    });
  }
}

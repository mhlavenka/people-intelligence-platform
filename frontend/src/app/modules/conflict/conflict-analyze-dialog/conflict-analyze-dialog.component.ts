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
import { ApiService } from '../../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: string;
  intakeType: 'survey' | 'interview' | 'assessment';
  questions: unknown[];
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
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>analytics</mat-icon>
      New Conflict Analysis
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      @if (noTemplates()) {
        <div class="warn-banner">
          <mat-icon>info</mat-icon>
          No conflict intake templates found. Create a intake template first, collect at least
          5 responses, then run an analysis.
        </div>
      } @else {
        <form [formGroup]="form" class="dialog-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Intake Template</mat-label>
            <mat-select formControlName="templateId" (selectionChange)="selectedTemplateId.set($event.value)">
              @for (t of templates(); track t._id) {
                <mat-option [value]="t._id">
                  {{ t.title }} ({{ t.questions.length }} questions)
                </mat-option>
              }
            </mat-select>
            @if (loadingTemplates()) {
              <mat-hint>Loading templates...</mat-hint>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Department (optional)</mat-label>
            <mat-select formControlName="departmentId">
              <mat-option value="">All Departments</mat-option>
              @for (dept of departments(); track dept) {
                <mat-option [value]="dept">{{ dept }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Intake Period</mat-label>
            <input matInput formControlName="surveyPeriod"
              placeholder="e.g. Q1 2026, March 2026" />
            <mat-hint>Label this analysis period for reporting</mat-hint>
          </mat-form-field>

          @if (selectedIntakeType() === 'survey') {
            <div class="info-box">
              <mat-icon>shield</mat-icon>
              <p>Analysis requires a minimum of <strong>5 responses</strong> to protect individual
              privacy. Results are aggregated — no individual data is shown.</p>
            </div>
          }
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="analyzing()">Cancel</button>
      @if (!noTemplates()) {
        <button mat-raised-button color="primary"
                (click)="analyze()" [disabled]="form.invalid || analyzing()">
          @if (analyzing()) {
            <mat-spinner diameter="18" />
            &nbsp; Analyzing...
          } @else {
            <mat-icon>auto_awesome</mat-icon> Run AI Analysis
          }
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: #1B2A47;
      mat-icon { color: #e86c3a; }
    }

    mat-dialog-content { min-width: 480px; padding-top: 8px !important; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .warn-banner {
      display: flex; align-items: flex-start; gap: 10px;
      background: rgba(58,159,214,0.08); border-radius: 8px;
      padding: 14px; color: #2080b0; font-size: 14px; line-height: 1.5;
      mat-icon { color: #3A9FD6; flex-shrink: 0; margin-top: 1px; }
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
  loadingTemplates = signal(true);
  analyzing = signal(false);
  error = signal('');
  noTemplates = signal(false);
  departments = signal<string[]>([]);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private dialogRef: MatDialogRef<ConflictAnalyzeDialogComponent>
  ) {
    this.form = this.fb.group({
      templateId:   ['', Validators.required],
      departmentId: [''],
      surveyPeriod: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
      next: (templates) => {
        const conflictTemplates = templates.filter((t) => t.moduleType === 'conflict');
        this.templates.set(conflictTemplates);
        this.noTemplates.set(conflictTemplates.length === 0);
        if (conflictTemplates.length === 1) {
          this.form.patchValue({ templateId: conflictTemplates[0]._id });
          this.selectedTemplateId.set(conflictTemplates[0]._id);
        }
        this.loadingTemplates.set(false);
      },
      error: () => this.loadingTemplates.set(false),
    });

    this.api.get<OrgResponse>('/organizations/me').subscribe({
      next: (org) => this.departments.set(org.departments ?? []),
    });

    // Default intake period to current month/year
    const now = new Date();
    const label = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    this.form.patchValue({ surveyPeriod: label });
  }

  analyze(): void {
    if (this.form.invalid) return;
    this.analyzing.set(true);
    this.error.set('');

    const { templateId, departmentId, surveyPeriod } = this.form.value;

    this.api.post('/conflict/analyze', {
      templateId,
      departmentId: departmentId || undefined,
      surveyPeriod,
    }).subscribe({
      next: (result) => {
        this.analyzing.set(false);
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Analysis failed. Please try again.');
        this.analyzing.set(false);
      },
    });
  }
}

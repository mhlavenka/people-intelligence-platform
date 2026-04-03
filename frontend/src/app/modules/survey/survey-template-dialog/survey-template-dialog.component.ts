import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-survey-template-dialog',
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
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit() ? 'edit' : 'add_circle' }}</mat-icon>
      {{ isEdit() ? 'Edit Intake Template' : 'New Intake Template' }}
    </h2>

    <mat-dialog-content>
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <form [formGroup]="form">
        <!-- Template details -->
        <div class="section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Template Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Workplace Conflict Assessment Q2 2026" />
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Module</mat-label>
              <mat-select formControlName="moduleType">
                <mat-option value="conflict">
                  <mat-icon>warning_amber</mat-icon> Conflict Intelligence
                </mat-option>
                <mat-option value="neuroinclusion">
                  <mat-icon>psychology</mat-icon> Neuro-Inclusion Compass
                </mat-option>
                <mat-option value="succession">
                  <mat-icon>trending_up</mat-icon> Leadership & Succession
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Intake Type</mat-label>
              <mat-select formControlName="intakeType">
                <mat-option value="survey">
                  <mat-icon>poll</mat-icon> Survey — self-completed by respondent
                </mat-option>
                <mat-option value="interview">
                  <mat-icon>record_voice_over</mat-icon> Interview — coach-led with coachee
                </mat-option>
                <mat-option value="assessment">
                  <mat-icon>fact_check</mat-icon> Assessment — coach-administered evaluation
                </mat-option>
              </mat-select>
              <mat-hint>Interview &amp; Assessment are completed by a coach for a coachee</mat-hint>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Questions -->
        <div class="section questions-section">
          <div class="section-header">
            <h3>Questions <span class="count">{{ questionsArray.length }}</span></h3>
            <button mat-stroked-button type="button" (click)="addQuestion()">
              <mat-icon>add</mat-icon> Add Question
            </button>
          </div>

          <div formArrayName="questions" class="questions-list">
            @for (q of questionsArray.controls; track q; let i = $index) {
              <div [formGroupName]="i" class="question-row">
                <div class="q-number">{{ i + 1 }}</div>

                <div class="q-fields">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Question text</mat-label>
                    <input matInput formControlName="text"
                      placeholder="e.g. How would you rate team communication?" />
                  </mat-form-field>

                  <div class="q-meta-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Type</mat-label>
                      <mat-select formControlName="type">
                        <mat-option value="scale">Scale (1–10)</mat-option>
                        <mat-option value="boolean">Yes / No</mat-option>
                        <mat-option value="text">Open Text</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Category</mat-label>
                      <input matInput formControlName="category"
                        placeholder="e.g. communication" />
                    </mat-form-field>
                  </div>
                </div>

                <button mat-icon-button type="button"
                        class="remove-btn"
                        [matTooltip]="'Remove question'"
                        (click)="removeQuestion(i)"
                        [disabled]="questionsArray.length <= 1">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
          </div>

          <button mat-stroked-button type="button" class="add-q-btn" (click)="addQuestion()">
            <mat-icon>add</mat-icon> Add Another Question
          </button>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary"
              (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) {
          <mat-spinner diameter="18" />
        } @else {
          <mat-icon>{{ isEdit() ? 'save' : 'add_circle' }}</mat-icon>
          {{ isEdit() ? 'Save Changes' : 'Create Template' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: #1B2A47;
      mat-icon { color: #3A9FD6; }
    }

    mat-dialog-content {
      min-width: 580px; max-width: 680px;
      padding-top: 8px !important;
      overflow-y: auto;
    }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }

    .section { padding: 16px 0; display: flex; flex-direction: column; gap: 4px; }
    .full-width { width: 100%; }
    .form-row { display: flex; gap: 12px; }
    .half-width { flex: 1; min-width: 0; }

    .questions-section { gap: 12px; }

    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      h3 {
        font-size: 15px; color: #1B2A47; margin: 0;
        .count {
          background: #EBF5FB; color: #3A9FD6;
          padding: 1px 8px; border-radius: 999px; font-size: 12px; margin-left: 6px;
        }
      }
    }

    .questions-list { display: flex; flex-direction: column; gap: 12px; }

    .question-row {
      display: flex; gap: 12px; align-items: flex-start;
      background: #f8fafc; border-radius: 12px; padding: 12px;
    }

    .q-number {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1B2A47; color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 10px;
    }

    .q-fields { flex: 1; display: flex; flex-direction: column; gap: 4px; }

    .q-meta-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    }

    .remove-btn { color: #9aa5b4; flex-shrink: 0; margin-top: 4px; }

    .add-q-btn { width: 100%; margin-top: 4px; color: #3A9FD6; border-color: #3A9FD6; }
  `],
})
export class SurveyTemplateDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<SurveyTemplateDialogComponent>);
  private existingData = inject<SurveyTemplate | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  saving = signal(false);
  error = signal('');

  isEdit = () => !!this.existingData;

  get questionsArray(): FormArray {
    return this.form.get('questions') as FormArray;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      title:      [this.existingData?.title ?? '', Validators.required],
      moduleType: [this.existingData?.moduleType ?? 'conflict', Validators.required],
      intakeType: [this.existingData?.intakeType ?? 'survey', Validators.required],
      questions:  this.fb.array([]),
    });

    if (this.existingData?.questions?.length) {
      this.existingData.questions.forEach((q) => this.addQuestion(q));
    } else {
      // Start with 3 blank questions
      this.addQuestion();
      this.addQuestion();
      this.addQuestion();
    }
  }

  addQuestion(data?: { id?: string; text?: string; type?: string; category?: string }): void {
    this.questionsArray.push(
      this.fb.group({
        id:       [data?.id ?? `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, Validators.required],
        text:     [data?.text ?? '', Validators.required],
        type:     [data?.type ?? 'scale', Validators.required],
        category: [data?.category ?? '', Validators.required],
      })
    );
  }

  removeQuestion(index: number): void {
    this.questionsArray.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const payload = this.form.value;

    const request = this.isEdit()
      ? this.api.put(`/surveys/templates/${this.existingData!._id}`, payload)
      : this.api.post('/surveys/templates', payload);

    request.subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save template.');
        this.saving.set(false);
      },
    });
  }
}

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: 'conflict' | 'neuroinclusion' | 'succession';
  intakeType: 'survey' | 'interview' | 'assessment';
  questions: { id: string; text: string; type: string; category: string }[];
  isActive: boolean;
}

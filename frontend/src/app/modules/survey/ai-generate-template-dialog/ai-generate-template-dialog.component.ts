import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';

interface GeneratedTemplate {
  _id: string;
  title: string;
  questions: { id: string }[];
}

@Component({
  selector: 'app-ai-generate-template-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatSnackBarModule, TranslateModule,
  ],
  template: `
    <div class="dlg">
      <div class="dlg-header">
        <div class="ai-avatar">
          <mat-icon>auto_awesome</mat-icon>
          <span class="pulse-ring"></span>
        </div>
        <div>
          <h2 mat-dialog-title>{{ 'SURVEY.aiGenerateTitle' | translate }}</h2>
          <p class="dlg-sub">{{ 'SURVEY.aiGenerateSubtitle' | translate }}</p>
        </div>
      </div>

      <mat-dialog-content class="dlg-content">
        @if (generating()) {
          <div class="generating">
            <mat-spinner diameter="48" />
            <h3>{{ 'SURVEY.aiGenerating' | translate }}</h3>
            <p>{{ 'SURVEY.aiGeneratingHint' | translate }}</p>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'SURVEY.aiGenerateDescLabel' | translate }}</mat-label>
            <textarea matInput [(ngModel)]="description" rows="6"
                      [placeholder]="'SURVEY.aiGenerateDescPlaceholder' | translate"
                      maxlength="2000"></textarea>
            <mat-hint align="end">{{ description.length }} / 2000</mat-hint>
          </mat-form-field>

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'SURVEY.module' | translate }}</mat-label>
              <mat-select [(ngModel)]="moduleType">
                <mat-option value="conflict">{{ 'SURVEY.moduleConflict' | translate }}</mat-option>
                <mat-option value="neuroinclusion">{{ 'SURVEY.moduleNeuroinclusion' | translate }}</mat-option>
                <mat-option value="succession">{{ 'SURVEY.moduleSuccession' | translate }}</mat-option>
                <mat-option value="coaching">{{ 'SURVEY.moduleCoaching' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'SURVEY.intakeType' | translate }}</mat-label>
              <mat-select [(ngModel)]="intakeType">
                <mat-option value="survey">{{ 'SURVEY.typeSurvey' | translate }}</mat-option>
                <mat-option value="interview">{{ 'SURVEY.typeInterview' | translate }}</mat-option>
                <mat-option value="assessment">{{ 'SURVEY.typeAssessment' | translate }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="num-field">
              <mat-label>{{ 'SURVEY.aiQuestionCount' | translate }}</mat-label>
              <input matInput type="number" min="3" max="20" [(ngModel)]="questionCount" />
            </mat-form-field>
          </div>

          @if (errorMsg()) {
            <div class="err">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMsg() }}</span>
            </div>
          }

          <div class="hint-box">
            <mat-icon>tips_and_updates</mat-icon>
            <span>{{ 'SURVEY.aiGenerateTipsHint' | translate }}</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dlg-actions">
        <button mat-button mat-dialog-close [disabled]="generating()">
          {{ 'COMMON.cancel' | translate }}
        </button>
        <button mat-raised-button color="primary" (click)="generate()"
                [disabled]="generating() || description.trim().length < 10">
          @if (generating()) {
            <mat-spinner diameter="18" />
          } @else {
            <mat-icon>auto_awesome</mat-icon>
          }
          {{ 'SURVEY.aiGenerateBtn' | translate }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dlg { display: flex; flex-direction: column; min-width: 560px; max-width: 720px; }

    .dlg-header {
      display: flex; align-items: center; gap: 14px;
      padding: 22px 24px 12px;
      h2 { margin: 0 !important; font-size: 20px; color: var(--artes-primary); font-weight: 700; }
      .dlg-sub { margin: 2px 0 0; font-size: 13px; color: #5a6a7e; line-height: 1.4; }
    }

    .ai-avatar {
      position: relative; width: 44px; height: 44px; flex-shrink: 0;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #3A9FD6 0%, #27C4A0 100%);
      box-shadow: 0 4px 14px -4px rgba(58, 159, 214, 0.45);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; }
    }
    .pulse-ring {
      position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid rgba(58, 159, 214, 0.35);
      animation: pulse-ring 2.4s ease-out infinite;
    }
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 0; }
    }

    .dlg-content { padding: 12px 24px 8px !important; }
    .full-width { width: 100%; }
    .row { display: flex; gap: 12px; }
    .row mat-form-field { flex: 1; }
    .num-field { max-width: 140px; flex: 0 0 auto; }

    .hint-box {
      display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px;
      background: rgba(58,159,214,0.08); border: 1px solid rgba(58,159,214,0.20);
      border-radius: 8px; margin-top: 8px;
      font-size: 12px; color: #2080b0; line-height: 1.5;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--artes-accent); flex-shrink: 0; }
    }

    .err {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
      background: rgba(229,62,62,0.08); border: 1px solid rgba(229,62,62,0.24);
      color: #c53030; font-size: 13px; margin-top: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }

    .generating {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 50px 20px; text-align: center;
      h3 { margin: 8px 0 0; color: var(--artes-primary); font-size: 16px; font-weight: 600; }
      p { margin: 0; color: #5a6a7e; font-size: 13px; max-width: 380px; }
    }

    .dlg-actions { padding: 12px 20px !important; border-top: 1px solid #edf1f6; }
  `],
})
export class AiGenerateTemplateDialogComponent {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<AiGenerateTemplateDialogComponent>);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);

  description = '';
  moduleType: 'conflict' | 'neuroinclusion' | 'succession' | 'coaching' = 'conflict';
  intakeType: 'survey' | 'interview' | 'assessment' = 'survey';
  questionCount = 8;
  generating = signal(false);
  errorMsg = signal<string | null>(null);

  generate(): void {
    if (this.description.trim().length < 10) return;
    this.generating.set(true);
    this.errorMsg.set(null);
    this.api.post<GeneratedTemplate>('/surveys/templates/ai-generate', {
      description: this.description.trim(),
      moduleType: this.moduleType,
      intakeType: this.intakeType,
      questionCount: this.questionCount,
    }).subscribe({
      next: (template) => {
        this.generating.set(false);
        this.snack.open(
          this.translate.instant('SURVEY.aiGenerateSuccess', { count: template.questions.length }),
          this.translate.instant('COMMON.ok'),
          { duration: 3000 },
        );
        this.dialogRef.close(template);
      },
      error: (err) => {
        this.generating.set(false);
        this.errorMsg.set(err?.error?.error || this.translate.instant('SURVEY.aiGenerateFailed'));
      },
    });
  }
}

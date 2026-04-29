import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { DialogCloseButtonComponent } from '../../../shared/dialog-close-button/dialog-close-button.component';

interface PreviewQuestion {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean' | 'forced_choice' | string;
  category?: string;
  options?: { value: string; text: string }[];
  scale_range?: { min: number; max: number; labels?: Record<string, string> };
  optional?: boolean;
}

export interface SurveyPreviewDialogData {
  title: string;
  description?: string;
  instructions?: string;
  questions: PreviewQuestion[];
}

@Component({
  selector: 'app-survey-preview-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule, TranslateModule, DialogCloseButtonComponent,
  ],
  template: `
    <div class="dlg">
      <app-dialog-close-btn (closed)="dialogRef.close()" />
      <div class="dlg-header">
        <div class="header-left">
          <span class="preview-tag">
            <mat-icon>visibility</mat-icon>
            {{ 'SURVEY.previewTag' | translate }}
          </span>
          <h2 mat-dialog-title>{{ data.title }}</h2>
        </div>
      </div>

      <mat-dialog-content class="dlg-content">
        @if (phase() === 'instructions') {
          <div class="instructions-state">
            <mat-icon class="big-icon">description</mat-icon>
            @if (data.description) { <p class="desc">{{ data.description }}</p> }
            @if (data.instructions) { <p class="instructions">{{ data.instructions }}</p> }
            <p class="meta">
              {{ data.questions.length }} {{ 'SURVEY.questions' | translate }}
            </p>
          </div>
        } @else if (phase() === 'questions') {
          @if (data.questions[currentIndex()]; as q) {
            <div class="progress-bar">
              <div class="progress-fill"
                   [style.width.%]="((currentIndex() + 1) / data.questions.length) * 100"></div>
            </div>
            <div class="progress-label">
              {{ currentIndex() + 1 }} / {{ data.questions.length }}
              @if (q.category) { · <span class="category">{{ q.category }}</span> }
            </div>

            <h3 class="q-text">{{ q.text }}</h3>

            <div class="q-input">
              @if (q.type === 'scale') {
                <div class="scale-buttons">
                  @for (n of scaleValuesFor(q); track n) {
                    <button type="button" class="scale-btn"
                            [class.selected]="answers[q.id] === n"
                            (click)="setAnswer(q.id, n)">
                      <span class="scale-num">{{ n }}</span>
                      @if (labelFor(q, n)) {
                        <span class="scale-label-text">{{ labelFor(q, n) }}</span>
                      }
                    </button>
                  }
                </div>
              } @else if (q.type === 'boolean') {
                <div class="bool-container">
                  <button type="button" class="bool-btn"
                          [class.selected]="answers[q.id] === true"
                          (click)="setAnswer(q.id, true)">
                    <mat-icon>thumb_up</mat-icon> {{ 'COMMON.yes' | translate }}
                  </button>
                  <button type="button" class="bool-btn"
                          [class.selected]="answers[q.id] === false"
                          (click)="setAnswer(q.id, false)">
                    <mat-icon>thumb_down</mat-icon> {{ 'COMMON.no' | translate }}
                  </button>
                </div>
              } @else if (q.type === 'forced_choice' && q.options?.length) {
                <div class="fc-container">
                  @for (opt of q.options; track opt.value) {
                    <button type="button" class="fc-card"
                            [class.selected]="answers[q.id] === opt.value"
                            (click)="setAnswer(q.id, opt.value)">
                      <span class="fc-badge">{{ opt.value }}</span>
                      <span class="fc-text">{{ opt.text }}</span>
                    </button>
                  }
                </div>
              } @else {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'SURVEY.yourAnswer' | translate }}</mat-label>
                  <textarea matInput rows="4"
                            [(ngModel)]="textAnswers[q.id]"
                            [placeholder]="'SURVEY.typeResponsePlaceholder' | translate"></textarea>
                </mat-form-field>
              }
            </div>
          }
        } @else if (phase() === 'done') {
          <div class="done-state">
            <mat-icon class="big-icon ok">check_circle</mat-icon>
            <h3>{{ 'SURVEY.previewComplete' | translate }}</h3>
            <p>{{ 'SURVEY.previewCompleteHint' | translate }}</p>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dlg-actions">
        @if (phase() === 'instructions') {
          <button mat-button mat-dialog-close>{{ 'COMMON.close' | translate }}</button>
          <button mat-raised-button color="primary" (click)="start()" [disabled]="!data.questions.length">
            <mat-icon>play_arrow</mat-icon> {{ 'SURVEY.startPreview' | translate }}
          </button>
        } @else if (phase() === 'questions') {
          <button mat-button (click)="prev()" [disabled]="currentIndex() === 0">
            <mat-icon>arrow_back</mat-icon> {{ 'COMMON.back' | translate }}
          </button>
          <span class="actions-spacer"></span>
          <button mat-button (click)="restart()">
            <mat-icon>restart_alt</mat-icon> {{ 'SURVEY.restartPreview' | translate }}
          </button>
          @if (currentIndex() < data.questions.length - 1) {
            <button mat-raised-button color="primary" (click)="next()">
              {{ 'COMMON.next' | translate }} <mat-icon>arrow_forward</mat-icon>
            </button>
          } @else {
            <button mat-raised-button color="primary" (click)="finish()">
              <mat-icon>check</mat-icon> {{ 'SURVEY.finishPreview' | translate }}
            </button>
          }
        } @else {
          <button mat-button (click)="restart()">
            <mat-icon>restart_alt</mat-icon> {{ 'SURVEY.restartPreview' | translate }}
          </button>
          <button mat-raised-button color="primary" mat-dialog-close>
            {{ 'COMMON.close' | translate }}
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dlg { display: flex; flex-direction: column; min-width: 640px; max-width: 760px; }

    .dlg-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 8px;
      .header-left { flex: 1; min-width: 0; }
      .preview-tag {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
        padding: 3px 10px; border-radius: 999px;
        background: rgba(240,165,0,0.12); color: #b07800;
        margin-bottom: 4px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h2 { margin: 0 !important; font-size: 18px; color: var(--artes-primary); }
    }

    .dlg-content { padding: 14px 28px !important; min-height: 320px; }
    .full-width { width: 100%; }

    .instructions-state, .done-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 32px 16px; text-align: center;
      .big-icon { font-size: 56px; width: 56px; height: 56px; color: var(--artes-accent); margin-bottom: 4px; }
      .big-icon.ok { color: #27C4A0; }
      h3 { margin: 4px 0; color: var(--artes-primary); font-size: 18px; font-weight: 600; }
      .desc { font-size: 14px; color: #374151; max-width: 540px; line-height: 1.6; margin: 0; }
      .instructions { font-size: 13px; color: #5a6a7e; max-width: 540px; line-height: 1.6; margin: 8px 0 0; white-space: pre-line; }
      .meta { font-size: 12px; color: #9aa5b4; margin-top: 12px; }
    }

    .progress-bar {
      width: 100%; height: 4px; background: #f0f4f8; border-radius: 999px; overflow: hidden;
      margin-bottom: 6px;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, #3A9FD6, #27C4A0);
      transition: width 0.25s ease;
    }
    .progress-label {
      font-size: 12px; color: #7f8ea3; margin-bottom: 14px; font-weight: 500;
      .category { color: var(--artes-accent); font-weight: 600; }
    }

    .q-text {
      font-size: 17px; font-weight: 600; color: var(--artes-primary);
      margin: 0 0 18px; line-height: 1.45;
    }

    .scale-buttons {
      display: flex; gap: 8px; flex-wrap: wrap;
    }
    .scale-btn {
      flex: 1; min-width: 64px; min-height: 56px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      padding: 10px 8px; border-radius: 10px;
      border: 1.5px solid #dce6f0; background: white; cursor: pointer;
      font-size: 14px; transition: all 0.15s;
      .scale-num { font-size: 20px; font-weight: 700; color: var(--artes-primary); }
      .scale-label-text { font-size: 10px; color: #7f8ea3; line-height: 1.2; text-align: center; }
      &:hover { border-color: var(--artes-accent); }
      &.selected {
        background: var(--artes-accent); border-color: var(--artes-accent);
        .scale-num, .scale-label-text { color: white; }
      }
    }

    .bool-container { display: flex; gap: 12px; }
    .bool-btn {
      flex: 1; padding: 14px; border-radius: 10px;
      border: 1.5px solid #dce6f0; background: white; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-size: 15px; font-weight: 600; color: #5a6a7e;
      transition: all 0.15s;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &:hover { border-color: var(--artes-accent); color: var(--artes-accent); }
      &.selected {
        background: var(--artes-accent); border-color: var(--artes-accent); color: white;
        mat-icon { color: white; }
      }
    }

    .fc-container { display: flex; flex-direction: column; gap: 10px; }
    .fc-card {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 10px;
      border: 1.5px solid #dce6f0; background: white; cursor: pointer;
      text-align: left; font-size: 14px;
      transition: all 0.15s;
      .fc-badge {
        flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: #f0f4f8; color: #5a6a7e; font-weight: 700;
      }
      .fc-text { flex: 1; color: #374151; line-height: 1.5; }
      &:hover { border-color: var(--artes-accent); }
      &.selected {
        background: rgba(58,159,214,0.06); border-color: var(--artes-accent);
        .fc-badge { background: var(--artes-accent); color: white; }
      }
    }

    .dlg-actions { padding: 12px 20px !important; border-top: 1px solid #edf1f6; }
    .actions-spacer { flex: 1; }
  `],
})
export class SurveyPreviewDialogComponent {
  data = inject<SurveyPreviewDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<SurveyPreviewDialogComponent>);

  phase = signal<'instructions' | 'questions' | 'done'>('instructions');
  currentIndex = signal(0);
  answers: Record<string, number | boolean | string> = {};
  textAnswers: Record<string, string> = {};

  start(): void {
    if (this.data.instructions || this.data.description) {
      this.phase.set('questions');
    } else {
      this.phase.set('questions');
    }
  }

  next(): void {
    if (this.currentIndex() < this.data.questions.length - 1) {
      this.currentIndex.set(this.currentIndex() + 1);
    }
  }

  prev(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.set(this.currentIndex() - 1);
    }
  }

  finish(): void {
    this.phase.set('done');
  }

  restart(): void {
    this.answers = {};
    this.textAnswers = {};
    this.currentIndex.set(0);
    this.phase.set('instructions');
  }

  setAnswer(id: string, value: number | boolean | string): void {
    this.answers = { ...this.answers, [id]: value };
  }

  scaleValuesFor(q: PreviewQuestion): number[] {
    const min = q.scale_range?.min ?? 1;
    const max = q.scale_range?.max ?? 5;
    const out: number[] = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
  }

  labelFor(q: PreviewQuestion, n: number): string | null {
    return q.scale_range?.labels?.[String(n)] ?? null;
  }
}

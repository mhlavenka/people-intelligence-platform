import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MatRadioModule } from '@angular/material/radio';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';

interface Question {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean';
  category: string;
}

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: string;
  questions: Question[];
}

const DEPARTMENTS = [
  'Engineering', 'Product', 'Design', 'Marketing', 'Sales',
  'Customer Success', 'Finance', 'HR', 'Operations', 'Leadership',
];

@Component({
  selector: 'app-survey-take',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSliderModule,
    MatRadioModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="survey-page">
      <div class="survey-card">

        @if (loading()) {
          <div class="loading-center">
            <mat-spinner diameter="40" />
            <p>Loading survey...</p>
          </div>
        } @else if (alreadySubmitted()) {
          <div class="thank-you">
            <div class="thank-you-icon already">
              <mat-icon>rule</mat-icon>
            </div>
            <h2>You've already responded</h2>
            <p>You previously submitted a response for this survey. Each person can only respond once to protect the integrity of the results.</p>
            <button mat-raised-button color="primary" (click)="goToDashboard()">
              Back to Dashboard
            </button>
          </div>
        } @else if (submitted()) {
          <!-- Thank you screen -->
          <div class="thank-you">
            <div class="thank-you-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h2>Thank you for your response!</h2>
            <p>Your answers have been submitted anonymously and will contribute to
            your organization's wellbeing insights.</p>
            <button mat-raised-button color="primary" (click)="goToDashboard()">
              Back to Dashboard
            </button>
          </div>
        } @else if (template()) {
          <!-- Survey header -->
          <div class="survey-header">
            <div class="module-badge" [class]="template()!.moduleType">
              <mat-icon>{{ moduleIcon() }}</mat-icon>
              {{ moduleLabel() }}
            </div>
            <h1>{{ template()!.title }}</h1>
            <div class="progress-row">
              <span>Question {{ currentIndex() + 1 }} of {{ template()!.questions.length }}</span>
              <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
            </div>
          </div>

          <!-- Department selector (first step) -->
          @if (currentIndex() === -1) {
            <div class="dept-step">
              <h2>Before you begin</h2>
              <p>Your response is anonymous. We only collect department to provide
              aggregated insights — never individual data.</p>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Your Department</mat-label>
                <mat-select [(value)]="selectedDept">
                  @for (dept of departments; track dept) {
                    <mat-option [value]="dept">{{ dept }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button mat-raised-button color="primary"
                      (click)="startSurvey()" [disabled]="!selectedDept">
                Start Survey →
              </button>
            </div>
          } @else {
            <!-- Question -->
            @if (currentQuestion(); as q) {
              <div class="question-block">
                <p class="question-text">{{ q.text }}</p>

                @if (q.type === 'scale') {
                  <div class="scale-container">
                    <div class="scale-labels">
                      <span>1 — Strongly Disagree</span>
                      <span>10 — Strongly Agree</span>
                    </div>
                    <div class="scale-buttons">
                      @for (n of scaleValues; track n) {
                        <button
                          type="button"
                          class="scale-btn"
                          [class.selected]="answers()[q.id] === n"
                          [class]="scaleClass(n)"
                          (click)="setAnswer(q.id, n)"
                        >
                          {{ n }}
                        </button>
                      }
                    </div>
                    @if (answers()[q.id]) {
                      <p class="scale-hint">Selected: <strong>{{ answers()[q.id] }}</strong></p>
                    }
                  </div>
                }

                @if (q.type === 'boolean') {
                  <div class="bool-container">
                    <button type="button" class="bool-btn"
                            [class.selected]="answers()[q.id] === true"
                            (click)="setAnswer(q.id, true)">
                      <mat-icon>thumb_up</mat-icon> Yes
                    </button>
                    <button type="button" class="bool-btn"
                            [class.selected]="answers()[q.id] === false"
                            (click)="setAnswer(q.id, false)">
                      <mat-icon>thumb_down</mat-icon> No
                    </button>
                  </div>
                }

                @if (q.type === 'text') {
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Your answer</mat-label>
                    <textarea matInput rows="4"
                      [value]="answers()[q.id] ?? ''"
                      (input)="setAnswer(q.id, $any($event.target).value)"
                      placeholder="Type your response here...">
                    </textarea>
                  </mat-form-field>
                }
              </div>

              <!-- Navigation -->
              <div class="nav-row">
                <button mat-button (click)="prev()" [disabled]="currentIndex() === 0">
                  <mat-icon>arrow_back</mat-icon> Back
                </button>

                @if (currentIndex() < template()!.questions.length - 1) {
                  <button mat-raised-button color="primary"
                          (click)="next()"
                          [disabled]="!answers()[q.id] && answers()[q.id] !== false">
                    Next <mat-icon>arrow_forward</mat-icon>
                  </button>
                } @else {
                  <button mat-raised-button color="primary"
                          (click)="submit()"
                          [disabled]="submitting() || (!answers()[q.id] && answers()[q.id] !== false)">
                    @if (submitting()) {
                      <mat-spinner diameter="18" />
                    } @else {
                      <mat-icon>send</mat-icon> Submit
                    }
                  </button>
                }
              </div>
            }
          }
        } @else {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>Survey not found.</p>
            <button mat-button (click)="goToDashboard()">Back to Dashboard</button>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .survey-page {
      min-height: 100vh;
      background: #EBF5FB;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 24px;
    }

    .survey-card {
      background: white;
      border-radius: 20px;
      padding: 48px;
      width: 100%;
      max-width: 680px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .loading-center {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; padding: 48px; color: #9aa5b4;
    }

    .survey-header {
      margin-bottom: 36px;

      .module-badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 12px; border-radius: 999px; font-size: 12px;
        font-weight: 600; text-transform: uppercase; margin-bottom: 12px;
        &.conflict      { background: rgba(232,108,58,0.12); color: #c04a14; mat-icon { font-size: 16px; } }
        &.neuroinclusion{ background: rgba(39,196,160,0.12); color: #1a9678; mat-icon { font-size: 16px; } }
        &.succession    { background: rgba(58,159,214,0.12); color: #2080b0; mat-icon { font-size: 16px; } }
      }

      h1 { font-size: 22px; color: #1B2A47; margin: 0 0 20px; line-height: 1.3; }

      .progress-row {
        display: flex; flex-direction: column; gap: 6px;
        span { font-size: 13px; color: #9aa5b4; }
      }
    }

    .dept-step {
      h2 { font-size: 20px; color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
      .full-width { width: 100%; margin-bottom: 16px; }
    }

    .question-block {
      min-height: 200px;
      margin-bottom: 32px;
    }

    .question-text {
      font-size: 18px;
      color: #1B2A47;
      font-weight: 500;
      line-height: 1.5;
      margin-bottom: 28px;
    }

    .scale-container {
      .scale-labels {
        display: flex; justify-content: space-between;
        font-size: 12px; color: #9aa5b4; margin-bottom: 12px;
      }
      .scale-buttons {
        display: flex; gap: 8px; flex-wrap: wrap;
      }
      .scale-btn {
        width: 48px; height: 48px; border-radius: 10px;
        border: 2px solid #dce6f0; background: white;
        font-size: 16px; font-weight: 600; cursor: pointer;
        color: #5a6a7e; transition: all 0.15s;
        &:hover { border-color: #3A9FD6; color: #3A9FD6; }
        &.selected { color: white; border-color: transparent; }
        &.low.selected    { background: #27C4A0; }
        &.mid.selected    { background: #f0a500; }
        &.high.selected   { background: #e53e3e; }
      }
      .scale-hint { font-size: 13px; color: #5a6a7e; margin-top: 12px; }
    }

    .bool-container {
      display: flex; gap: 16px;
      .bool-btn {
        flex: 1; display: flex; align-items: center; justify-content: center;
        gap: 8px; padding: 16px; border-radius: 12px;
        border: 2px solid #dce6f0; background: white;
        font-size: 16px; font-weight: 600; cursor: pointer; color: #5a6a7e;
        transition: all 0.15s;
        mat-icon { font-size: 24px; }
        &:hover { border-color: #3A9FD6; color: #3A9FD6; }
        &.selected { background: #1B2A47; color: white; border-color: #1B2A47; }
      }
    }

    .full-width { width: 100%; }

    .nav-row {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 16px; border-top: 1px solid #f0f4f8;
    }

    .thank-you {
      text-align: center; padding: 32px 0;
      .thank-you-icon {
        mat-icon { font-size: 72px; width: 72px; height: 72px; color: #27C4A0; }
        margin-bottom: 20px;
        &.already mat-icon { color: #9aa5b4; }
      }
      h2 { font-size: 24px; color: #1B2A47; margin-bottom: 12px; }
      p  { color: #5a6a7e; font-size: 15px; line-height: 1.6; margin-bottom: 28px; max-width: 400px; margin-inline: auto; }
    }

    .error-state {
      text-align: center; padding: 48px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    }
  `],
})
export class SurveyTakeComponent implements OnInit {
  template = signal<SurveyTemplate | null>(null);
  loading = signal(true);
  submitted = signal(false);
  submitting = signal(false);
  alreadySubmitted = signal(false);
  currentIndex = signal(-1); // -1 = department step
  answers = signal<Record<string, string | number | boolean>>({});
  selectedDept = '';
  departments = DEPARTMENTS;
  scaleValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  currentQuestion = () => {
    const t = this.template();
    const i = this.currentIndex();
    return t && i >= 0 ? t.questions[i] : null;
  };

  progress = () => {
    const t = this.template();
    if (!t || this.currentIndex() < 0) return 0;
    return Math.round(((this.currentIndex() + 1) / t.questions.length) * 100);
  };

  moduleIcon = () => {
    const m = this.template()?.moduleType;
    return m === 'conflict' ? 'warning_amber' : m === 'neuroinclusion' ? 'psychology' : 'trending_up';
  };

  moduleLabel = () => {
    const m = this.template()?.moduleType;
    return m === 'conflict' ? 'Conflict Intelligence' : m === 'neuroinclusion' ? 'Neuro-Inclusion' : 'Succession';
  };

  scaleClass = (n: number) => n <= 3 ? 'low' : n <= 7 ? 'mid' : 'high';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }

    // Check for prior submission before loading the survey
    this.api.get<{ alreadySubmitted: boolean }>(`/surveys/check/${id}`).subscribe({
      next: (result) => {
        if (result.alreadySubmitted) {
          this.alreadySubmitted.set(true);
          this.loading.set(false);
          return;
        }
        this.api.get<SurveyTemplate>(`/surveys/templates/${id}`).subscribe({
          next: (t) => { this.template.set(t); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        // If check fails, still load the survey — duplicate check at submit will catch it
        this.api.get<SurveyTemplate>(`/surveys/templates/${id}`).subscribe({
          next: (t) => { this.template.set(t); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
      },
    });
  }

  startSurvey(): void {
    this.currentIndex.set(0);
  }

  setAnswer(questionId: string, value: string | number | boolean): void {
    this.answers.set({ ...this.answers(), [questionId]: value });
  }

  next(): void {
    const t = this.template();
    if (t && this.currentIndex() < t.questions.length - 1) {
      this.currentIndex.set(this.currentIndex() + 1);
    }
  }

  prev(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.set(this.currentIndex() - 1);
    } else {
      this.currentIndex.set(-1);
    }
  }

  submit(): void {
    const t = this.template();
    if (!t) return;

    this.submitting.set(true);
    const responses = Object.entries(this.answers()).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    this.api.post('/surveys/respond', {
      templateId: t._id,
      departmentId: this.selectedDept || undefined,
      isAnonymous: true,
      responses,
    }).subscribe({
      next: () => { this.submitting.set(false); this.submitted.set(true); },
      error: (err) => {
        this.submitting.set(false);
        if (err.status === 409) { this.alreadySubmitted.set(true); }
      },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}

import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { ApiService } from '../../core/api.service';

interface SurveyTemplate {
  _id: string;
  title: string;
  moduleType: string;
  intakeType: 'survey' | 'interview' | 'assessment';
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'scale' | 'text' | 'boolean';
  category: string;
}

interface Coachee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
}

type Step = 'template' | 'coachee' | 'questions' | 'done';

@Component({
  selector: 'app-coach-interview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  template: `
    <div class="interview-page">
      <div class="interview-card">

        @if (loading()) {
          <div class="center-state">
            <mat-spinner diameter="40" />
            <p>Loading…</p>
          </div>
        } @else if (step() === 'done') {
          <div class="done-state">
            <div class="done-icon"><mat-icon>check_circle</mat-icon></div>
            <h2>Session Recorded</h2>
            <p>The {{ selectedTemplate()?.intakeType === 'assessment' ? 'assessment' : 'interview' }} for
              <strong>{{ selectedCoachee()?.firstName }} {{ selectedCoachee()?.lastName }}</strong> has been saved.</p>
            <div class="done-actions">
              <button mat-stroked-button (click)="reset()">
                <mat-icon>add</mat-icon> New Session
              </button>
              <button mat-raised-button color="primary" (click)="router.navigate(['/dashboard'])">
                <mat-icon>dashboard</mat-icon> Dashboard
              </button>
            </div>
          </div>

        } @else {

          <!-- Step indicator -->
          <div class="steps-bar">
            <div class="step" [class.active]="step() === 'template'" [class.done]="stepIndex() > 0">
              <div class="step-dot">{{ stepIndex() > 0 ? '✓' : '1' }}</div>
              <span>Select Template</span>
            </div>
            <div class="step-connector"></div>
            <div class="step" [class.active]="step() === 'coachee'" [class.done]="stepIndex() > 1">
              <div class="step-dot">{{ stepIndex() > 1 ? '✓' : '2' }}</div>
              <span>Select Coachee</span>
            </div>
            <div class="step-connector"></div>
            <div class="step" [class.active]="step() === 'questions'">
              <div class="step-dot">3</div>
              <span>Conduct Session</span>
            </div>
          </div>

          <!-- Step 1: Template selection -->
          @if (step() === 'template') {
            <div class="step-content">
              <h2><mat-icon>assignment</mat-icon> Choose an Intake Template</h2>
              <p class="step-hint">Select an interview or assessment template to conduct with your coachee.</p>

              @if (templates().length === 0) {
                <div class="empty-state">
                  <mat-icon>inbox</mat-icon>
                  <p>No interview or assessment templates available. Ask your admin to create one.</p>
                </div>
              } @else {
                <div class="template-list">
                  @for (t of templates(); track t._id) {
                    <div class="template-card" [class.selected]="selectedTemplateId() === t._id"
                         (click)="selectedTemplateId.set(t._id)">
                      <div class="template-top">
                        <span class="intake-badge" [class]="t.intakeType">
                          <mat-icon>{{ t.intakeType === 'assessment' ? 'fact_check' : 'record_voice_over' }}</mat-icon>
                          {{ t.intakeType | titlecase }}
                        </span>
                        <span class="module-badge" [class]="t.moduleType">{{ moduleLabelFor(t.moduleType) }}</span>
                      </div>
                      <div class="template-title">{{ t.title }}</div>
                      <div class="template-meta">{{ t.questions.length }} questions</div>
                    </div>
                  }
                </div>
                <div class="step-actions">
                  <button mat-raised-button color="primary"
                          [disabled]="!selectedTemplateId()"
                          (click)="goToCoachee()">
                    Next <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- Step 2: Coachee selection -->
          @if (step() === 'coachee') {
            <div class="step-content">
              <h2><mat-icon>person_search</mat-icon> Select Coachee</h2>
              <p class="step-hint">Choose the coachee for whom you are conducting this session.</p>

              @if (coachees().length === 0) {
                <div class="empty-state">
                  <mat-icon>person_off</mat-icon>
                  <p>No coachees found in your organization.</p>
                </div>
              } @else {
                <div class="coachee-list">
                  @for (c of coachees(); track c._id) {
                    <div class="coachee-card" [class.selected]="selectedCoacheeId() === c._id"
                         (click)="selectedCoacheeId.set(c._id)">
                      <div class="coachee-avatar">{{ c.firstName[0] }}{{ c.lastName[0] }}</div>
                      <div class="coachee-info">
                        <div class="coachee-name">{{ c.firstName }} {{ c.lastName }}</div>
                        <div class="coachee-meta">{{ c.email }}{{ c.department ? ' · ' + c.department : '' }}</div>
                      </div>
                      @if (selectedCoacheeId() === c._id) {
                        <mat-icon class="check-icon">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
                <div class="step-actions">
                  <button mat-stroked-button (click)="step.set('template')">
                    <mat-icon>arrow_back</mat-icon> Back
                  </button>
                  <button mat-raised-button color="primary"
                          [disabled]="!selectedCoacheeId()"
                          (click)="startSession()">
                    Start Session <mat-icon>play_arrow</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- Step 3: Questions -->
          @if (step() === 'questions') {
            <div class="step-content">
              <!-- Session context banner -->
              <div class="session-banner">
                <mat-icon>record_voice_over</mat-icon>
                <span>
                  <strong>{{ selectedTemplate()?.intakeType === 'assessment' ? 'Assessment' : 'Interview' }}</strong>
                  for <strong>{{ selectedCoachee()?.firstName }} {{ selectedCoachee()?.lastName }}</strong>
                  — {{ selectedTemplate()?.title }}
                </span>
              </div>

              <!-- Progress -->
              <div class="progress-row">
                <span>Question {{ currentIndex() + 1 }} of {{ selectedTemplate()!.questions.length }}</span>
                <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
              </div>

              <!-- Current question -->
              @if (currentQuestion(); as q) {
                <div class="question-block">
                  <div class="question-category">{{ q.category }}</div>
                  <p class="question-text">{{ q.text }}</p>

                  @if (q.type === 'scale') {
                    <div class="scale-container">
                      <div class="scale-labels">
                        <span>1 — Strongly Disagree</span>
                        <span>10 — Strongly Agree</span>
                      </div>
                      <div class="scale-buttons">
                        @for (n of scaleValues; track n) {
                          <button type="button" class="scale-btn"
                                  [class.selected]="answers()[q.id] === n"
                                  [class]="scaleClass(n)"
                                  (click)="setAnswer(q.id, n)">
                            {{ n }}
                          </button>
                        }
                      </div>
                      @if (answers()[q.id] !== undefined) {
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
                      <mat-label>Coachee's response</mat-label>
                      <textarea matInput rows="4"
                                [value]="answers()[q.id] ?? ''"
                                (input)="setAnswer(q.id, $any($event.target).value)">
                      </textarea>
                    </mat-form-field>
                  }

                  <div class="question-nav">
                    <button mat-stroked-button (click)="prevQuestion()" [disabled]="currentIndex() === 0">
                      <mat-icon>arrow_back</mat-icon> Previous
                    </button>
                    @if (currentIndex() < selectedTemplate()!.questions.length - 1) {
                      <button mat-raised-button color="primary"
                              [disabled]="answers()[q.id] === undefined"
                              (click)="nextQuestion()">
                        Next <mat-icon>arrow_forward</mat-icon>
                      </button>
                    } @else {
                      <button mat-raised-button color="primary"
                              [disabled]="answers()[q.id] === undefined || submitting()"
                              (click)="submit()">
                        @if (submitting()) {
                          <mat-spinner diameter="18" />
                        } @else {
                          <mat-icon>send</mat-icon>
                        }
                        {{ submitting() ? 'Saving…' : 'Submit Session' }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .interview-page {
      min-height: 100vh; background: #f0f4f8;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 32px 16px;
    }

    .interview-card {
      background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      width: 100%; max-width: 760px; padding: 32px;
    }

    .center-state {
      display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 0;
      color: #6b7280; font-size: 14px;
    }

    /* Done state */
    .done-state {
      text-align: center; padding: 40px 0;
      .done-icon { font-size: 64px; color: #27C4A0; margin-bottom: 16px;
        mat-icon { font-size: 64px; width: 64px; height: 64px; } }
      h2 { color: #1B2A47; margin-bottom: 8px; }
      p  { color: #5a6a7e; font-size: 15px; margin-bottom: 32px; }
    }
    .done-actions { display: flex; gap: 12px; justify-content: center; }

    /* Steps bar */
    .steps-bar {
      display: flex; align-items: center; gap: 0; margin-bottom: 32px;
    }
    .step {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      .step-dot {
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid #d1d5db;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; color: #9aa5b4; background: #fff;
        transition: all 0.2s;
      }
      span { font-size: 13px; color: #9aa5b4; font-weight: 500; white-space: nowrap; }
      &.active .step-dot { border-color: #3A9FD6; color: #3A9FD6; }
      &.active span { color: #1B2A47; }
      &.done .step-dot { border-color: #27C4A0; background: #27C4A0; color: #fff; }
      &.done span { color: #27C4A0; }
    }
    .step-connector { flex: 1; height: 2px; background: #e8edf4; margin: 0 8px; }

    /* Step content */
    .step-content {
      h2 {
        display: flex; align-items: center; gap: 8px; color: #1B2A47;
        font-size: 20px; margin: 0 0 6px;
        mat-icon { color: #3A9FD6; }
      }
    }
    .step-hint { color: #6b7280; font-size: 14px; margin: 0 0 24px; }

    /* Template cards */
    .template-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .template-card {
      border: 2px solid #e8edf4; border-radius: 12px; padding: 14px 16px;
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { border-color: #3A9FD6; background: rgba(58,159,214,0.04); box-shadow: 0 0 0 3px rgba(58,159,214,0.12); }
    }
    .template-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .template-title { font-size: 15px; font-weight: 600; color: #1B2A47; }
    .template-meta { font-size: 12px; color: #9aa5b4; margin-top: 4px; }

    .intake-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.interview   { background: rgba(58,97,214,0.1); color: #3050b0; }
      &.assessment  { background: rgba(240,165,0,0.12); color: #996800; }
    }
    .module-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      &.conflict        { background: rgba(232,108,58,0.1); color: #c04a14; }
      &.neuroinclusion  { background: rgba(39,196,160,0.1); color: #1a9678; }
      &.succession      { background: rgba(58,159,214,0.1); color: #2080b0; }
    }

    /* Coachee cards */
    .coachee-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
    .coachee-card {
      display: flex; align-items: center; gap: 14px;
      border: 2px solid #e8edf4; border-radius: 10px; padding: 12px 14px;
      cursor: pointer; transition: border-color 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { border-color: #3A9FD6; background: rgba(58,159,214,0.04); }
    }
    .coachee-avatar {
      width: 40px; height: 40px; border-radius: 50%; background: #3A9FD6;
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; flex-shrink: 0;
    }
    .coachee-info { flex: 1; }
    .coachee-name { font-size: 14px; font-weight: 600; color: #1B2A47; }
    .coachee-meta { font-size: 12px; color: #9aa5b4; }
    .check-icon { color: #3A9FD6; font-size: 20px; }

    /* Session banner */
    .session-banner {
      display: flex; align-items: center; gap: 10px;
      background: rgba(58,159,214,0.08); border-radius: 10px; padding: 10px 14px;
      font-size: 13px; color: #2080b0; margin-bottom: 20px;
      mat-icon { color: #3A9FD6; flex-shrink: 0; }
    }

    /* Progress */
    .progress-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
      font-size: 13px; color: #6b7280;
      mat-progress-bar { flex: 1; border-radius: 4px; }
    }

    /* Question */
    .question-block { display: flex; flex-direction: column; gap: 20px; }
    .question-category { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #3A9FD6; }
    .question-text { font-size: 18px; font-weight: 500; color: #1B2A47; margin: 0; line-height: 1.5; }

    .scale-container { display: flex; flex-direction: column; gap: 10px; }
    .scale-labels { display: flex; justify-content: space-between; font-size: 12px; color: #9aa5b4; }
    .scale-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
    .scale-btn {
      width: 44px; height: 44px; border-radius: 8px; border: 2px solid #e8edf4;
      background: #fff; cursor: pointer; font-size: 14px; font-weight: 600; color: #374151;
      transition: all 0.15s;
      &:hover { border-color: #3A9FD6; color: #3A9FD6; }
      &.selected { background: #3A9FD6; border-color: #3A9FD6; color: #fff; }
    }
    .scale-hint { font-size: 13px; color: #6b7280; margin: 0; }

    .bool-container { display: flex; gap: 16px; }
    .bool-btn {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 28px; border-radius: 12px; border: 2px solid #e8edf4;
      background: #fff; cursor: pointer; font-size: 15px; font-weight: 600; color: #374151;
      transition: all 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { background: #3A9FD6; border-color: #3A9FD6; color: #fff; }
      mat-icon { font-size: 20px; }
    }

    .full-width { width: 100%; }

    .question-nav { display: flex; justify-content: space-between; align-items: center; }

    .step-actions {
      display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;
    }

    .empty-state {
      text-align: center; padding: 40px 20px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; display: block; }
      p { font-size: 14px; }
    }
  `],
})
export class CoachInterviewComponent implements OnInit {
  private api = inject(ApiService);
  router = inject(Router);

  loading = signal(true);
  submitting = signal(false);
  step = signal<Step>('template');

  templates = signal<SurveyTemplate[]>([]);
  coachees = signal<Coachee[]>([]);

  selectedTemplateId = signal<string | null>(null);
  selectedCoacheeId = signal<string | null>(null);

  currentIndex = signal(0);
  answers = signal<Record<string, string | number | boolean>>({});

  selectedTemplate = computed(() =>
    this.templates().find((t) => t._id === this.selectedTemplateId()) ?? null
  );
  selectedCoachee = computed(() =>
    this.coachees().find((c) => c._id === this.selectedCoacheeId()) ?? null
  );
  stepIndex = computed(() => ({ template: 0, coachee: 1, questions: 2, done: 3 }[this.step()]);
  currentQuestion = computed(() => {
    const t = this.selectedTemplate();
    if (!t) return null;
    return t.questions[this.currentIndex()] ?? null;
  });
  progress = computed(() => {
    const t = this.selectedTemplate();
    if (!t) return 0;
    return ((this.currentIndex() + 1) / t.questions.length) * 100;
  });

  readonly scaleValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  ngOnInit(): void {
    this.api.get<SurveyTemplate[]>('/survey/templates').subscribe({
      next: (all) => {
        this.templates.set(all.filter((t) => t.intakeType === 'interview' || t.intakeType === 'assessment'));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.get<Coachee[]>('/users/coachees').subscribe({
      next: (list) => this.coachees.set(list),
      error: () => {},
    });
  }

  goToCoachee(): void {
    if (this.selectedTemplateId()) this.step.set('coachee');
  }

  startSession(): void {
    if (this.selectedCoacheeId()) {
      this.currentIndex.set(0);
      this.answers.set({});
      this.step.set('questions');
    }
  }

  setAnswer(questionId: string, value: string | number | boolean): void {
    this.answers.update((a) => ({ ...a, [questionId]: value }));
  }

  nextQuestion(): void {
    const t = this.selectedTemplate();
    if (!t) return;
    if (this.currentIndex() < t.questions.length - 1) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  prevQuestion(): void {
    if (this.currentIndex() > 0) this.currentIndex.update((i) => i - 1);
  }

  submit(): void {
    const t = this.selectedTemplate();
    const coachee = this.selectedCoachee();
    if (!t || !coachee) return;

    this.submitting.set(true);
    const responses = Object.entries(this.answers()).map(([questionId, value]) => ({ questionId, value }));

    this.api.post('/survey/respond', {
      templateId: t._id,
      coacheeId: coachee._id,
      isAnonymous: false,
      departmentId: coachee.department ?? null,
      responses,
    }).subscribe({
      next: () => { this.submitting.set(false); this.step.set('done'); },
      error: () => this.submitting.set(false),
    });
  }

  reset(): void {
    this.selectedTemplateId.set(null);
    this.selectedCoacheeId.set(null);
    this.currentIndex.set(0);
    this.answers.set({});
    this.step.set('template');
  }

  moduleLabelFor(moduleType: string): string {
    const map: Record<string, string> = {
      conflict: 'Conflict', neuroinclusion: 'Neuro-Inclusion', succession: 'Succession',
    };
    return map[moduleType] ?? moduleType;
  }

  scaleClass(n: number): string {
    if (n <= 3) return 'low';
    if (n <= 6) return 'mid';
    return 'high';
  }

  private inject = inject;
}

// Re-export with the inject helper properly set up
import { inject } from '@angular/core';

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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

type SessionFormat = 'individual' | 'team' | 'group';
type Step = 'template' | 'setup' | 'questions' | 'done';

const STEP_INDEX: Record<Step, number> = { template: 0, setup: 1, questions: 2, done: 3 };

const FORMAT_OPTIONS: { key: SessionFormat; label: string; icon: string; hint: string }[] = [
  { key: 'individual', label: 'Individual',  icon: 'person',       hint: 'One coachee — select from your list' },
  { key: 'team',       label: 'Team',        icon: 'group',        hint: 'A named team or working group' },
  { key: 'group',      label: 'Group',       icon: 'groups',       hint: 'A broader group or cohort session' },
];

@Component({
  selector: 'app-coach-interview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
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
            <p>
              {{ sessionFormat() === 'individual' ? 'Interview' : (selectedTemplate()?.intakeType === 'assessment' ? 'Assessment' : 'Interview') }}
              for <strong>{{ targetName() || (selectedCoachee()?.firstName + ' ' + selectedCoachee()?.lastName) }}</strong> has been saved.
            </p>
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
            <div class="step-item" [class.active]="step() === 'template'" [class.done]="stepIndex() > 0">
              <div class="step-dot">{{ stepIndex() > 0 ? '✓' : '1' }}</div>
              <span>Template</span>
            </div>
            <div class="step-connector"></div>
            <div class="step-item" [class.active]="step() === 'setup'" [class.done]="stepIndex() > 1">
              <div class="step-dot">{{ stepIndex() > 1 ? '✓' : '2' }}</div>
              <span>Setup</span>
            </div>
            <div class="step-connector"></div>
            <div class="step-item" [class.active]="step() === 'questions'">
              <div class="step-dot">3</div>
              <span>Session</span>
            </div>
          </div>

          <!-- ── Step 1: Template ── -->
          @if (step() === 'template') {
            <div class="step-content">
              <h2><mat-icon>assignment</mat-icon> Choose a Template</h2>
              <p class="step-hint">Select an interview or assessment template to conduct with your coachee.</p>

              @if (templates().length === 0) {
                <div class="empty-state">
                  <mat-icon>inbox</mat-icon>
                  <p>No interview or assessment templates available. Ask your admin to create one under Intake Templates.</p>
                </div>
              } @else {
                <div class="template-list">
                  @for (t of templates(); track t._id) {
                    <div class="template-card" [class.selected]="selectedTemplateId() === t._id"
                         (click)="selectedTemplateId.set(t._id)">
                      <div class="template-top">
                        <span class="type-badge" [class]="t.intakeType">
                          <mat-icon>{{ t.intakeType === 'assessment' ? 'fact_check' : 'record_voice_over' }}</mat-icon>
                          {{ t.intakeType | titlecase }}
                        </span>
                        <span class="module-badge" [class]="t.moduleType">{{ moduleLabelFor(t.moduleType) }}</span>
                      </div>
                      <div class="template-title">{{ t.title }}</div>
                      <div class="template-qs">{{ t.questions.length }} questions</div>
                    </div>
                  }
                </div>
                <div class="step-actions">
                  <button mat-raised-button color="primary"
                          [disabled]="!selectedTemplateId()"
                          (click)="step.set('setup')">
                    Next <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- ── Step 2: Setup (format + target + coachee if individual) ── -->
          @if (step() === 'setup') {
            <div class="step-content">
              <h2><mat-icon>tune</mat-icon> Session Setup</h2>
              <p class="step-hint">Choose the session format and identify the target.</p>

              <!-- Format picker -->
              <div class="field-label">Session Format</div>
              <div class="format-options">
                @for (f of formatOptions; track f.key) {
                  <div class="format-card" [class.selected]="sessionFormat() === f.key"
                       (click)="sessionFormat.set(f.key)">
                    <mat-icon>{{ f.icon }}</mat-icon>
                    <div class="format-label">{{ f.label }}</div>
                    <div class="format-hint">{{ f.hint }}</div>
                  </div>
                }
              </div>

              <!-- Target name -->
              <div class="field-label" style="margin-top:20px">
                {{ sessionFormat() === 'individual' ? 'Coachee Name / Identifier' : 'Team / Group Name' }}
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>
                  {{ sessionFormat() === 'individual'
                      ? 'e.g. Jane Smith — Q2 coaching session'
                      : sessionFormat() === 'team'
                        ? 'e.g. Engineering Team — Sprint retrospective'
                        : 'e.g. Leadership Cohort 2026' }}
                </mat-label>
                <input matInput [(ngModel)]="targetNameValue" />
                <mat-icon matSuffix>label</mat-icon>
              </mat-form-field>

              <!-- Coachee picker (individual only) -->
              @if (sessionFormat() === 'individual') {
                <div class="field-label" style="margin-top:4px">Select Coachee <span class="optional">(optional)</span></div>
                @if (coachees().length === 0) {
                  <p class="step-hint">No coachees found in your organization.</p>
                } @else {
                  <div class="coachee-list">
                    @for (c of coachees(); track c._id) {
                      <div class="coachee-card" [class.selected]="selectedCoacheeId() === c._id"
                           (click)="toggleCoachee(c._id)">
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
                }
              }

              <div class="step-actions">
                <button mat-stroked-button (click)="step.set('template')">
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                        [disabled]="!sessionFormat() || !targetNameValue.trim()"
                        (click)="startSession()">
                  Start Session <mat-icon>play_arrow</mat-icon>
                </button>
              </div>
            </div>
          }

          <!-- ── Step 3: Questions ── -->
          @if (step() === 'questions') {
            <div class="step-content">
              <div class="session-banner">
                <mat-icon>{{ sessionFormat() === 'individual' ? 'person' : sessionFormat() === 'team' ? 'group' : 'groups' }}</mat-icon>
                <div>
                  <div class="banner-title">{{ selectedTemplate()?.title }}</div>
                  <div class="banner-meta">
                    <span class="format-pill">{{ sessionFormat() | titlecase }}</span>
                    {{ targetName() }}
                  </div>
                </div>
              </div>

              <div class="progress-row">
                <span>Question {{ currentIndex() + 1 }} of {{ selectedTemplate()!.questions.length }}</span>
                <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
              </div>

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
                                  (click)="setAnswer(q.id, n)">{{ n }}</button>
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
                      <mat-label>Response</mat-label>
                      <textarea matInput rows="4"
                                [value]="answers()[q.id]"
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
      display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px;
    }
    .interview-card {
      background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      width: 100%; max-width: 760px; padding: 32px;
    }
    .center-state {
      display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 0;
      color: #6b7280; font-size: 14px;
    }
    .done-state {
      text-align: center; padding: 40px 0;
      .done-icon { margin-bottom: 16px; mat-icon { font-size: 64px; width: 64px; height: 64px; color: #27C4A0; } }
      h2 { color: #1B2A47; margin: 0 0 8px; }
      p  { color: #5a6a7e; font-size: 15px; margin: 0 0 32px; }
    }
    .done-actions { display: flex; gap: 12px; justify-content: center; }

    /* Steps */
    .steps-bar { display: flex; align-items: center; margin-bottom: 32px; }
    .step-item {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      .step-dot {
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid #d1d5db;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; color: #9aa5b4; background: #fff; transition: all 0.2s;
      }
      span { font-size: 13px; color: #9aa5b4; font-weight: 500; }
      &.active .step-dot { border-color: #3A9FD6; color: #3A9FD6; }
      &.active span { color: #1B2A47; }
      &.done .step-dot { border-color: #27C4A0; background: #27C4A0; color: #fff; }
      &.done span { color: #27C4A0; }
    }
    .step-connector { flex: 1; height: 2px; background: #e8edf4; margin: 0 8px; }

    /* Common step layout */
    .step-content {
      h2 { display: flex; align-items: center; gap: 8px; color: #1B2A47; font-size: 20px; margin: 0 0 6px;
           mat-icon { color: #3A9FD6; } }
    }
    .step-hint { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
    .step-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .field-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
    .optional { font-weight: 400; color: #9aa5b4; }
    .full-width { width: 100%; }

    .empty-state {
      text-align: center; padding: 40px 20px; color: #9aa5b4;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
      p { font-size: 14px; margin: 0; }
    }

    /* Template cards */
    .template-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
    .template-card {
      border: 2px solid #e8edf4; border-radius: 12px; padding: 14px 16px; cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { border-color: #3A9FD6; background: rgba(58,159,214,0.04); box-shadow: 0 0 0 3px rgba(58,159,214,0.1); }
    }
    .template-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .template-title { font-size: 15px; font-weight: 600; color: #1B2A47; }
    .template-qs { font-size: 12px; color: #9aa5b4; margin-top: 4px; }

    .type-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.interview  { background: rgba(58,97,214,0.1); color: #3050b0; }
      &.assessment { background: rgba(240,165,0,0.12); color: #996800; }
    }
    .module-badge {
      padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      &.conflict       { background: rgba(232,108,58,0.1); color: #c04a14; }
      &.neuroinclusion { background: rgba(39,196,160,0.1); color: #1a9678; }
      &.succession     { background: rgba(58,159,214,0.1); color: #2080b0; }
    }

    /* Format cards */
    .format-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .format-card {
      border: 2px solid #e8edf4; border-radius: 12px; padding: 16px 12px; cursor: pointer;
      text-align: center; transition: border-color 0.15s, box-shadow 0.15s;
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: #9aa5b4; display: block; margin: 0 auto 8px; }
      &:hover { border-color: #3A9FD6; mat-icon { color: #3A9FD6; } }
      &.selected {
        border-color: #3A9FD6; background: rgba(58,159,214,0.06); box-shadow: 0 0 0 3px rgba(58,159,214,0.12);
        mat-icon { color: #3A9FD6; }
        .format-label { color: #1B2A47; }
      }
    }
    .format-label { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    .format-hint  { font-size: 11px; color: #9aa5b4; line-height: 1.4; }

    /* Coachee cards */
    .coachee-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; max-height: 260px; overflow-y: auto; }
    .coachee-card {
      display: flex; align-items: center; gap: 14px;
      border: 2px solid #e8edf4; border-radius: 10px; padding: 10px 14px; cursor: pointer;
      transition: border-color 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { border-color: #3A9FD6; background: rgba(58,159,214,0.04); }
    }
    .coachee-avatar {
      width: 36px; height: 36px; border-radius: 50%; background: #3A9FD6; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .coachee-info { flex: 1; }
    .coachee-name { font-size: 14px; font-weight: 600; color: #1B2A47; }
    .coachee-meta { font-size: 12px; color: #9aa5b4; }
    .check-icon { color: #3A9FD6; font-size: 20px; width: 20px; height: 20px; }

    /* Session banner */
    .session-banner {
      display: flex; align-items: center; gap: 12px;
      background: rgba(58,159,214,0.08); border-radius: 10px; padding: 12px 16px;
      margin-bottom: 20px;
      mat-icon { color: #3A9FD6; flex-shrink: 0; font-size: 24px; }
    }
    .banner-title { font-size: 14px; font-weight: 600; color: #1B2A47; }
    .banner-meta  { font-size: 13px; color: #5a6a7e; display: flex; align-items: center; gap: 8px; margin-top: 2px; }
    .format-pill  {
      background: rgba(58,159,214,0.15); color: #2080b0; padding: 1px 8px;
      border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    }

    /* Progress */
    .progress-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
      font-size: 13px; color: #6b7280;
      mat-progress-bar { flex: 1; border-radius: 4px; }
    }

    /* Questions */
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
      display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 12px;
      border: 2px solid #e8edf4; background: #fff; cursor: pointer;
      font-size: 15px; font-weight: 600; color: #374151; transition: all 0.15s;
      &:hover { border-color: #3A9FD6; }
      &.selected { background: #3A9FD6; border-color: #3A9FD6; color: #fff; }
      mat-icon { font-size: 20px; }
    }

    .question-nav { display: flex; justify-content: space-between; align-items: center; }

    @media (max-width: 600px) {
      .interview-card { padding: 20px 16px; }
      .format-options { grid-template-columns: 1fr; }
      .step-item span { display: none; }
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
  coachees  = signal<Coachee[]>([]);

  selectedTemplateId = signal<string | null>(null);
  selectedCoacheeId  = signal<string | null>(null);
  sessionFormat      = signal<SessionFormat>('individual');
  targetNameValue    = '';   // plain string — bound via ngModel

  currentIndex = signal(0);
  answers = signal<Record<string, string | number | boolean>>({});

  readonly formatOptions = FORMAT_OPTIONS;
  readonly scaleValues   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  selectedTemplate = computed(() => this.templates().find((t) => t._id === this.selectedTemplateId()) ?? null);
  selectedCoachee  = computed(() => this.coachees().find((c) => c._id === this.selectedCoacheeId()) ?? null);
  targetName       = computed(() => this.targetNameValue.trim());
  stepIndex        = computed(() => STEP_INDEX[this.step()]);
  currentQuestion  = computed(() => this.selectedTemplate()?.questions[this.currentIndex()] ?? null);
  progress         = computed(() => {
    const t = this.selectedTemplate();
    return t ? ((this.currentIndex() + 1) / t.questions.length) * 100 : 0;
  });

  ngOnInit(): void {
    this.api.get<SurveyTemplate[]>('/surveys/templates').subscribe({
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

  toggleCoachee(id: string): void {
    this.selectedCoacheeId.set(this.selectedCoacheeId() === id ? null : id);
  }

  startSession(): void {
    this.currentIndex.set(0);
    this.answers.set({});
    this.step.set('questions');
  }

  setAnswer(questionId: string, value: string | number | boolean): void {
    this.answers.update((a) => ({ ...a, [questionId]: value }));
  }

  nextQuestion(): void {
    const t = this.selectedTemplate();
    if (t && this.currentIndex() < t.questions.length - 1) this.currentIndex.update((i) => i + 1);
  }

  prevQuestion(): void {
    if (this.currentIndex() > 0) this.currentIndex.update((i) => i - 1);
  }

  submit(): void {
    const t = this.selectedTemplate();
    if (!t) return;

    this.submitting.set(true);
    const responses = Object.entries(this.answers()).map(([questionId, value]) => ({ questionId, value }));

    const body: Record<string, unknown> = {
      templateId:    t._id,
      isAnonymous:   false,
      sessionFormat: this.sessionFormat(),
      targetName:    this.targetName(),
      responses,
    };

    const coachee = this.selectedCoachee();
    if (coachee) {
      body['coacheeId']   = coachee._id;
      body['departmentId'] = coachee.department ?? null;
    }

    this.api.post('/surveys/respond', body).subscribe({
      next: () => { this.submitting.set(false); this.step.set('done'); },
      error: () => this.submitting.set(false),
    });
  }

  reset(): void {
    this.selectedTemplateId.set(null);
    this.selectedCoacheeId.set(null);
    this.sessionFormat.set('individual');
    this.targetNameValue = '';
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
}

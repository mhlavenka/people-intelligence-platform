import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/api.service';

interface Dimension {
  name: string;
  description: string;
  score: number;
}

const DIMENSIONS: Omit<Dimension, 'score'>[] = [
  { name: 'Awareness & Culture', description: 'Understanding and appreciation of neurodiversity in the workplace' },
  { name: 'Recruitment & Onboarding', description: 'Inclusive hiring practices and accessible onboarding' },
  { name: 'Workspace & Environment', description: 'Physical and digital environment accommodations' },
  { name: 'Communication & Collaboration', description: 'Flexible communication styles and teamwork approaches' },
  { name: 'Leadership & Management', description: 'Manager capability to support neurodivergent employees' },
  { name: 'Policy & Process', description: 'Formal policies supporting neuroinclusion' },
  { name: 'Learning & Development', description: 'Accessible training and growth opportunities' },
];

@Component({
  selector: 'app-neuroinclusion-assessment',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSliderModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="assessment-page">
      <div class="page-header">
        <h1>Neuro-Inclusion Compass™</h1>
        <p>Assess your organization's neuroinclusion maturity across 7 dimensions</p>
      </div>

      @if (completed()) {
        <!-- Results view -->
        <div class="results-card">
          <div class="results-header">
            <div class="score-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e8edf4" stroke-width="10"/>
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  [attr.stroke]="scoreColor()"
                  stroke-width="10"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="scoreDash()"
                  stroke-dashoffset="66"
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="46" text-anchor="middle" class="score-num">{{ overallScore() }}</text>
                <text x="50" y="62" text-anchor="middle" class="score-sub">/100</text>
              </svg>
            </div>
            <div class="results-summary">
              <h2>Assessment Complete</h2>
              <p class="maturity-level">Maturity Level: <strong>{{ maturityLabel() }}</strong></p>
              <p>Your AI gap analysis and action roadmap have been generated.</p>
            </div>
          </div>

          <div class="dimension-results">
            @for (dim of scoredDimensions(); track dim.name) {
              <div class="dim-result">
                <span class="dim-name">{{ dim.name }}</span>
                <div class="dim-bar">
                  <div class="dim-fill" [style.width.%]="dim.score" [class]="scoreClass(dim.score)"></div>
                </div>
                <span class="dim-score">{{ dim.score }}</span>
              </div>
            }
          </div>

          <button mat-raised-button color="primary" (click)="startNew()">Start New Assessment</button>
        </div>
      } @else {
        <!-- Assessment form -->
        <div class="assessment-card">
          <div class="progress-header">
            <span>Step {{ currentStep() + 1 }} of {{ totalSteps }}</span>
            <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
          </div>

          <mat-stepper orientation="vertical" [linear]="true" #stepper (selectionChange)="onStepChange($event.selectedIndex)">
            <!-- Role step -->
            <mat-step label="Your Role" [stepControl]="roleGroup">
              <div class="step-content" [formGroup]="roleGroup">
                <p class="step-description">Tell us about your role to contextualize the assessment.</p>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Your Role</mat-label>
                  <mat-select formControlName="respondentRole">
                    <mat-option value="hr_manager">HR Manager</mat-option>
                    <mat-option value="executive">Executive / C-Suite</mat-option>
                    <mat-option value="manager">People Manager</mat-option>
                    <mat-option value="individual_contributor">Individual Contributor</mat-option>
                    <mat-option value="dei_specialist">DEI Specialist</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary" matStepperNext type="button"
                        [disabled]="roleGroup.invalid">
                  Continue →
                </button>
              </div>
            </mat-step>

            <!-- Dimension steps -->
            @for (dim of dimensions; track dim.name; let i = $index) {
              <mat-step [label]="dim.name">
                <div class="step-content">
                  <p class="step-description">{{ dim.description }}</p>
                  <div class="score-question">
                    <label>Rate your organization's current maturity in this dimension:</label>
                    <div class="slider-container">
                      <span class="slider-label">Beginner</span>
                      <mat-slider min="0" max="100" step="5" class="score-slider">
                        <input matSliderThumb [value]="dim.score" (valueChange)="updateScore(i, $event)" />
                      </mat-slider>
                      <span class="slider-label">Advanced</span>
                    </div>
                    <div class="score-display" [class]="scoreClass(dim.score)">
                      {{ dim.score }} / 100
                    </div>
                  </div>
                  <div class="step-actions">
                    <button mat-button matStepperPrevious type="button">Back</button>
                    <button mat-raised-button color="primary" matStepperNext type="button">Continue →</button>
                  </div>
                </div>
              </mat-step>
            }

            <!-- Submit step -->
            <mat-step label="Review & Submit">
              <div class="step-content">
                <h3>Review Your Scores</h3>
                @for (dim of dimensions; track dim.name) {
                  <div class="review-row">
                    <span>{{ dim.name }}</span>
                    <span class="review-score" [class]="scoreClass(dim.score)">{{ dim.score }}</span>
                  </div>
                }
                <div class="step-actions" style="margin-top: 24px;">
                  <button mat-button matStepperPrevious type="button">Back</button>
                  <button mat-raised-button color="primary" (click)="submit()" [disabled]="submitting()">
                    @if (submitting()) { <mat-spinner diameter="18" /> }
                    @else { Generate AI Analysis }
                  </button>
                </div>
              </div>
            </mat-step>
          </mat-stepper>
        </div>
      }
    </div>
  `,
  styles: [`
    .assessment-page { padding: 32px; max-width: 800px; }
    .page-header { margin-bottom: 28px; h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; } p { color: #5a6a7e; margin: 0; } }

    .assessment-card, .results-card {
      background: white; border-radius: 16px; padding: 32px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    }

    .progress-header {
      display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;
      span { font-size: 13px; color: #5a6a7e; }
    }

    .step-content { padding-top: 16px; }
    .step-description { color: #5a6a7e; font-size: 14px; margin-bottom: 20px; }
    .full-width { width: 100%; }

    .slider-container {
      display: flex; align-items: center; gap: 12px; margin: 16px 0;
      .slider-label { font-size: 12px; color: #9aa5b4; white-space: nowrap; }
      .score-slider { flex: 1; }
    }

    .score-display {
      display: inline-block; font-size: 24px; font-weight: 700; padding: 8px 20px;
      border-radius: 8px; margin-top: 8px;
      &.excellent { background: rgba(39,196,160,0.15); color: #1a9678; }
      &.good      { background: rgba(58,159,214,0.15); color: #2080b0; }
      &.fair      { background: rgba(240,165,0,0.15);  color: #b07800; }
      &.poor      { background: rgba(229,62,62,0.15);  color: #c53030; }
    }

    .step-actions { display: flex; gap: 12px; align-items: center; margin-top: 16px; }

    .score-question label { font-size: 14px; color: #1B2A47; font-weight: 500; }

    .review-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid #f0f4f8; font-size: 14px;
      .review-score {
        font-weight: 700; padding: 2px 12px; border-radius: 99px;
        &.excellent { background: rgba(39,196,160,0.15); color: #1a9678; }
        &.good      { background: rgba(58,159,214,0.15); color: #2080b0; }
        &.fair      { background: rgba(240,165,0,0.15);  color: #b07800; }
        &.poor      { background: rgba(229,62,62,0.15);  color: #c53030; }
      }
    }

    .results-header {
      display: flex; gap: 24px; align-items: center; margin-bottom: 28px;
      .score-circle { width: 100px; height: 100px; flex-shrink: 0; .score-num { font-size: 22px; font-weight: 700; fill: #1B2A47; } .score-sub { font-size: 10px; fill: #9aa5b4; } }
      h2 { font-size: 22px; color: #1B2A47; margin-bottom: 4px; }
      .maturity-level { font-size: 14px; color: #5a6a7e; margin: 0 0 8px; strong { color: #27C4A0; } }
    }

    .dimension-results { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .dim-result {
      display: flex; align-items: center; gap: 12px;
      .dim-name  { width: 200px; font-size: 13px; color: #5a6a7e; flex-shrink: 0; }
      .dim-bar   { flex: 1; height: 8px; background: #e8edf4; border-radius: 4px; overflow: hidden; }
      .dim-fill  { height: 100%; border-radius: 4px; transition: width 0.5s; &.excellent { background: #27C4A0; } &.good { background: #3A9FD6; } &.fair { background: #f0a500; } &.poor { background: #e53e3e; } }
      .dim-score { width: 32px; font-size: 13px; font-weight: 600; color: #1B2A47; }
    }
  `],
})
export class NeuroinclustionAssessmentComponent implements OnInit {
  dimensions: Dimension[] = DIMENSIONS.map((d) => ({ ...d, score: 50 }));
  totalSteps = DIMENSIONS.length + 2; // role + dimensions + review
  currentStep = signal(0);
  submitting = signal(false);
  completed = signal(false);
  overallScore = signal(0);
  scoredDimensions = signal<Dimension[]>([]);

  roleGroup: FormGroup;

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.roleGroup = this.fb.group({
      respondentRole: ['', Validators.required],
    });
  }

  ngOnInit(): void {}

  progress = () => Math.round((this.currentStep() / (this.totalSteps - 1)) * 100);

  onStepChange(index: number): void {
    this.currentStep.set(index);
  }

  updateScore(index: number, value: number): void {
    this.dimensions[index].score = value;
  }

  scoreClass(score: number): string {
    if (score >= 75) return 'excellent';
    if (score >= 50) return 'good';
    if (score >= 25) return 'fair';
    return 'poor';
  }

  scoreColor(): string {
    return this.scoreClass(this.overallScore()) === 'excellent' ? '#27C4A0'
         : this.scoreClass(this.overallScore()) === 'good'      ? '#3A9FD6'
         : this.scoreClass(this.overallScore()) === 'fair'      ? '#f0a500'
         : '#e53e3e';
  }

  scoreDash(): string {
    const circumference = 2 * Math.PI * 42;
    const filled = (this.overallScore() / 100) * circumference;
    return `${filled} ${circumference}`;
  }

  maturityLabel(): string {
    const s = this.overallScore();
    if (s >= 75) return 'Advanced';
    if (s >= 50) return 'Developing';
    if (s >= 25) return 'Emerging';
    return 'Beginning';
  }

  submit(): void {
    this.submitting.set(true);
    const payload = {
      respondentRole: this.roleGroup.value.respondentRole,
      dimensions: this.dimensions.map((d) => ({
        name: d.name,
        score: d.score,
        responses: {},
      })),
    };

    this.api.post<{ overallMaturityScore: number }>('/neuroinclusion/assess', payload).subscribe({
      next: (result) => {
        const avg = Math.round(this.dimensions.reduce((s, d) => s + d.score, 0) / this.dimensions.length);
        this.overallScore.set(result.overallMaturityScore || avg);
        this.scoredDimensions.set([...this.dimensions]);
        this.completed.set(true);
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }

  startNew(): void {
    this.completed.set(false);
    this.dimensions = DIMENSIONS.map((d) => ({ ...d, score: 50 }));
    this.currentStep.set(0);
  }
}

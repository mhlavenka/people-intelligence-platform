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
import { TranslateModule } from '@ngx-translate/core';

interface Dimension {
  name: string;
  description: string;
  score: number;
}

const DIMENSIONS: Omit<Dimension, 'score'>[] = [
  { name: 'Awareness & Culture', description: 'Organization-wide understanding and genuine appreciation of neurodiversity — from leadership commitment to team-level norms' },
  { name: 'Recruitment & Onboarding', description: 'Inclusive hiring practices, accessible job postings, alternative interview formats, and structured onboarding for neurodivergent hires' },
  { name: 'Workspace & Physical Environment', description: 'Physical accommodations: sensory-friendly spaces, quiet zones, flexible seating, and lighting adjustments' },
  { name: 'Communication & Collaboration', description: 'Flexible communication styles, written vs. verbal options, meeting structure, and asynchronous work support' },
  { name: 'Leadership & Management', description: 'Manager capability to recognize, support, and advocate for neurodivergent employees — coaching skills and individualized approaches' },
  { name: 'Policy & Accommodation Process', description: 'Formal policies supporting neuroinclusion, clear accommodation request pathways, and legally compliant response processes' },
  { name: 'Learning & Development', description: 'Accessible training content, multiple learning modalities, and growth opportunities that do not disadvantage neurodivergent employees' },
  { name: 'Workflow Design & Task Structure', description: 'How work is structured, sequenced, and communicated — supporting executive function, reducing ambiguity, and enabling deep focus' },
];

interface AssessmentResult {
  overallMaturityScore: number;
  dimensions: Dimension[];
  aiGapAnalysis?: string | string[];
  actionRoadmap?: string[];
  quickWins?: string[];
  longTermInitiatives?: string[];
  completedAt?: string;
}

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
    TranslateModule,
  ],
  template: `
    <div class="assessment-page" [class.results-mode]="completed()">
      <div class="page-header">
        <h1>{{ "NEURO.title" | translate }}</h1>
        <p>{{ "NEURO.subtitle" | translate }}</p>
      </div>

      <!-- Module description banner -->
      @if (!completed() && !loading()) {
        <div class="module-banner">
          <div class="banner-insight">
            <mat-icon class="banner-icon">psychology</mat-icon>
            <p [innerHTML]="'NEURO.marketTiming' | translate"></p>
          </div>
          <div class="banner-features">
            <span class="feature-pill"><mat-icon>assessment</mat-icon> {{ 'NEURO.pill8Dim' | translate }}</span>
            <span class="feature-pill"><mat-icon>auto_fix_high</mat-icon> {{ 'NEURO.pillAIGap' | translate }}</span>
            <span class="feature-pill"><mat-icon>school</mat-icon> {{ 'NEURO.pillTraining' | translate }}</span>
            <span class="feature-pill"><mat-icon>assignment_turned_in</mat-icon> {{ 'NEURO.pillAccommodation' | translate }}</span>
            <span class="feature-pill"><mat-icon>trending_up</mat-icon> {{ 'NEURO.pillProgress' | translate }}</span>
            <span class="feature-pill"><mat-icon>groups</mat-icon> {{ 'NEURO.pillPeerLearning' | translate }}</span>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="40" /></div>
      } @else if (completed()) {
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
              <h2>{{ "NEURO.assessmentComplete" | translate }}</h2>
              <p class="maturity-level">{{ 'NEURO.maturityLevel' | translate }} <strong>{{ maturityLabel() }}</strong></p>
              @if (completedAt()) {
                <p class="completed-date">Completed {{ completedAt() | date:'MMM d, y' }}</p>
              }
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

          @if (aiGapAnalysis().length > 0 || actionRoadmap().length > 0) {
            <div class="ai-report">

              @if (aiGapAnalysis().length > 0) {
                <div class="report-section gap-analysis">
                  <div class="section-heading">
                    <div class="section-icon blue"><mat-icon>psychology</mat-icon></div>
                    <h3>{{ "NEURO.gapAnalysis" | translate }}</h3>
                  </div>
                  <div class="gap-paragraphs">
                    @for (para of aiGapAnalysis(); track $index) {
                      <p>{{ para }}</p>
                    }
                  </div>
                </div>
              }

              <div class="report-grid">

                @if (actionRoadmap().length > 0) {
                  <div class="report-section">
                    <div class="section-heading">
                      <div class="section-icon navy"><mat-icon>route</mat-icon></div>
                      <h3>{{ "NEURO.actionRoadmap" | translate }}</h3>
                    </div>
                    <ol class="action-list">
                      @for (action of actionRoadmap(); track $index) {
                        <li>
                          <span class="action-num">{{ $index + 1 }}</span>
                          <span>{{ action }}</span>
                        </li>
                      }
                    </ol>
                  </div>
                }

                <div class="report-col-right">
                  @if (quickWins().length > 0) {
                    <div class="report-section quick-wins">
                      <div class="section-heading">
                        <div class="section-icon green"><mat-icon>bolt</mat-icon></div>
                        <h3>{{ 'NEURO.quickWins' | translate }} <span class="timeframe">{{ 'NEURO.within30Days' | translate }}</span></h3>
                      </div>
                      <ul class="bullet-list">
                        @for (win of quickWins(); track $index) {
                          <li>{{ win }}</li>
                        }
                      </ul>
                    </div>
                  }

                  @if (longTermInitiatives().length > 0) {
                    <div class="report-section long-term">
                      <div class="section-heading">
                        <div class="section-icon orange"><mat-icon>flag</mat-icon></div>
                        <h3>{{ 'NEURO.longTermInitiatives' | translate }} <span class="timeframe">{{ 'NEURO.sixToTwelveMonths' | translate }}</span></h3>
                      </div>
                      <ul class="bullet-list">
                        @for (item of longTermInitiatives(); track $index) {
                          <li>{{ item }}</li>
                        }
                      </ul>
                    </div>
                  }
                </div>

              </div>
            </div>
          }

          <div class="results-actions">
            <button mat-raised-button color="primary" (click)="startNew()">
              <mat-icon>refresh</mat-icon> {{ 'NEURO.retakeAssessment' | translate }}
            </button>
          </div>
        </div>

        <!-- Accommodation Request Workflow -->
        @if (completed()) {
          <div class="section-card accommodation-section">
            <div class="section-header">
              <div class="section-icon purple">
                <mat-icon>assignment_turned_in</mat-icon>
              </div>
              <div>
                <h3>Accommodation Request Workflow</h3>
                <p>Structured intake and response process for employee accommodation needs. Ensures legally compliant, consistent, and person-centred responses across your organization.</p>
              </div>
            </div>
            <div class="accommodation-steps">
              <div class="accom-step">
                <div class="accom-step-num">1</div>
                <div class="accom-step-body">
                  <strong>Employee Submits Request</strong>
                  <span>Confidential intake form capturing the employee's needs, preferred accommodations, and any supporting documentation.</span>
                </div>
              </div>
              <div class="accom-step">
                <div class="accom-step-num">2</div>
                <div class="accom-step-body">
                  <strong>HR Review & Assessment</strong>
                  <span>HR reviews the request within 5 business days. AI generates a draft accommodation plan for HR to review and adapt.</span>
                </div>
              </div>
              <div class="accom-step">
                <div class="accom-step-num">3</div>
                <div class="accom-step-body">
                  <strong>Implementation & Agreement</strong>
                  <span>Accommodation plan is confirmed with the employee, manager, and HR — all parties receive a copy.</span>
                </div>
              </div>
              <div class="accom-step">
                <div class="accom-step-num">4</div>
                <div class="accom-step-body">
                  <strong>90-Day Check-in</strong>
                  <span>Automated follow-up survey to evaluate accommodation effectiveness and adjust as needed.</span>
                </div>
              </div>
            </div>
            <button mat-raised-button color="primary" class="accom-btn" disabled>
              <mat-icon>add</mat-icon> Submit Accommodation Request
              <span class="coming-soon">Coming soon</span>
            </button>
          </div>

          <!-- Manager Training Modules -->
          <div class="section-card training-section">
            <div class="section-header">
              <div class="section-icon teal">
                <mat-icon>school</mat-icon>
              </div>
              <div>
                <h3>Manager Training Modules</h3>
                <p>Microlearning content on supporting neurodivergent employees — practical, evidence-based, and designed for people managers without clinical backgrounds.</p>
              </div>
            </div>
            <div class="training-grid">
              @for (module of trainingModules; track module.title) {
                <div class="training-card">
                  <div class="training-icon" [style.background]="module.color + '18'" [style.color]="module.color">
                    <mat-icon>{{ module.icon }}</mat-icon>
                  </div>
                  <div class="training-info">
                    <strong>{{ module.title }}</strong>
                    <span>{{ module.description }}</span>
                    <div class="training-meta">
                      <span class="training-duration"><mat-icon>schedule</mat-icon> {{ module.duration }}</span>
                      <span class="training-badge" [style.color]="module.color" [style.border-color]="module.color">{{ module.badge }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

      } @else {
        <!-- Assessment form -->
        <div class="assessment-card">
          <div class="progress-header">
            <span>Step {{ currentStep() + 1 }} of {{ totalSteps }}</span>
            <mat-progress-bar mode="determinate" [value]="progress()"></mat-progress-bar>
          </div>

          <mat-stepper orientation="vertical" [linear]="true" #stepper (selectionChange)="onStepChange($event.selectedIndex)">
            <!-- Role step -->
            <mat-step [label]="'NEURO.yourRole' | translate" [stepControl]="roleGroup">
              <div class="step-content" [formGroup]="roleGroup">
                <p class="step-description">{{ 'NEURO.roleDescription' | translate }}</p>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'NEURO.yourRole' | translate }}</mat-label>
                  <mat-select formControlName="respondentRole">
                    <mat-option value="hr_manager">{{ 'NEURO.roleHrManager' | translate }}</mat-option>
                    <mat-option value="executive">{{ 'NEURO.roleExecutive' | translate }}</mat-option>
                    <mat-option value="manager">{{ 'NEURO.rolePeopleManager' | translate }}</mat-option>
                    <mat-option value="individual_contributor">{{ 'NEURO.roleIndividualContributor' | translate }}</mat-option>
                    <mat-option value="dei_specialist">{{ 'NEURO.roleDeiSpecialist' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary" matStepperNext type="button"
                        [disabled]="roleGroup.invalid">
                  {{ 'NEURO.continue' | translate }} →
                </button>
              </div>
            </mat-step>

            <!-- Dimension steps -->
            @for (dim of dimensions; track dim.name; let i = $index) {
              <mat-step [label]="dim.name">
                <div class="step-content">
                  <p class="step-description">{{ dim.description }}</p>
                  <div class="score-question">
                    <label>{{ 'NEURO.rateMaturity' | translate }}</label>
                    <div class="slider-container">
                      <span class="slider-label">{{ 'NEURO.beginner' | translate }}</span>
                      <mat-slider min="0" max="100" step="5" class="score-slider">
                        <input matSliderThumb [value]="dim.score" (valueChange)="updateScore(i, $event)" />
                      </mat-slider>
                      <span class="slider-label">{{ 'NEURO.advanced' | translate }}</span>
                    </div>
                    <div class="score-display" [class]="scoreClass(dim.score)">
                      {{ dim.score }} / 100
                    </div>
                  </div>
                  <div class="step-actions">
                    <button mat-button matStepperPrevious type="button">{{ 'COMMON.back' | translate }}</button>
                    <button mat-raised-button color="primary" matStepperNext type="button">{{ 'NEURO.continue' | translate }} →</button>
                  </div>
                </div>
              </mat-step>
            }

            <!-- Submit step -->
            <mat-step [label]="'NEURO.reviewSubmit' | translate">
              <div class="step-content">
                <h3>{{ 'NEURO.reviewYourScores' | translate }}</h3>
                @for (dim of dimensions; track dim.name) {
                  <div class="review-row">
                    <span>{{ dim.name }}</span>
                    <span class="review-score" [class]="scoreClass(dim.score)">{{ dim.score }}</span>
                  </div>
                }
                <div class="step-actions" style="margin-top: 24px;">
                  <button mat-button matStepperPrevious type="button">{{ 'COMMON.back' | translate }}</button>
                  <button mat-raised-button color="primary" (click)="submit()" [disabled]="submitting()">
                    @if (submitting()) { <mat-spinner diameter="18" /> }
                    @else { {{ 'NEURO.generateAIAnalysis' | translate }} }
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
    .assessment-page.results-mode { max-width: 100%; }
    .page-header { margin-bottom: 28px; h1 { font-size: 28px; color: var(--artes-primary); margin: 0 0 4px; } p { color: #5a6a7e; margin: 0; } }

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

    .score-question label { font-size: 14px; color: var(--artes-primary); font-weight: 500; }

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
      h2 { font-size: 22px; color: var(--artes-primary); margin-bottom: 4px; }
      .maturity-level { font-size: 14px; color: #5a6a7e; margin: 0 0 8px; strong { color: #27C4A0; } }
    }

    .center-spinner { display: flex; justify-content: center; padding: 80px; }

    .completed-date { font-size: 12px; color: #9aa5b4; margin: 0; }

    /* ── AI Report ───────────────────────────────────────────── */
    .ai-report {
      margin: 24px 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .report-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .report-col-right {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .report-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 18px 20px;
      border-left: 3px solid transparent;

      &.gap-analysis  { border-left-color: var(--artes-accent); }
      &.quick-wins    { border-left-color: #27C4A0; }
      &.long-term     { border-left-color: #f0a500; }
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;

      h3 {
        font-size: 14px;
        font-weight: 700;
        color: var(--artes-primary);
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
    }

    .section-icon {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.blue   { background: rgba(58,159,214,0.12);  color: #2080b0; }
      &.navy   { background: rgba(27,42,71,0.08);    color: var(--artes-primary); }
      &.green  { background: rgba(39,196,160,0.12);  color: #1a9678; }
      &.orange { background: rgba(240,165,0,0.12);   color: #b07800; }
    }

    .timeframe {
      font-size: 11px;
      font-weight: 500;
      color: #9aa5b4;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .gap-paragraphs {
      p {
        font-size: 14px;
        color: #374151;
        line-height: 1.7;
        margin: 0 0 10px;
        &:last-child { margin-bottom: 0; }
      }
    }

    .action-list {
      list-style: none;
      margin: 0; padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;

      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13px;
        color: #374151;
        line-height: 1.5;
      }
    }

    .action-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px; height: 22px;
      border-radius: 50%;
      background: var(--artes-primary);
      color: white;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .bullet-list {
      margin: 0; padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;

      li {
        font-size: 13px;
        color: #374151;
        line-height: 1.5;
        padding-left: 16px;
        position: relative;
        &::before {
          content: '';
          position: absolute;
          left: 0; top: 8px;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #27C4A0;
        }
      }
    }

    .long-term .bullet-list li::before { background: #f0a500; }

    .dimension-results { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .dim-result {
      display: flex; align-items: center; gap: 12px;
      .dim-name  { width: 220px; font-size: 13px; color: #5a6a7e; flex-shrink: 0; }
      .dim-bar   { flex: 1; height: 8px; background: #e8edf4; border-radius: 4px; overflow: hidden; }
      .dim-fill  { height: 100%; border-radius: 4px; transition: width 0.5s; &.excellent { background: #27C4A0; } &.good { background: var(--artes-accent); } &.fair { background: #f0a500; } &.poor { background: #e53e3e; } }
      .dim-score { width: 32px; font-size: 13px; font-weight: 600; color: var(--artes-primary); }
    }

    .results-actions { margin-top: 8px; }

    /* ── Module banner ── */
    .module-banner {
      background: linear-gradient(135deg, #1a4731 0%, #1e5438 100%);
      border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; color: white;
    }
    .banner-insight {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;
      .banner-icon { color: #4ade80; font-size: 22px; flex-shrink: 0; margin-top: 2px; }
      p { font-size: 13.5px; color: rgba(255,255,255,0.88); line-height: 1.7; margin: 0; }
      strong { color: white; }
    }
    .banner-features { display: flex; flex-wrap: wrap; gap: 8px; }
    .feature-pill {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.18); border-radius: 20px;
      font-size: 12px; color: rgba(255,255,255,0.9);
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* ── Section cards ── */
    .section-card {
      background: white; border-radius: 16px; padding: 28px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-top: 20px;
    }
    .section-header {
      display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px;
      h3 { font-size: 17px; color: var(--artes-primary); margin: 0 0 4px; font-weight: 700; }
      p  { font-size: 13px; color: #5a6a7e; margin: 0; line-height: 1.6; }
    }
    .section-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 22px; }
      &.purple { background: rgba(124,58,237,0.12); color: #7c3aed; }
      &.teal   { background: rgba(39,196,160,0.12); color: #1a9678; }
    }

    /* ── Accommodation workflow ── */
    .accommodation-steps { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
    .accom-step {
      display: flex; gap: 12px; align-items: flex-start;
      background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 14px 16px;
    }
    .accom-step-num {
      width: 26px; height: 26px; background: #7c3aed; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; flex-shrink: 0;
    }
    .accom-step-body {
      display: flex; flex-direction: column; gap: 3px;
      strong { font-size: 13px; color: var(--artes-primary); }
      span   { font-size: 12px; color: #5a6a7e; line-height: 1.5; }
    }
    .accom-btn { position: relative; }
    .coming-soon {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      background: #f0c040; color: #7a5800;
      padding: 2px 6px; border-radius: 4px; margin-left: 8px; letter-spacing: 0.5px;
    }

    /* ── Manager training ── */
    .training-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .training-card {
      display: flex; gap: 14px; align-items: flex-start;
      padding: 16px; border: 1px solid #e8edf4; border-radius: 12px;
      background: #fafbfc; transition: background 0.15s;
      &:hover { background: #f0f4f8; }
    }
    .training-icon {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }
    .training-info {
      display: flex; flex-direction: column; gap: 4px;
      strong { font-size: 13px; color: var(--artes-primary); }
      span   { font-size: 12px; color: #5a6a7e; line-height: 1.5; }
    }
    .training-meta { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .training-duration {
      display: flex; align-items: center; gap: 3px;
      font-size: 11px; color: #9aa5b4;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .training-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px;
      border: 1px solid; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.4px;
    }
  `],
})
export class NeuroinclustionAssessmentComponent implements OnInit {
  dimensions: Dimension[] = DIMENSIONS.map((d) => ({ ...d, score: 50 }));
  totalSteps = DIMENSIONS.length + 2; // role + dimensions + review

  trainingModules = [
    {
      title: 'Understanding ADHD at Work',
      description: 'Practical strategies for supporting employees with ADHD — task structure, deadline flexibility, and reducing distraction.',
      icon: 'bolt',
      color: '#f0a500',
      duration: '15 min',
      badge: 'ADHD',
    },
    {
      title: 'Autism Spectrum in the Workplace',
      description: 'Sensory considerations, communication preferences, social expectations, and creating predictable environments.',
      icon: 'hub',
      color: '#3A9FD6',
      duration: '20 min',
      badge: 'Autism',
    },
    {
      title: 'Dyslexia & Dyscalculia Support',
      description: 'Reading and numeracy accommodations, alternative formats, assistive technology, and assessment adjustments.',
      icon: 'text_fields',
      color: '#27C4A0',
      duration: '12 min',
      badge: 'Dyslexia',
    },
    {
      title: 'Sensory Sensitivities & Environment',
      description: 'How to identify sensory triggers, adapt physical workspaces, and support employees with sensory processing differences.',
      icon: 'sensors',
      color: '#7c3aed',
      duration: '10 min',
      badge: 'Sensory',
    },
    {
      title: 'Inclusive Communication Practices',
      description: 'Clear, direct communication; written vs. verbal preferences; meeting structure; and reducing ambiguity.',
      icon: 'forum',
      color: '#e86c3a',
      duration: '18 min',
      badge: 'Communication',
    },
    {
      title: 'Executive Function & Task Design',
      description: 'Structuring work to support planning, prioritization, and task initiation — for managers and team leads.',
      icon: 'checklist',
      color: '#1B2A47',
      duration: '14 min',
      badge: 'Workflow',
    },
  ];
  currentStep = signal(0);
  submitting  = signal(false);
  loading     = signal(true);
  completed   = signal(false);
  overallScore       = signal(0);
  scoredDimensions   = signal<Dimension[]>([]);
  aiGapAnalysis        = signal<string[]>([]);
  actionRoadmap        = signal<string[]>([]);
  quickWins            = signal<string[]>([]);
  longTermInitiatives  = signal<string[]>([]);
  completedAt        = signal<string | null>(null);

  roleGroup: FormGroup;

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.roleGroup = this.fb.group({
      respondentRole: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.api.get<AssessmentResult | null>('/neuroinclusion/assessments/latest').subscribe({
      next: (result) => {
        this.loading.set(false);
        if (result) {
          this.restoreResult(result);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private restoreResult(result: AssessmentResult): void {
    this.overallScore.set(result.overallMaturityScore);
    this.scoredDimensions.set(result.dimensions ?? [...this.dimensions]);

    let gapRaw: unknown  = result.aiGapAnalysis;
    let roadmapRaw: unknown  = result.actionRoadmap       ?? [];
    let quickRaw: unknown    = result.quickWins           ?? [];
    let longRaw: unknown     = result.longTermInitiatives ?? [];

    // Legacy records stored the full raw AI response in aiGapAnalysis —
    // strip markdown fences then try to parse as a JSON envelope
    if (typeof gapRaw === 'string') {
      const stripped = gapRaw
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
      if (stripped.startsWith('{')) {
        try {
          const p = JSON.parse(stripped);
          gapRaw     = p['aiGapAnalysis']       ?? gapRaw;
          roadmapRaw = p['actionRoadmap']       ?? roadmapRaw;
          quickRaw   = p['quickWins']           ?? quickRaw;
          longRaw    = p['longTermInitiatives'] ?? longRaw;
        } catch { /* not valid JSON */ }
      }
    }

    this.aiGapAnalysis.set(this.toParas(gapRaw));
    this.actionRoadmap.set(this.toStrings(roadmapRaw));
    this.quickWins.set(this.toStrings(quickRaw));
    this.longTermInitiatives.set(this.toStrings(longRaw));
    this.completedAt.set(result.completedAt ?? null);
    this.completed.set(true);
  }

  /** Normalise an unknown value to an array of paragraph strings. */
  private toParas(val: unknown): string[] {
    if (Array.isArray(val)) return this.toStrings(val);
    if (typeof val === 'string') {
      const clean = val.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      return clean.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  /** Normalise an array that may contain plain strings or Claude-style objects. */
  private toStrings(val: unknown): string[] {
    if (!Array.isArray(val)) return [];
    return val.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const text = o['action'] ?? o['initiative'] ?? o['description'] ?? o['detail'] ?? Object.values(o)[0] ?? '';
        const tl   = typeof o['timeline'] === 'string' ? ` (${o['timeline']})` : '';
        return `${String(text)}${tl}`.trim();
      }
      return String(item).trim();
    }).filter(Boolean);
  }

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

    this.api.post<AssessmentResult>('/neuroinclusion/assess', payload).subscribe({
      next: (result) => {
        this.restoreResult({
          ...result,
          dimensions: result.dimensions?.length ? result.dimensions : [...this.dimensions],
        });
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

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';
import { environment } from '../../../../environments/environment';

interface OAuthProviders {
  google: boolean;
  microsoft: boolean;
  passkey: boolean;
  googleClientId?: string;
  microsoftClientId?: string;
  microsoftTenantId?: string;
}

interface WorkflowStep { icon: string; label: string; desc: string; }
interface ModuleSlide {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  paragraphs: string[];
  workflow: WorkflowStep[];
  features: string[];
  stats: { value: string; label: string }[];
}

const MODULE_SLIDES: ModuleSlide[] = [
  {
    icon: 'warning_amber',
    title: 'Conflict Intelligence\u2122',
    subtitle: 'Predict. Prevent. Resolve.',
    color: '#e86c3a',
    paragraphs: [
      'Built on the Harvard Negotiation Project\u2019s interest-based negotiation framework \u2014 the methodology behind Getting to Yes (Fisher, Ury & Patton) and Difficult Conversations (Stone, Patton & Heen). Every layer of the module is designed to surface underlying interests, not just manage surface-level positions.',
      'The AI analysis maps anonymous survey data to the Three Conversations framework: the \u201cWhat Happened\u201d conversation (divergent narratives), the Feelings conversation (suppressed emotions driving escalation), and the Identity conversation (threats to self-image causing rigidity). This multi-layer diagnosis enables interventions that address the full depth of conflict.',
      'Manager conversation guides translate principled negotiation into practical scripts any manager can use \u2014 with interest-probing questions, emotion-acknowledging language, and collaborative resolution pathways. When bilateral resolution isn\u2019t enough, the structured escalation pathway activates William Ury\u2019s \u201cThird Side\u201d model for professional mediation.',
    ],
    workflow: [
      { icon: 'poll', label: 'Survey', desc: 'Anonymous pulse & deep-dive surveys detect early conflict signals across teams' },
      { icon: 'auto_awesome', label: 'AI Analysis', desc: 'Pattern recognition scores risk (0\u2013100) and identifies conflict types with root causes' },
      { icon: 'record_voice_over', label: 'Guide', desc: 'Manager conversation scripts and recommended actions across time horizons' },
      { icon: 'shield', label: 'Resolve', desc: 'Track actions to completion or escalate to professional mediation' },
    ],
    features: ['Bi-weekly pulse (15 items) & quarterly deep-dive (21 items)', 'AI risk scoring with low/medium/high/critical levels', 'Sub-analysis drill-down per conflict type', 'Interest-based manager conversation scripts', 'Prioritised action plans (immediate / short / long term)', 'Completion tracking with per-action checkboxes', 'Escalation-to-mediation pathway with status tracking', 'Preventive measures and systemic recommendations'],
    stats: [{ value: '36', label: 'Survey questions across 2 instruments' }, { value: '4', label: 'Risk levels with escalation protocols' }, { value: '3', label: 'Conversation layers detected by AI' }],
  },
  {
    icon: 'psychology_alt',
    title: 'Coaching & Development',
    subtitle: 'From Engagement to Transformation.',
    color: '#27C4A0',
    paragraphs: [
      'A complete coaching practice management platform built on the GROW Model (Goal, Reality, Options, Will) and aligned with ICF Core Competencies. Coaches manage the full engagement lifecycle \u2014 from discovery and chemistry matching through structured sessions to final assessment and alumni follow-up.',
      'Every session is enriched with AI-powered documentation, pre/post session intake forms, and EQ-i 2.0 psychometric integration (5 composites, 15 subscales). Coaches can generate AI-driven debrief narratives from assessment data, automatically populate session plans, and track coaching arcs across engagements.',
      'Sponsor organisations get transparent reporting on engagement progress, session completion rates, and development outcomes \u2014 with full contract management, invoicing, and rebillable session tracking built in. The coachee portal provides a dedicated space for session booking, between-session reflection, and progress visibility.',
    ],
    workflow: [
      { icon: 'handshake', label: 'Discovery', desc: 'Intake assessment, contracting, and baseline psychometric evaluation' },
      { icon: 'flag', label: 'Goal Setting', desc: 'GROW Model IDP creation with AI-generated development plans' },
      { icon: 'event_note', label: 'Sessions', desc: 'Pre/post forms, AI notes, ratings, and coaching arc tracking' },
      { icon: 'assessment', label: 'Outcomes', desc: 'Sponsor reporting, progress measurement, and alumni follow-up' },
    ],
    features: ['GROW Model session framework with AI documentation', 'EQ-i 2.0 psychometric integration (133 questions, 15 subscales)', 'Pre/post session intake forms linked to templates', 'Engagement lifecycle with status tracking', 'Sponsor contracts, invoicing & rebillable sessions', 'Coachee portal for booking and between-session work', 'Coach journal with AI-generated session summaries', 'Multi-engagement coaching arc visibility'],
    stats: [{ value: '15', label: 'EQ-i subscales tracked per coachee' }, { value: '4', label: 'GROW phases structured per session' }, { value: '\u221e', label: 'Engagements per coach' }],
  },
  {
    icon: 'psychology',
    title: 'Neuro-Inclusion',
    subtitle: 'Build a Truly Inclusive Workplace.',
    color: '#7c5cbf',
    paragraphs: [
      'Assess your organisation\u2019s neuroinclusion maturity across multiple dimensions with structured assessments designed for neurodivergent employees and the teams that support them. The module moves beyond awareness training to measurable, actionable inclusion strategies.',
      'AI-driven gap analysis benchmarks your scores against dimension-level targets, identifies the highest-impact areas for improvement, and generates targeted action plans. Progress is tracked over time, allowing organisations to demonstrate measurable inclusion gains to leadership, boards, and external stakeholders.',
      'The assessment covers physical environment, communication practices, management approaches, recruitment processes, career development pathways, and organisational culture \u2014 providing a holistic view of where neurodivergent employees experience friction and where the organisation excels.',
    ],
    workflow: [
      { icon: 'quiz', label: 'Assess', desc: 'Multi-dimension neuroinclusion maturity assessment' },
      { icon: 'insights', label: 'Analyse', desc: 'AI benchmarks scores and identifies highest-impact gaps' },
      { icon: 'lightbulb', label: 'Plan', desc: 'Targeted inclusion action plans per dimension' },
      { icon: 'show_chart', label: 'Track', desc: 'Measure progress over time with repeat assessments' },
    ],
    features: ['Multi-dimension maturity assessment', 'AI gap analysis with benchmarking', 'Dimension-level scoring and visualisation', 'Targeted inclusion action plans', 'Progress tracking across assessment cycles', 'Physical, cultural & process dimensions covered', 'Board-ready reporting on inclusion gains', 'Integration with coaching for manager development'],
    stats: [{ value: '6+', label: 'Inclusion dimensions assessed' }, { value: 'AI', label: 'Powered gap analysis' }, { value: '\u0394', label: 'Progress tracked over time' }],
  },
  {
    icon: 'trending_up',
    title: 'Leadership & Succession',
    subtitle: 'Develop Tomorrow\u2019s Leaders Today.',
    color: '#3A9FD6',
    paragraphs: [
      'Build a measurable leadership pipeline with AI-generated Individual Development Plans using the GROW coaching model. The module synthesises inputs from EQ-i 2.0 assessments, conflict analysis data, competency gap evaluations, and coach observations to create evidence-based development roadmaps.',
      'Each IDP includes structured goals, reality assessments, options for development, and concrete action commitments \u2014 with milestones that can be tracked to completion. The AI doesn\u2019t just generate a plan; it contextualises development priorities against the individual\u2019s assessment profile and organisational needs.',
      'The conflict-to-IDP pipeline is unique: when the Conflict Intelligence module identifies patterns that suggest a leadership development need, the system can generate a targeted IDP that addresses the root cause \u2014 turning conflict data into growth opportunities.',
    ],
    workflow: [
      { icon: 'psychology', label: 'Assess', desc: 'EQ-i 2.0, competency evaluations, and conflict data inputs' },
      { icon: 'auto_awesome', label: 'Generate', desc: 'AI creates GROW Model IDP with contextualised priorities' },
      { icon: 'task_alt', label: 'Execute', desc: 'Track milestone completion with notes and evidence' },
      { icon: 'refresh', label: 'Iterate', desc: 'Regenerate plans as new data emerges from coaching & assessments' },
    ],
    features: ['GROW Model AI-generated development plans', 'EQ-i 2.0 score integration (15 subscales)', 'Competency gap analysis and mapping', 'Milestone tracking with completion status', 'Conflict-to-IDP pipeline for root cause development', 'Multi-source input synthesis (assessments + coaching + surveys)', 'Plan regeneration as new data arrives', 'Coach and coachee collaborative goal-setting'],
    stats: [{ value: 'GROW', label: 'Model structures every plan' }, { value: '15', label: 'EQ-i subscales inform development' }, { value: 'AI', label: 'Generates contextualised IDPs' }],
  },
  {
    icon: 'calendar_month',
    title: 'Booking & Scheduling',
    subtitle: 'Effortless Scheduling, Zero Friction.',
    color: '#2080b0',
    paragraphs: [
      'Professional booking pages for every coach with real-time availability, timezone-aware slot generation, and configurable rules for buffer times, advance notice, and daily limits. Clients access a public, shareable link \u2014 no login required \u2014 and book in seconds.',
      'Google Calendar two-way sync means bookings automatically create calendar events with Google Meet links, and changes in either direction (reschedule, cancel, decline) propagate instantly via webhook. Date exclusions, country holidays, and special availability rules ensure coaches maintain full control over their schedule.',
      'Built natively into ARTES \u2014 no Calendly dependency, no redirect to third-party tools. All booking data is scoped by coach and tenant, with automated confirmation and reminder emails via AWS SES keeping both parties informed.',
    ],
    workflow: [
      { icon: 'settings', label: 'Configure', desc: 'Set weekly availability, event types, timezone, and buffer rules' },
      { icon: 'link', label: 'Share', desc: 'Public booking link \u2014 no login required for clients' },
      { icon: 'event_available', label: 'Book', desc: 'Client selects slot; calendar event + Meet link auto-created' },
      { icon: 'sync', label: 'Sync', desc: 'Two-way Google Calendar sync with webhook-driven updates' },
    ],
    features: ['Public shareable booking pages per coach', 'Google Calendar two-way sync with webhooks', 'Automated Google Meet link generation', 'Timezone-aware slot generation', 'Configurable buffer time and advance notice', 'Date exclusions and country holidays', 'Client self-service reschedule and cancel', 'Automated confirmation and reminder emails'],
    stats: [{ value: '2-way', label: 'Google Calendar sync' }, { value: '0', label: 'External dependencies' }, { value: '24/7', label: 'Self-service booking' }],
  },
  {
    icon: 'assignment',
    title: 'Intake Management',
    subtitle: 'One Engine, Every Assessment.',
    color: '#f0a500',
    paragraphs: [
      'A flexible intake engine powering every module in the platform. Design custom questionnaires with mixed question types (scale, boolean, text, multi-select), deploy them as anonymous self-service surveys, coach-led interviews, or structured assessments \u2014 all from a single template builder.',
      'Privacy-first aggregation ensures that individual responses are never exposed. A minimum group size of 5 respondents per analysis prevents statistical de-anonymisation, while public survey links allow distribution without requiring respondents to create accounts. Coach-led sessions capture richer contextual data with session format, target name, and coachee linkage.',
      'Cross-module analytics feed survey data into Conflict Intelligence (risk scoring), Neuro-Inclusion (maturity assessment), and Coaching (pre/post session forms) \u2014 making the intake engine the connective tissue of the entire platform.',
    ],
    workflow: [
      { icon: 'edit_note', label: 'Design', desc: 'Build templates with mixed question types and branching logic' },
      { icon: 'send', label: 'Deploy', desc: 'Anonymous links, coach-led sessions, or embedded assessments' },
      { icon: 'analytics', label: 'Aggregate', desc: 'Privacy-first response aggregation with minimum group sizes' },
      { icon: 'hub', label: 'Connect', desc: 'Feed data into Conflict, Neuro-Inclusion, and Coaching modules' },
    ],
    features: ['Custom template builder with mixed question types', 'Anonymous self-service surveys via public links', 'Coach-led interview and assessment modes', 'Privacy-first aggregation (min. 5 respondents)', 'Real-time response tracking and counts', 'Cross-module data pipeline (Conflict, Neuro, Coaching)', 'Submission token deduplication', 'Global and organisation-scoped templates'],
    stats: [{ value: '3', label: 'Intake modes (survey, interview, assessment)' }, { value: '5+', label: 'Minimum group for privacy' }, { value: '6', label: 'Modules powered by intake data' }],
  },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  template: `
    <div class="auth-page">
      <!-- Left: Info Panel (desktop only) -->
      <div class="info-panel">
        <div class="info-top">
          <img src="assets/artes_transparent_dark.png" alt="ARTES" class="info-logo" />
          <p class="info-tagline">People Intelligence Platform</p>
          <p class="info-sub">AI-powered insights for coaching, conflict resolution, neuroinclusion, and leadership development.</p>
        </div>

        <div class="module-carousel">
          @for (m of modules; track m.title; let i = $index) {
            <div class="module-slide" [class.active]="activeSlide() === i">
              <!-- Header with graphic -->
              <div class="slide-header">
                <div class="slide-graphic">
                  <svg viewBox="0 0 100 100" class="module-ring">
                    <circle cx="50" cy="50" r="42" fill="none" [attr.stroke]="m.color + '20'" stroke-width="3" />
                    <circle cx="50" cy="50" r="42" fill="none" [attr.stroke]="m.color" stroke-width="3"
                            stroke-dasharray="264" stroke-dashoffset="66" stroke-linecap="round"
                            class="ring-progress" />
                    <circle cx="50" cy="50" r="30" [attr.fill]="m.color + '12'" />
                  </svg>
                  <div class="slide-icon-overlay" [style.color]="m.color">
                    <mat-icon>{{ m.icon }}</mat-icon>
                  </div>
                </div>
                <div class="slide-title-block">
                  <h3 [style.color]="m.color">{{ m.title }}</h3>
                  <span class="slide-subtitle">{{ m.subtitle }}</span>
                </div>
              </div>

              <!-- Paragraphs -->
              <div class="slide-body">
                @for (p of m.paragraphs; track $index) {
                  <p>{{ p }}</p>
                }
              </div>

              <!-- Workflow -->
              <div class="slide-workflow">
                @for (s of m.workflow; track s.label; let j = $index) {
                  <div class="wf-step">
                    <div class="wf-icon" [style.background]="m.color + '18'" [style.color]="m.color">
                      <mat-icon>{{ s.icon }}</mat-icon>
                      <span class="wf-num">{{ j + 1 }}</span>
                    </div>
                    <div class="wf-text">
                      <strong>{{ s.label }}</strong>
                      <span>{{ s.desc }}</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Features grid -->
              <div class="slide-features">
                @for (f of m.features; track f) {
                  <span class="feature-chip">
                    <mat-icon>check_circle</mat-icon>
                    {{ f }}
                  </span>
                }
              </div>

              <!-- Stats bar -->
              <div class="slide-stats">
                @for (s of m.stats; track s.label) {
                  <div class="stat" [style.color]="m.color">
                    <span class="stat-val">{{ s.value }}</span>
                    <span class="stat-label">{{ s.label }}</span>
                  </div>
                }
              </div>
            </div>
          }
          <div class="carousel-dots">
            @for (m of modules; track m.title; let i = $index) {
              <button class="dot" [class.active]="activeSlide() === i"
                      [style.background]="activeSlide() === i ? modules[activeSlide()].color : ''"
                      (click)="goToSlide(i)"></button>
            }
          </div>
        </div>

        <div class="info-bottom">
          <div class="trust-bar">
            <span>Built by</span>
            <a href="https://www.headsoft.net" target="_blank">HeadSoft Tech</a>
            <span class="sep">&times;</span>
            <a href="https://www.helenacoaching.com" target="_blank">Helena Coaching</a>
          </div>
        </div>
      </div>

      <!-- Mobile: Compact brand bar -->
      <div class="mobile-brand">
        <img src="assets/artes_light.png" alt="ARTES" class="mobile-logo" />
        <p class="mobile-tagline">People Intelligence Platform</p>
      </div>

      <!-- Right: Login Card -->
      <div class="auth-card">
        @if (!twoFactorStep()) {
          <!-- Step 1: email + password -->
          <div class="auth-brand">
            <img src="assets/artes_light.png" alt="ARTES" class="card-logo" />
          </div>
          <div class="card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your account</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            @if (error()) {
              <div class="error-banner">{{ error() }}</div>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email address</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-icon matPrefix>email</mat-icon>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <mat-error>Valid email required</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'"
                     formControlName="password" autocomplete="current-password" />
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <mat-error>Password required</mat-error>
              }
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit"
                      class="full-width submit-btn" [disabled]="loading()">
                @if (loading()) { <mat-spinner diameter="20" /> } @else { Sign In }
              </button>
            </div>

            <div class="auth-links">
              <a routerLink="/auth/forgot-password">Forgot password?</a>
            </div>

            <!-- Passkey + OAuth divider -->
            @if (providers()?.google || providers()?.microsoft || providers()?.passkey) {
              <div class="divider-row">
                <mat-divider />
                <span class="divider-text">or continue with</span>
                <mat-divider />
              </div>

              <div class="alt-auth-buttons">
                @if (providers()?.passkey) {
                  <button type="button" class="alt-auth-btn passkey-btn" (click)="loginWithPasskey()"
                          [disabled]="loading()">
                    <mat-icon>fingerprint</mat-icon>
                    <span>Passkey</span>
                  </button>
                }
                @if (providers()?.google) {
                  <button type="button" class="alt-auth-btn google-btn" (click)="loginWithGoogle()"
                          [disabled]="loading()">
                    <svg class="oauth-icon" viewBox="0 0 24 24" width="18" height="18">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Google</span>
                  </button>
                }
                @if (providers()?.microsoft) {
                  <button type="button" class="alt-auth-btn microsoft-btn" (click)="loginWithMicrosoft()"
                          [disabled]="loading()">
                    <svg class="oauth-icon" viewBox="0 0 21 21" width="18" height="18">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    <span>Microsoft</span>
                  </button>
                }
              </div>
            }
          </form>

          <div class="auth-brand-footer mobile-only">
            <p><a href="https://www.headsoft.net" target="_blank"><img class="icon-logo" src="assets/headsoft-logo-black.jpeg"/>HeadSoft Tech</a> | <a href="https://www.helenacoaching.com" target="_blank"><img class="icon-logo" src="assets/Helena-H-Icon_transparent-1024-px.png"/>Helena Coaching</a></p>
          </div>

        } @else {
          <!-- Step 2: TOTP code -->
          <form [formGroup]="otpForm" (ngSubmit)="onVerify2fa()" novalidate>
            <div class="twofa-header">
              <div class="twofa-icon"><mat-icon>phonelink_lock</mat-icon></div>
              <h2>Two-factor authentication</h2>
              <p>Enter the 6-digit code from your Google Authenticator app.</p>
            </div>

            @if (error()) {
              <div class="error-banner">{{ error() }}</div>
            }

            <mat-form-field appearance="outline" class="full-width otp-field">
              <mat-label>Authenticator code</mat-label>
              <input matInput formControlName="otp" inputmode="numeric"
                     maxlength="6" autocomplete="one-time-code"
                     placeholder="000 000" />
              <mat-icon matPrefix>pin</mat-icon>
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit"
                      class="full-width submit-btn" [disabled]="loading()">
                @if (loading()) { <mat-spinner diameter="20" /> } @else { Verify }
              </button>
            </div>

            <div class="back-link">
              <button mat-button type="button" (click)="resetToLogin()">
                <mat-icon>arrow_back</mat-icon> Back to login
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    /* ── Split-screen layout ─────────────────────────────────────── */
    .auth-page {
      min-height: 100vh; display: flex;
      background: #f0f4f8;
    }

    /* ── Left info panel ─────────────────────────────────────────── */
    .info-panel {
      flex: 0 0 55%; display: flex; flex-direction: column;
      background: linear-gradient(160deg, #1B2A47 0%, #223554 40%, #2a4270 100%);
      padding: 40px 48px; color: white; position: relative; overflow-y: auto; overflow-x: hidden;
    }
    .info-panel::after {
      content: ''; position: absolute; top: -30%; right: -20%;
      width: 500px; height: 500px; border-radius: 50%;
      background: radial-gradient(circle, rgba(58,159,214,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .info-panel::before {
      content: ''; position: absolute; bottom: -20%; left: -10%;
      width: 400px; height: 400px; border-radius: 50%;
      background: radial-gradient(circle, rgba(39,196,160,0.08) 0%, transparent 70%);
      pointer-events: none;
    }

    .info-top { position: relative; z-index: 1; margin-bottom: 28px; }
    .info-logo { height: 100px; width: auto; margin-bottom: 20px; }
    .info-tagline {
      font-size: 28px; font-weight: 700; line-height: 1.3; margin: 0 0 12px;
      background: linear-gradient(135deg, #ffffff 0%, #a8d4f0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .info-sub { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0; max-width: 480px; }

    /* Module carousel */
    .module-carousel { flex: 1; position: relative; z-index: 1; display: flex; flex-direction: column; }

    .module-slide {
      display: none; flex-direction: column; gap: 0;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 24px; backdrop-filter: blur(8px);
      animation: slideIn 0.5s ease;
      &.active { display: flex; }
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .slide-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .slide-graphic { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
    .module-ring { width: 64px; height: 64px; }
    .ring-progress { animation: ringDraw 1.2s ease-out; }
    @keyframes ringDraw { from { stroke-dashoffset: 264; } }
    .slide-icon-overlay {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }
    .slide-title-block {
      h3 { font-size: 19px; font-weight: 700; margin: 0 0 2px; }
      .slide-subtitle { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; }
    }

    .slide-body {
      margin-bottom: 16px;
      p { font-size: 12.5px; color: rgba(255,255,255,0.68); line-height: 1.65; margin: 0 0 8px; &:last-child { margin-bottom: 0; } }
    }

    .slide-workflow {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;
    }
    .wf-step { display: flex; gap: 10px; align-items: flex-start; }
    .wf-icon {
      position: relative; width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      .wf-num {
        position: absolute; top: -4px; right: -4px; width: 14px; height: 14px;
        border-radius: 50%; background: rgba(255,255,255,0.15); font-size: 8px; font-weight: 700;
        display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.8);
      }
    }
    .wf-text {
      strong { display: block; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 1px; }
      span { font-size: 10.5px; color: rgba(255,255,255,0.55); line-height: 1.4; }
    }

    .slide-features { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 14px; }
    .feature-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 999px;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.08);
      mat-icon { font-size: 11px; width: 11px; height: 11px; opacity: 0.6; }
    }

    .slide-stats {
      display: flex; gap: 24px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);
    }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-val { font-size: 20px; font-weight: 800; }
    .stat-label { font-size: 9px; color: rgba(255,255,255,0.5); text-align: center; max-width: 100px; }

    .carousel-dots {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px;
    }
      &:hover:not(.active) { background: rgba(255,255,255,0.4); }
    }

    .info-bottom { position: relative; z-index: 1; margin-top: 24px; }
    .trust-bar {
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.45);
      a { color: rgba(255,255,255,0.7); text-decoration: none; &:hover { color: white; } }
      .sep { color: rgba(255,255,255,0.25); }
    }

    /* ── Mobile brand bar ────────────────────────────────────────── */
    .mobile-brand { display: none; }

    /* ── Right login card ────────────────────────────────────────── */
    .auth-card {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 48px 56px; max-width: 520px; margin: 0 auto;
    }

    .auth-brand {
      text-align: center; margin-bottom: 24px;
      .card-logo { height: 100px; width: auto; }
    }

    .card-header {
      text-align: center; margin-bottom: 28px;
      h2 { font-size: 24px; color: #1B2A47; margin: 0 0 6px; font-weight: 700; }
      p { font-size: 14px; color: #5a6a7e; margin: 0; }
    }

    .full-width { width: 100%; }
    .submit-btn { height: 48px; font-size: 16px; font-weight: 600; margin-top: 8px; }

    .auth-links {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px; font-size: 14px;
      a { color: #3A9FD6; }
      span { color: #9aa5b4; }
    }

    .divider-row {
      display: flex; align-items: center; gap: 12px; margin: 24px 0 16px;
      mat-divider { flex: 1; }
      .divider-text { font-size: 12px; color: #9aa5b4; white-space: nowrap; }
    }

    .alt-auth-buttons { display: flex; gap: 10px; }

    .alt-auth-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px 16px; border-radius: 10px; border: 1.5px solid #e8edf4;
      background: white; cursor: pointer; font-size: 13px; font-weight: 600;
      color: #374151; transition: all 0.15s;
      &:hover { background: #f8fafc; border-color: #c5d0db; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .passkey-btn {
      mat-icon { color: #7c5cbf; }
      &:hover { border-color: #7c5cbf; background: #f8f5ff; }
    }
    .google-btn:hover { border-color: #4285F4; background: #f0f7ff; }
    .microsoft-btn:hover { border-color: #00a4ef; background: #f0faff; }
    .oauth-icon { flex-shrink: 0; }

    /* 2FA */
    .twofa-header {
      text-align: center; margin-bottom: 24px;
      .twofa-icon {
        width: 56px; height: 56px; border-radius: 14px; margin: 0 auto 16px;
        background: rgba(58,159,214,0.1); display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #3A9FD6; }
      }
      h2 { margin-bottom: 8px; font-size: 20px; color: #1B2A47; font-weight: 600; }
      p  { font-size: 14px; color: #5a6a7e; margin: 0; }
    }
    .otp-field input { font-size: 24px; letter-spacing: 8px; text-align: center; }
    .back-link { display: flex; justify-content: center; margin-top: 8px; }

    .auth-brand-footer {
      text-align: center; margin-top: 24px;
      p { font-size: 12px; color: #9aa5b4; margin: 0; }
    }
    .icon-logo { width: 16px; height: 16px; margin: -3px 2px; }
    .mobile-only { display: none; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
      padding: 10px 14px; color: #b91c1c; font-size: 13px; margin-bottom: 16px;
    }

    /* ── Responsive: tablet ──────────────────────────────────────── */
    @media (max-width: 1024px) {
      .info-panel { flex: 0 0 45%; padding: 36px 32px; }
      .info-tagline { font-size: 22px; }
      .module-slide { padding: 20px; }
      .auth-card { padding: 36px 32px; }
    }

    /* ── Responsive: mobile ──────────────────────────────────────── */
    @media (max-width: 768px) {
      .auth-page { flex-direction: column; background: linear-gradient(160deg, #1B2A47 0%, #223554 30%, #f0f4f8 30%); }
      .info-panel { display: none; }
      .mobile-brand {
        display: flex; flex-direction: column; align-items: center;
        padding: 32px 24px 20px; text-align: center;
      }
      .mobile-logo { height: 40px; width: auto; margin-bottom: 8px; }
      .mobile-tagline { font-size: 14px; color: rgba(255,255,255,0.8); margin: 0; font-weight: 500; }
      .auth-card {
        background: white; border-radius: 20px 20px 0 0; padding: 32px 24px;
        flex: 1; max-width: 100%; box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
      }
      .card-header { margin-bottom: 20px; h2 { font-size: 20px; } }
      .mobile-only { display: block; }
    }
  `],
})
export class LoginComponent implements OnInit, OnDestroy {
  form: FormGroup;
  otpForm: FormGroup;
  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);
  twoFactorStep = signal(false);
  providers    = signal<OAuthProviders | null>(null);
  activeSlide  = signal(0);
  modules      = MODULE_SLIDES;
  private tempToken = '';
  private carouselTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private api: ApiService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });
  }

  ngOnInit(): void {
    this.api.get<OAuthProviders>('/auth/oauth/providers').subscribe({
      next: (p) => this.providers.set(p),
      error: () => {},
    });
    this.startCarousel();
  }

  ngOnDestroy(): void {
    this.stopCarousel();
  }

  goToSlide(index: number): void {
    this.activeSlide.set(index);
    this.restartCarousel();
  }

  private startCarousel(): void {
    this.carouselTimer = setInterval(() => {
      this.activeSlide.update(i => (i + 1) % this.modules.length);
    }, 10000);
  }

  private stopCarousel(): void {
    if (this.carouselTimer) { clearInterval(this.carouselTimer); this.carouselTimer = null; }
  }

  private restartCarousel(): void {
    this.stopCarousel();
    this.startCarousel();
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.authService.login(email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.requiresTwoFactor) {
          this.tempToken = res.tempToken!;
          this.twoFactorStep.set(true);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Login failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onVerify2fa(): void {
    if (this.otpForm.invalid) { this.otpForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.authService.verify2fa(this.tempToken, this.otpForm.value.otp).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Verification failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  resetToLogin(): void {
    this.twoFactorStep.set(false);
    this.tempToken = '';
    this.otpForm.reset();
    this.error.set('');
  }

  // ── Passkey login ──────────────────────────────────────────────
  async loginWithPasskey(): Promise<void> {
    const email = this.form.get('email')?.value;
    if (!email) {
      this.error.set('Enter your email address first, then click Passkey.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const res = await fetch(`${environment.apiUrl}/auth/passkey/login-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        this.error.set(err.error || 'No passkey found for this account.');
        this.loading.set(false);
        return;
      }
      const { options, userId } = await res.json();

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          rpId: options.rpId,
          allowCredentials: (options.allowCredentials || []).map((c: any) => ({
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)),
            type: c.type || 'public-key',
            transports: c.transports,
          })),
          userVerification: options.userVerification || 'preferred',
          timeout: options.timeout || 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) throw new Error('No credential returned');

      const response = credential.response as AuthenticatorAssertionResponse;
      const toBase64Url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const credentialJSON = {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: toBase64Url(response.authenticatorData),
          clientDataJSON: toBase64Url(response.clientDataJSON),
          signature: toBase64Url(response.signature),
          userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined,
        },
        clientExtensionResults: credential.getClientExtensionResults(),
      };

      const verifyRes = await fetch(`${environment.apiUrl}/auth/passkey/login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credential: credentialJSON }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        this.error.set(err.error || 'Passkey verification failed.');
        this.loading.set(false);
        return;
      }
      const authRes = await verifyRes.json();
      this.authService.handleOAuthResponse(authRes);
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set(e?.message === 'The operation either timed out or was not allowed.'
        ? 'Passkey authentication was cancelled.'
        : 'Passkey authentication failed. Please try again.');
      this.loading.set(false);
    }
  }

  // ── OAuth redirects ────────────────────────────────────────────
  loginWithGoogle(): void {
    const p = this.providers();
    if (!p?.googleClientId) return;
    const redirectUri = `${window.location.origin}/auth/oauth/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${p.googleClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&state=google` +
      `&prompt=select_account`;
    window.location.href = url;
  }

  loginWithMicrosoft(): void {
    const p = this.providers();
    if (!p?.microsoftClientId) return;
    const tenant = p.microsoftTenantId || 'common';
    const redirectUri = `${window.location.origin}/auth/oauth/callback`;
    const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
      `client_id=${p.microsoftClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent('openid email profile User.Read')}` +
      `&state=microsoft` +
      `&prompt=select_account`;
    window.location.href = url;
  }
}

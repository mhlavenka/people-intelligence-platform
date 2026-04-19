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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth.service';
import { ApiService } from '../../../core/api.service';
import { RecaptchaService } from '../../../core/recaptcha.service';
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
  heroImage?: string;
  paragraphs: string[];
  workflow: WorkflowStep[];
  features: string[];
  stats: { value: string; label: string }[];
}

const MODULE_SLIDES: ModuleSlide[] = [
  {
    icon: 'warning_amber',
    title: 'AUTH.slides.conflict.title',
    subtitle: 'AUTH.slides.conflict.subtitle',
    color: '#e86c3a',
    heroImage: 'assets/module_conflict.png',
    paragraphs: [
      'AUTH.slides.conflict.p1',
      'AUTH.slides.conflict.p2',
      'AUTH.slides.conflict.p3',
    ],
    workflow: [
      { icon: 'poll', label: 'AUTH.slides.conflict.wf1Label', desc: 'AUTH.slides.conflict.wf1Desc' },
      { icon: 'auto_awesome', label: 'AUTH.slides.conflict.wf2Label', desc: 'AUTH.slides.conflict.wf2Desc' },
      { icon: 'record_voice_over', label: 'AUTH.slides.conflict.wf3Label', desc: 'AUTH.slides.conflict.wf3Desc' },
      { icon: 'shield', label: 'AUTH.slides.conflict.wf4Label', desc: 'AUTH.slides.conflict.wf4Desc' },
    ],
    features: ['AUTH.slides.conflict.f1', 'AUTH.slides.conflict.f2', 'AUTH.slides.conflict.f3', 'AUTH.slides.conflict.f4', 'AUTH.slides.conflict.f5', 'AUTH.slides.conflict.f6', 'AUTH.slides.conflict.f7', 'AUTH.slides.conflict.f8'],
    stats: [{ value: '36', label: 'AUTH.slides.conflict.s1' }, { value: '4', label: 'AUTH.slides.conflict.s2' }, { value: '3', label: 'AUTH.slides.conflict.s3' }],
  },
  {
    icon: 'psychology_alt',
    title: 'AUTH.slides.coaching.title',
    subtitle: 'AUTH.slides.coaching.subtitle',
    color: '#27C4A0',
    heroImage: 'assets/module_coaching.png',
    paragraphs: [
      'AUTH.slides.coaching.p1',
      'AUTH.slides.coaching.p2',
      'AUTH.slides.coaching.p3',
    ],
    workflow: [
      { icon: 'handshake', label: 'AUTH.slides.coaching.wf1Label', desc: 'AUTH.slides.coaching.wf1Desc' },
      { icon: 'flag', label: 'AUTH.slides.coaching.wf2Label', desc: 'AUTH.slides.coaching.wf2Desc' },
      { icon: 'event_note', label: 'AUTH.slides.coaching.wf3Label', desc: 'AUTH.slides.coaching.wf3Desc' },
      { icon: 'assessment', label: 'AUTH.slides.coaching.wf4Label', desc: 'AUTH.slides.coaching.wf4Desc' },
    ],
    features: ['AUTH.slides.coaching.f1', 'AUTH.slides.coaching.f2', 'AUTH.slides.coaching.f3', 'AUTH.slides.coaching.f4', 'AUTH.slides.coaching.f5', 'AUTH.slides.coaching.f6', 'AUTH.slides.coaching.f7', 'AUTH.slides.coaching.f8'],
    stats: [{ value: '15', label: 'AUTH.slides.coaching.s1' }, { value: '4', label: 'AUTH.slides.coaching.s2' }, { value: '\u221e', label: 'AUTH.slides.coaching.s3' }],
  },
  {
    icon: 'psychology',
    title: 'AUTH.slides.neuro.title',
    subtitle: 'AUTH.slides.neuro.subtitle',
    color: '#7c5cbf',
    heroImage: 'assets/module_neuro.png',
    paragraphs: [
      'AUTH.slides.neuro.p1',
      'AUTH.slides.neuro.p2',
      'AUTH.slides.neuro.p3',
    ],
    workflow: [
      { icon: 'quiz', label: 'AUTH.slides.neuro.wf1Label', desc: 'AUTH.slides.neuro.wf1Desc' },
      { icon: 'insights', label: 'AUTH.slides.neuro.wf2Label', desc: 'AUTH.slides.neuro.wf2Desc' },
      { icon: 'lightbulb', label: 'AUTH.slides.neuro.wf3Label', desc: 'AUTH.slides.neuro.wf3Desc' },
      { icon: 'show_chart', label: 'AUTH.slides.neuro.wf4Label', desc: 'AUTH.slides.neuro.wf4Desc' },
    ],
    features: ['AUTH.slides.neuro.f1', 'AUTH.slides.neuro.f2', 'AUTH.slides.neuro.f3', 'AUTH.slides.neuro.f4', 'AUTH.slides.neuro.f5', 'AUTH.slides.neuro.f6', 'AUTH.slides.neuro.f7', 'AUTH.slides.neuro.f8'],
    stats: [{ value: '6+', label: 'AUTH.slides.neuro.s1' }, { value: 'AI', label: 'AUTH.slides.neuro.s2' }, { value: '\u0394', label: 'AUTH.slides.neuro.s3' }],
  },
  {
    icon: 'trending_up',
    title: 'AUTH.slides.leadership.title',
    subtitle: 'AUTH.slides.leadership.subtitle',
    color: '#3A9FD6',
    heroImage: 'assets/module_leadership.png',
    paragraphs: [
      'AUTH.slides.leadership.p1',
      'AUTH.slides.leadership.p2',
      'AUTH.slides.leadership.p3',
    ],
    workflow: [
      { icon: 'psychology', label: 'AUTH.slides.leadership.wf1Label', desc: 'AUTH.slides.leadership.wf1Desc' },
      { icon: 'auto_awesome', label: 'AUTH.slides.leadership.wf2Label', desc: 'AUTH.slides.leadership.wf2Desc' },
      { icon: 'task_alt', label: 'AUTH.slides.leadership.wf3Label', desc: 'AUTH.slides.leadership.wf3Desc' },
      { icon: 'refresh', label: 'AUTH.slides.leadership.wf4Label', desc: 'AUTH.slides.leadership.wf4Desc' },
    ],
    features: ['AUTH.slides.leadership.f1', 'AUTH.slides.leadership.f2', 'AUTH.slides.leadership.f3', 'AUTH.slides.leadership.f4', 'AUTH.slides.leadership.f5', 'AUTH.slides.leadership.f6', 'AUTH.slides.leadership.f7', 'AUTH.slides.leadership.f8'],
    stats: [{ value: 'GROW', label: 'AUTH.slides.leadership.s1' }, { value: '15', label: 'AUTH.slides.leadership.s2' }, { value: 'AI', label: 'AUTH.slides.leadership.s3' }],
  },
  {
    icon: 'calendar_month',
    title: 'AUTH.slides.booking.title',
    subtitle: 'AUTH.slides.booking.subtitle',
    color: '#2080b0',
    heroImage: 'assets/module_booking.png',
    paragraphs: [
      'AUTH.slides.booking.p1',
      'AUTH.slides.booking.p2',
      'AUTH.slides.booking.p3',
    ],
    workflow: [
      { icon: 'settings', label: 'AUTH.slides.booking.wf1Label', desc: 'AUTH.slides.booking.wf1Desc' },
      { icon: 'link', label: 'AUTH.slides.booking.wf2Label', desc: 'AUTH.slides.booking.wf2Desc' },
      { icon: 'event_available', label: 'AUTH.slides.booking.wf3Label', desc: 'AUTH.slides.booking.wf3Desc' },
      { icon: 'sync', label: 'AUTH.slides.booking.wf4Label', desc: 'AUTH.slides.booking.wf4Desc' },
    ],
    features: ['AUTH.slides.booking.f1', 'AUTH.slides.booking.f2', 'AUTH.slides.booking.f3', 'AUTH.slides.booking.f4', 'AUTH.slides.booking.f5', 'AUTH.slides.booking.f6', 'AUTH.slides.booking.f7', 'AUTH.slides.booking.f8'],
    stats: [{ value: '2-way', label: 'AUTH.slides.booking.s1' }, { value: '0', label: 'AUTH.slides.booking.s2' }, { value: '24/7', label: 'AUTH.slides.booking.s3' }],
  },
  {
    icon: 'assignment',
    title: 'AUTH.slides.intake.title',
    subtitle: 'AUTH.slides.intake.subtitle',
    color: '#f0a500',
    heroImage: 'assets/module_intake.png',
    paragraphs: [
      'AUTH.slides.intake.p1',
      'AUTH.slides.intake.p2',
      'AUTH.slides.intake.p3',
    ],
    workflow: [
      { icon: 'edit_note', label: 'AUTH.slides.intake.wf1Label', desc: 'AUTH.slides.intake.wf1Desc' },
      { icon: 'send', label: 'AUTH.slides.intake.wf2Label', desc: 'AUTH.slides.intake.wf2Desc' },
      { icon: 'analytics', label: 'AUTH.slides.intake.wf3Label', desc: 'AUTH.slides.intake.wf3Desc' },
      { icon: 'hub', label: 'AUTH.slides.intake.wf4Label', desc: 'AUTH.slides.intake.wf4Desc' },
    ],
    features: ['AUTH.slides.intake.f1', 'AUTH.slides.intake.f2', 'AUTH.slides.intake.f3', 'AUTH.slides.intake.f4', 'AUTH.slides.intake.f5', 'AUTH.slides.intake.f6', 'AUTH.slides.intake.f7', 'AUTH.slides.intake.f8'],
    stats: [{ value: '3', label: 'AUTH.slides.intake.s1' }, { value: '5+', label: 'AUTH.slides.intake.s2' }, { value: '6', label: 'AUTH.slides.intake.s3' }],
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
    TranslateModule,
  ],
  template: `
    <div class="auth-page">
      <!-- Left: Info Panel (desktop only) -->
      <div class="info-panel">
        <div class="info-top">
          <img src="assets/artes_transparent_dark.png" alt="ARTES" class="info-logo" />
          <p class="info-tagline">{{ 'AUTH.tagline' | translate }}</p>
          <p class="info-sub">{{ 'AUTH.taglineSub' | translate }}</p>
        </div>

        <div class="module-carousel" (mouseenter)="hoverPause(true)" (mouseleave)="hoverPause(false)">
          @for (m of modules; track m.title; let i = $index) {
            <div class="module-slide" [class.active]="activeSlide() === i" [class.prev]="prevSlide() === i && prevSlide() !== activeSlide()">
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
                  <h3 [style.color]="m.color">{{ m.title | translate }}</h3>
                  <span class="slide-subtitle">{{ m.subtitle | translate }}</span>
                </div>
              </div>

              <!-- Hero image -->
              @if (m.heroImage) {
                <div class="slide-hero">
                  <img [src]="m.heroImage" [alt]="m.title" />
                </div>
              }

              <!-- Paragraphs -->
              <div class="slide-body">
                @for (p of m.paragraphs; track $index) {
                  <p>{{ p | translate }}</p>
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
                      <strong>{{ s.label | translate }}</strong>
                      <span>{{ s.desc | translate }}</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Features grid -->
              <div class="slide-features">
                @for (f of m.features; track f) {
                  <span class="feature-chip">
                    <mat-icon>check_circle</mat-icon>
                    {{ f | translate }}
                  </span>
                }
              </div>

              <!-- Stats bar -->
              <div class="slide-stats">
                @for (s of m.stats; track s.label) {
                  <div class="stat" [style.color]="m.color">
                    <span class="stat-val">{{ s.value }}</span>
                    <span class="stat-label">{{ s.label | translate }}</span>
                  </div>
                }
              </div>
            </div>
          }
          <div class="carousel-controls">
            <div class="carousel-dots">
              @for (m of modules; track m.title; let i = $index) {
                <button class="dot" [class.active]="activeSlide() === i"
                        [style.background]="activeSlide() === i ? modules[activeSlide()].color : ''"
                        (click)="goToSlide(i)"></button>
              }
            </div>
            <button class="pause-btn" (click)="togglePause()" [title]="paused() ? 'Play' : 'Pause'">
              <mat-icon>{{ paused() ? 'play_arrow' : 'pause' }}</mat-icon>
            </button>
          </div>
        </div>

        <div class="info-bottom">
          <div class="bottom-row">
            <div class="trust-bar">
              <span>{{ 'NAV.builtBy' | translate }}</span>
              <a href="https://www.headsoft.net" target="_blank">HeadSoft Tech</a>
              <span class="sep">&times;</span>
              <a href="https://www.helenacoaching.com" target="_blank">Helena Coaching</a>
            </div>
            <div class="legal-bar">
              <a routerLink="/termsofservice">{{ 'NAV.terms' | translate }}</a>
              <a routerLink="/privacystatement">{{ 'NAV.privacy' | translate }}</a>
              <a routerLink="/eula">{{ 'NAV.eula' | translate }}</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile: Compact brand bar -->
      <div class="mobile-brand">
        <img src="assets/artes_light.png" alt="ARTES" class="mobile-logo" />
        <p class="mobile-tagline">{{ 'AUTH.tagline' | translate }}</p>
      </div>

      <!-- Right: Login Card -->
      <div class="auth-card">
        <div class="lang-switcher">
          <button class="lang-btn" [class.active]="translate.currentLang === 'en'" (click)="switchLang('en')" title="English"><svg width="20" height="14" viewBox="0 0 20 14"><rect width="20" height="14" fill="#012169"/><path d="M0,0L20,14M20,0L0,14" stroke="#fff" stroke-width="2.4"/><path d="M0,0L20,14M20,0L0,14" stroke="#C8102E" stroke-width="1.2"/><path d="M10,0V14M0,7H20" stroke="#fff" stroke-width="4"/><path d="M10,0V14M0,7H20" stroke="#C8102E" stroke-width="2.4"/></svg></button>
          <button class="lang-btn" [class.active]="translate.currentLang === 'fr'" (click)="switchLang('fr')" title="Français"><svg width="20" height="14" viewBox="0 0 20 14"><rect width="6.67" height="14" fill="#002395"/><rect x="6.67" width="6.67" height="14" fill="#fff"/><rect x="13.33" width="6.67" height="14" fill="#ED2939"/></svg></button>
          <button class="lang-btn" [class.active]="translate.currentLang === 'es'" (click)="switchLang('es')" title="Español"><svg width="20" height="14" viewBox="0 0 20 14"><rect width="20" height="14" fill="#AA151B"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/></svg></button>
        </div>
        @if (!twoFactorStep()) {
          <!-- Step 1: email + password -->
          <div class="auth-brand">
            <img src="assets/artes_light.png" alt="ARTES" class="card-logo" />
          </div>
          <div class="card-header">
            <h2>{{ 'AUTH.welcomeBack' | translate }}</h2>
            <p>{{ 'AUTH.signInToAccount' | translate }}</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            @if (error()) {
              <div class="error-banner">{{ error() }}</div>
            }

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'AUTH.emailAddress' | translate }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" />
              <mat-icon matPrefix>email</mat-icon>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <mat-error>{{ 'AUTH.validEmailRequired' | translate }}</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'AUTH.password' | translate }}</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'"
                     formControlName="password" autocomplete="current-password" />
              <mat-icon matPrefix>lock</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <mat-error>{{ 'AUTH.passwordRequired' | translate }}</mat-error>
              }
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit"
                      class="full-width submit-btn" [disabled]="loading()">
                @if (loading()) { <mat-spinner diameter="20" /> } @else { {{ 'AUTH.signIn' | translate }} }
              </button>
            </div>

            <div class="auth-links">
              <a routerLink="/auth/forgot-password">{{ 'AUTH.forgotPassword' | translate }}</a>
            </div>

            <!-- Passkey + OAuth divider -->
            @if (providers()?.google || providers()?.microsoft || providers()?.passkey) {
              <div class="divider-row">
                <mat-divider />
                <span class="divider-text">{{ 'AUTH.orContinueWith' | translate }}</span>
                <mat-divider />
              </div>

              <div class="alt-auth-buttons">
                @if (providers()?.passkey) {
                  <button type="button" class="alt-auth-btn passkey-btn" (click)="loginWithPasskey()"
                          [disabled]="loading()">
                    <mat-icon>fingerprint</mat-icon>
                    <span>{{ 'AUTH.passkey' | translate }}</span>
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
                    <span>{{ 'AUTH.google' | translate }}</span>
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
                    <span>{{ 'AUTH.microsoft' | translate }}</span>
                  </button>
                }
              </div>
            }
          </form>

          <div class="auth-brand-footer mobile-only">
            <p><a href="https://www.headsoft.net" target="_blank"><img class="icon-logo" src="assets/headsoft-logo-black.jpeg"/>HeadSoft Tech</a> | <a href="https://www.helenacoaching.com" target="_blank"><img class="icon-logo" src="assets/Helena-H-Icon_transparent-1024-px.png"/>Helena Coaching</a></p>
            <div class="legal-bar">
              <a routerLink="/termsofservice">{{ 'NAV.terms' | translate }}</a>
              <a routerLink="/privacystatement">{{ 'NAV.privacy' | translate }}</a>
              <a routerLink="/eula">{{ 'NAV.eula' | translate }}</a>
            </div>
          </div>

        } @else {
          <!-- Step 2: TOTP code -->
          <form [formGroup]="otpForm" (ngSubmit)="onVerify2fa()" novalidate>
            <div class="twofa-header">
              <div class="twofa-icon"><mat-icon>phonelink_lock</mat-icon></div>
              <h2>{{ 'AUTH.twoFactorAuth' | translate }}</h2>
              <p>{{ 'AUTH.twoFactorPrompt' | translate }}</p>
            </div>

            @if (error()) {
              <div class="error-banner">{{ error() }}</div>
            }

            <mat-form-field appearance="outline" class="full-width otp-field">
              <mat-label>{{ 'AUTH.authenticatorCode' | translate }}</mat-label>
              <input matInput formControlName="otp" inputmode="numeric"
                     maxlength="6" autocomplete="one-time-code"
                     placeholder="000 000" />
              <mat-icon matPrefix>pin</mat-icon>
            </mat-form-field>

            <div class="form-actions">
              <button mat-raised-button color="primary" type="submit"
                      class="full-width submit-btn" [disabled]="loading()">
                @if (loading()) { <mat-spinner diameter="20" /> } @else { {{ 'AUTH.verify' | translate }} }
              </button>
            </div>

            <div class="back-link">
              <button mat-button type="button" (click)="resetToLogin()">
                <mat-icon>arrow_back</mat-icon> {{ 'AUTH.backToLogin' | translate }}
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
      background: linear-gradient(160deg, var(--artes-primary) 0%, #223554 40%, #2a4270 100%);
      padding: 40px 48px; color: white; position: relative; overflow: hidden;
      height: 100vh;
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

    .info-top { position: relative; z-index: 1; margin-bottom: 28px; flex-shrink: 0; }
    .info-logo { height: 100px; width: auto; margin-bottom: 20px; }
    .info-tagline {
      font-size: 28px; font-weight: 700; line-height: 1.3; margin: 0 0 12px;
      background: linear-gradient(135deg, #ffffff 0%, #a8d4f0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .info-sub { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0; max-width: 480px; }

    /* Module carousel */
    .module-carousel { flex: 3; position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

    .module-slide {
      display: flex; flex-direction: column; gap: 0;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 24px; backdrop-filter: blur(8px);
      position: absolute; inset: 0;
      opacity: 0; transform: translateX(40px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      &.active {
        position: relative;
        opacity: 1; transform: translateX(0) scale(1);
        pointer-events: auto;
      }
      &.prev {
        opacity: 0; transform: translateX(-40px) scale(0.97);
      }
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
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

    .slide-hero {
      margin-bottom: 16px; border-radius: 10px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
      img { width: 100%; height: auto; display: block; }
    }

    .slide-body {
      margin-bottom: 46px;
      p { font-size: 12.5px; color: rgba(255,255,255,0.68); line-height: 1.65; margin: 0 0 8px; &:last-child { margin-bottom: 0; } }
    }

    .slide-workflow {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 46px;
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

    .slide-features { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 46px; }
    .feature-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 999px;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.08);
      mat-icon { font-size: 11px; width: 11px; height: 11px; opacity: 0.6; }
    }

    .slide-stats {
      display: flex; gap: 24px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); justify-content: center;
    }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-val { font-size: 20px; font-weight: 800; }
    .stat-label { font-size: 9px; color: rgba(255,255,255,0.5); text-align: center; max-width: 100px; }

    .carousel-controls {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      margin-top: 16px; flex-shrink: 0;
    }
    .carousel-dots {
      display: flex; gap: 8px; align-items: center;
    }
    .pause-btn {
      background: none; border: none; cursor: pointer; padding: 2px;
      color: rgba(255,255,255,0.35); transition: color 0.2s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { color: rgba(255,255,255,0.8); }
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,0.25); transition: all 0.2s;
      &.active { width: 28px; border-radius: 5px; }
      &:hover:not(.active) { background: rgba(255,255,255,0.4); }
    }

    .info-bottom { position: relative; z-index: 1; margin-top: 24px; flex-shrink: 0; }
    .bottom-row {
      display: flex; align-items: center; justify-content: space-between;
    }
    .trust-bar {
      display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.45);
      a { color: rgba(255,255,255,0.7); text-decoration: none; &:hover { color: white; } }
      .sep { color: rgba(255,255,255,0.25); }
    }
    .info-bottom .legal-bar {
      display: flex; gap: 12px;
      a { font-size: 12px; color: rgba(255,255,255,0.35); text-decoration: none; &:hover { color: rgba(255,255,255,0.7); } }
    }
    .auth-brand-footer .legal-bar {
      display: flex; gap: 12px; justify-content: center; margin-top: 8px;
      a { font-size: 11px; color: #9aa5b4; text-decoration: none; &:hover { color: var(--artes-accent); } }
    }

    /* ── Mobile brand bar ────────────────────────────────────────── */
    .mobile-brand { display: none; }

    /* ── Right login card ────────────────────────────────────────── */
    .auth-card {
      flex: 1; display: flex; flex-direction: column; justify-content: center;
      padding: 48px 56px; max-width: 520px; margin: 0 auto;
      position: relative;
    }
    .lang-switcher {
      position: absolute; top: 16px; right: 16px;
      display: flex; gap: 4px;
    }
    .lang-btn {
      background: none; border: 1px solid #d4dfe9; border-radius: 4px;
      padding: 4px 6px; cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center;
      opacity: 0.6;
      &:hover { border-color: var(--artes-accent); opacity: 1; }
      &.active { border-color: var(--artes-primary); opacity: 1; box-shadow: 0 0 0 1px var(--artes-primary); }
    }

    .auth-brand {
      text-align: center; margin-bottom: 24px;
      .card-logo { height: 100px; width: auto; }
    }

    .card-header {
      text-align: center; margin-bottom: 28px;
      h2 { font-size: 24px; color: var(--artes-primary); margin: 0 0 6px; font-weight: 700; }
      p { font-size: 14px; color: #5a6a7e; margin: 0; }
    }

    .full-width { width: 100%; }
    .submit-btn { height: 48px; font-size: 16px; font-weight: 600; margin-top: 8px; }

    .auth-links {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px; font-size: 14px;
      a { color: var(--artes-accent); }
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
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--artes-accent); }
      }
      h2 { margin-bottom: 8px; font-size: 20px; color: var(--artes-primary); font-weight: 600; }
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
      .auth-page { flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(160deg, var(--artes-primary) 0%, #223554 100%); }
      .info-panel { display: none; }
      .mobile-brand { display: none; }
      .auth-card {
        background: white; border-radius: 16px; padding: 32px 24px;
        flex: none; max-width: 400px; width: calc(100% - 32px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.25);
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
  prevSlide    = signal(-1);
  paused       = signal(false);
  modules      = MODULE_SLIDES;
  private tempToken = '';
  private carouselTimer: ReturnType<typeof setInterval> | null = null;
  private hovering = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private api: ApiService,
    private router: Router,
    public translate: TranslateService,
    private recaptcha: RecaptchaService,
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
    this.prevSlide.set(this.activeSlide());
    this.activeSlide.set(index);
    if (!this.paused()) this.restartCarousel();
  }

  togglePause(): void {
    if (this.paused()) {
      this.paused.set(false);
      this.startCarousel();
    } else {
      this.paused.set(true);
      this.stopCarousel();
    }
  }

  hoverPause(entering: boolean): void {
    this.hovering = entering;
    if (this.paused()) return;
    if (entering) {
      this.stopCarousel();
    } else {
      this.startCarousel();
    }
  }

  private startCarousel(): void {
    if (this.carouselTimer) return;
    this.carouselTimer = setInterval(() => {
      if (this.hovering) return;
      this.prevSlide.set(this.activeSlide());
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

  switchLang(lang: string): void {
    this.translate.use(lang);
    localStorage.setItem('artes_language', lang);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.recaptcha.execute('login').subscribe({
      next: (token) => {
        this.authService.login(email, password, token).subscribe({
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
            this.error.set(err.error?.error || this.translate.instant('AUTH.loginFailed'));
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set(this.translate.instant('AUTH.loginFailed'));
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
        this.error.set(err.error?.error || this.translate.instant('AUTH.verificationFailed'));
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
      this.error.set(this.translate.instant('AUTH.enterEmailFirst'));
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
        this.error.set(err.error || this.translate.instant('AUTH.noPasskeyFound'));
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
        this.error.set(err.error || this.translate.instant('AUTH.passkeyVerificationFailed'));
        this.loading.set(false);
        return;
      }
      const authRes = await verifyRes.json();
      this.authService.handleOAuthResponse(authRes);
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set(e?.message === 'The operation either timed out or was not allowed.'
        ? this.translate.instant('AUTH.passkeyCancelled')
        : this.translate.instant('AUTH.passkeyAuthFailed'));
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

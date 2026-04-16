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

interface ModuleSlide {
  icon: string;
  title: string;
  description: string;
  color: string;
  features: string[];
}

const MODULE_SLIDES: ModuleSlide[] = [
  {
    icon: 'warning_amber',
    title: 'Conflict Intelligence\u2122',
    description: 'Predict and prevent workplace conflict before it escalates. AI-powered analysis grounded in the Harvard Negotiation Project\u2019s interest-based framework.',
    color: '#e86c3a',
    features: ['Anonymous pulse surveys', 'AI risk scoring & analysis', 'Manager conversation guides', 'Escalation-to-mediation pathway'],
  },
  {
    icon: 'psychology_alt',
    title: 'Coaching & Development',
    description: 'End-to-end coaching management with session tracking, progress monitoring, and AI-generated development plans using the GROW model.',
    color: '#27C4A0',
    features: ['Engagement & session management', 'Pre/post session forms', 'Google Calendar sync', 'Sponsor billing & invoicing'],
  },
  {
    icon: 'psychology',
    title: 'Neuro-Inclusion',
    description: 'Assess and improve your organisation\u2019s neuroinclusion maturity. AI identifies gaps and provides actionable recommendations.',
    color: '#7c5cbf',
    features: ['Maturity assessments', 'AI gap analysis', 'Benchmarking by dimension', 'Inclusion action plans'],
  },
  {
    icon: 'trending_up',
    title: 'Leadership & Succession',
    description: 'Build future-ready leaders with AI-generated Individual Development Plans, competency mapping, and succession planning.',
    color: '#3A9FD6',
    features: ['GROW model IDPs', 'EQ-i integration', 'Competency gap analysis', 'Milestone tracking'],
  },
  {
    icon: 'assignment',
    title: 'Survey Intelligence',
    description: 'Flexible intake engine supporting anonymous surveys, coach-led interviews, and structured assessments across all modules.',
    color: '#f0a500',
    features: ['Custom template builder', 'Anonymous & coached modes', 'Response aggregation', 'Cross-module analytics'],
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
          <img src="assets/artes_light.png" alt="ARTES" class="info-logo" />
          <p class="info-tagline">People Intelligence Platform</p>
          <p class="info-sub">AI-powered insights for coaching, conflict resolution, neuroinclusion, and leadership development.</p>
        </div>

        <div class="module-carousel">
          @for (m of modules; track m.title; let i = $index) {
            <div class="module-slide" [class.active]="activeSlide() === i">
              <div class="slide-icon" [style.background]="m.color + '20'" [style.color]="m.color">
                <mat-icon>{{ m.icon }}</mat-icon>
              </div>
              <div class="slide-content">
                <h3 [style.color]="m.color">{{ m.title }}</h3>
                <p>{{ m.description }}</p>
                <div class="slide-features">
                  @for (f of m.features; track f) {
                    <span class="feature-chip">{{ f }}</span>
                  }
                </div>
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
      padding: 48px 56px; color: white; position: relative; overflow: hidden;
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

    .info-top { position: relative; z-index: 1; margin-bottom: 40px; }
    .info-logo { height: 48px; width: auto; margin-bottom: 20px; }
    .info-tagline {
      font-size: 28px; font-weight: 700; line-height: 1.3; margin: 0 0 12px;
      background: linear-gradient(135deg, #ffffff 0%, #a8d4f0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .info-sub { font-size: 15px; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0; max-width: 480px; }

    /* ── Module carousel ─────────────────────────────────────────── */
    .module-carousel { flex: 1; position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: center; }

    .module-slide {
      display: none; gap: 20px; align-items: flex-start;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px; padding: 28px; backdrop-filter: blur(8px);
      animation: slideIn 0.4s ease;
      &.active { display: flex; }
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .slide-icon {
      width: 52px; height: 52px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }

    .slide-content {
      flex: 1; min-width: 0;
      h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
      p { font-size: 14px; color: rgba(255,255,255,0.75); line-height: 1.6; margin: 0 0 14px; }
    }

    .slide-features { display: flex; flex-wrap: wrap; gap: 6px; }
    .feature-chip {
      font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
      background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);
      border: 1px solid rgba(255,255,255,0.12);
    }

    .carousel-dots {
      display: flex; gap: 8px; justify-content: center; margin-top: 24px;
    }
    .dot {
      width: 10px; height: 10px; border-radius: 50%; border: none; cursor: pointer;
      background: rgba(255,255,255,0.25); transition: all 0.2s;
      &.active { width: 28px; border-radius: 5px; }
      &:hover:not(.active) { background: rgba(255,255,255,0.4); }
    }

    .info-bottom { position: relative; z-index: 1; margin-top: 40px; }
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

    .card-header {
      margin-bottom: 28px;
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
    }, 6000);
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

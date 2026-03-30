import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth.service';

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
  ],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-logo">
            <img src="assets/headsoft-logo.png" alt="HeadSoft" class="logo-img" />
          </div>
          <h1>People Intelligence Platform</h1>
          <p>HeadSoft Tech × Helena Coaching</p>
        </div>

        @if (!twoFactorStep()) {
          <!-- Step 1: email + password -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
            <h2>Sign in to your workspace</h2>

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
              <span>·</span>
              <a routerLink="/auth/register">Create organization</a>
            </div>
          </form>

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
    .auth-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1B2A47 0%, #2a3f6b 50%, #3A9FD6 100%);
      padding: 24px;
    }

    .auth-card {
      background: white; border-radius: 16px; padding: 48px;
      width: 100%; max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }

    .auth-brand {
      text-align: center; margin-bottom: 32px;
      .brand-logo {
        width: 64px; height: 64px; border-radius: 16px; margin: 0 auto 16px;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        .logo-img { width: 56px; height: 56px; object-fit: contain; }
      }
      h1 { font-size: 18px; font-weight: 700; color: #1B2A47; margin: 0 0 4px; }
      p  { font-size: 12px; color: #9aa5b4; margin: 0; }
    }

    h2 { font-size: 20px; color: #1B2A47; margin-bottom: 24px; font-weight: 600; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px;
    }

    .full-width { width: 100%; }

    .submit-btn { height: 48px; font-size: 16px; font-weight: 600; margin-top: 8px; }

    .auth-links {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px; font-size: 14px;
      a { color: #3A9FD6; }
      span { color: #9aa5b4; }
    }

    .twofa-header {
      text-align: center; margin-bottom: 24px;
      .twofa-icon {
        width: 56px; height: 56px; border-radius: 14px; margin: 0 auto 16px;
        background: rgba(58,159,214,0.1); display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #3A9FD6; }
      }
      h2 { margin-bottom: 8px; }
      p  { font-size: 14px; color: #5a6a7e; margin: 0; }
    }

    .otp-field input { font-size: 24px; letter-spacing: 8px; text-align: center; }

    .back-link { display: flex; justify-content: center; margin-top: 8px; }
  `],
})
export class LoginComponent {
  form: FormGroup;
  otpForm: FormGroup;
  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);
  twoFactorStep = signal(false);
  private tempToken = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
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
}

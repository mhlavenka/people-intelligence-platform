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
            <span class="logo-pip">PIP</span>
          </div>
          <h1>People Intelligence Platform</h1>
          <p>HeadSoft Tech × Helena Coaching</p>
        </div>

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
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <mat-error>Password required</mat-error>
            }
          </mat-form-field>

          <div class="form-actions">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width submit-btn"
              [disabled]="loading()"
            >
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                Sign In
              }
            </button>
          </div>

          <div class="auth-links">
            <a routerLink="/auth/forgot-password">Forgot password?</a>
            <span>·</span>
            <a routerLink="/auth/register">Create organization</a>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1B2A47 0%, #2a3f6b 50%, #3A9FD6 100%);
      padding: 24px;
    }

    .auth-card {
      background: white;
      border-radius: 16px;
      padding: 48px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }

    .auth-brand {
      text-align: center;
      margin-bottom: 32px;

      .brand-logo {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #1B2A47, #3A9FD6);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;

        .logo-pip {
          color: white;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 1px;
        }
      }

      h1 {
        font-size: 18px;
        font-weight: 700;
        color: #1B2A47;
        margin: 0 0 4px;
      }

      p {
        font-size: 12px;
        color: #9aa5b4;
        margin: 0;
      }
    }

    h2 {
      font-size: 20px;
      color: #1B2A47;
      margin-bottom: 24px;
      font-weight: 600;
    }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
    }

    .full-width { width: 100%; }

    .submit-btn {
      height: 48px;
      font-size: 16px;
      font-weight: 600;
      background-color: #1B2A47 !important;
      margin-top: 8px;
    }

    .auth-links {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 20px;
      font-size: 14px;

      a { color: #3A9FD6; }
      span { color: #9aa5b4; }
    }
  `],
})
export class LoginComponent {
  form: FormGroup;
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.authService.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Login failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}

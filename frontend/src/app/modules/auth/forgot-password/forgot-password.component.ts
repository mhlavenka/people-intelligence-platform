import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../core/api.service';
import { RecaptchaService } from '../../../core/recaptcha.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, TranslateModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h2>{{ 'AUTH.resetPassword' | translate }}</h2>
        <p class="subtitle">{{ 'AUTH.resetPasswordDesc' | translate }}</p>

        @if (sent()) {
          <div class="success-banner">{{ 'AUTH.checkEmailForReset' | translate }}</div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>{{ 'AUTH.emailAddress' | translate }}</mat-label>
              <input matInput type="email" formControlName="email" />
            </mat-form-field>
            <button mat-raised-button color="primary" type="submit" class="full-width" [disabled]="loading()">
              @if (loading()) { <mat-spinner diameter="18" /> } @else { {{ 'AUTH.sendResetLink' | translate }} }
            </button>
          </form>
        }

        <div class="auth-links"><a routerLink="/auth/login">{{ 'AUTH.backToLogin' | translate }}</a></div>
        <div class="recaptcha-notice" [innerHTML]="'AUTH.recaptchaNotice' | translate"></div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--artes-primary), var(--artes-accent)); padding: 24px; }
    .auth-card { background: white; border-radius: 16px; padding: 40px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
    h2 { color: var(--artes-primary); margin-bottom: 8px; }
    .subtitle { color: #9aa5b4; margin-bottom: 24px; font-size: 14px; }
    .success-banner { background: #f0fdf4; border: 1px solid #86efac; color: #16a34a; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .full-width { width: 100%; }
    .auth-links { text-align: center; margin-top: 16px; a { color: var(--artes-accent); font-size: 14px; } }
    .recaptcha-notice {
      text-align: center; font-size: 11px; color: #9aa5b4; margin-top: 12px;
      ::ng-deep a { color: #9aa5b4; text-decoration: underline; }
    }
  `],
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = signal(false);
  sent = signal(false);

  constructor(private fb: FormBuilder, private api: ApiService, private recaptcha: RecaptchaService) {
    this.form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.recaptcha.execute('forgot_password').subscribe({
      next: (token) => {
        this.api.post('/auth/forgot-password', { ...this.form.value, recaptchaToken: token }).subscribe({
          next: () => { this.sent.set(true); this.loading.set(false); },
          error: () => { this.sent.set(true); this.loading.set(false); },
        });
      },
      error: () => { this.sent.set(true); this.loading.set(false); },
    });
  }
}

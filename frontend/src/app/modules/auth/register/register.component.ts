import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth.service';
import { RecaptchaService } from '../../../core/recaptcha.service';

@Component({
  selector: 'app-register',
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
    MatStepperModule,
    TranslateModule,
  ],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-logo"><span class="logo-pip">ARTES</span></div>
          <h1>{{ 'AUTH.createOrganization' | translate }}</h1>
          <p>ARTES</p>
        </div>

        @if (error()) {
          <div class="error-banner">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <mat-stepper orientation="vertical" [linear]="true" #stepper>
            <mat-step [label]="'AUTH.organizationStep' | translate" [stepControl]="orgGroup">
              <div formGroupName="org" class="step-fields">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'AUTH.organizationName' | translate }}</mat-label>
                  <input matInput formControlName="orgName" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'AUTH.slug' | translate }}</mat-label>
                  <input matInput formControlName="orgSlug" />
                  <mat-hint>{{ 'AUTH.slugHint' | translate }}</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'AUTH.billingEmail' | translate }}</mat-label>
                  <input matInput type="email" formControlName="billingEmail" />
                </mat-form-field>
                <button mat-raised-button color="primary" matStepperNext type="button">{{ 'COMMON.next' | translate }}</button>
              </div>
            </mat-step>

            <mat-step [label]="'AUTH.adminAccountStep' | translate" [stepControl]="adminGroup">
              <div formGroupName="admin" class="step-fields">
                <div class="name-row">
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'AUTH.firstName' | translate }}</mat-label>
                    <input matInput formControlName="firstName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'AUTH.lastName' | translate }}</mat-label>
                    <input matInput formControlName="lastName" />
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'AUTH.workEmail' | translate }}</mat-label>
                  <input matInput type="email" formControlName="email" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ 'AUTH.password' | translate }}</mat-label>
                  <input matInput type="password" formControlName="password" />
                  <mat-hint>{{ 'AUTH.minChars' | translate }}</mat-hint>
                </mat-form-field>
                <div class="step-actions">
                  <button mat-button matStepperPrevious type="button">{{ 'COMMON.back' | translate }}</button>
                  <button
                    mat-raised-button
                    color="primary"
                    type="submit"
                    [disabled]="loading()"
                  >
                    @if (loading()) { <mat-spinner diameter="18" /> }
                    @else { {{ 'AUTH.createOrganization' | translate }} }
                  </button>
                </div>
              </div>
            </mat-step>
          </mat-stepper>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/login">{{ 'AUTH.hasAccount' | translate }} {{ 'AUTH.signIn' | translate }}</a>
        </div>
        <div class="recaptcha-notice" [innerHTML]="'AUTH.recaptchaNotice' | translate"></div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--artes-primary), var(--artes-accent));
      padding: 24px;
    }
    .auth-card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .auth-brand {
      text-align: center;
      margin-bottom: 24px;
      .brand-logo {
        width: 350px; height: 120px;
        background: linear-gradient(135deg, var(--artes-primary), var(--artes-accent));
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        .logo-pip { color: white; font-size: 18px; font-weight: 700; }
      }
      h1 { font-size: 20px; color: var(--artes-primary); margin: 0 0 4px; }
      p  { font-size: 12px; color: #9aa5b4; margin: 0; }
    }
    .auth-brand-footer {
      text-align: center;
      margin-top: 24px;
      h1 { font-size: 20px; color: var(--artes-primary); margin: 0 0 4px; }
      p  { font-size: 12px; color: #9aa5b4; margin: 0; }
    }
    
    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px;
    }
    .full-width { width: 100%; }
    .step-fields { padding-top: 12px; display: flex; flex-direction: column; gap: 4px; }
    .name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .step-actions { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
    .auth-links { text-align: center; margin-top: 16px; font-size: 14px; a { color: var(--artes-accent); } }
    .recaptcha-notice {
      text-align: center; font-size: 11px; color: #9aa5b4; margin-top: 12px;
      ::ng-deep a { color: #9aa5b4; text-decoration: underline; }
    }
  `],
})
export class RegisterComponent {
  form: FormGroup;
  loading = signal(false);
  error = signal('');

  get orgGroup() { return this.form.get('org') as FormGroup; }
  get adminGroup() { return this.form.get('admin') as FormGroup; }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private recaptcha: RecaptchaService,
  ) {
    this.form = this.fb.group({
      org: this.fb.group({
        orgName: ['', Validators.required],
        orgSlug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
        billingEmail: ['', [Validators.required, Validators.email]],
      }),
      admin: this.fb.group({
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
      }),
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { org, admin } = this.form.value;
    this.recaptcha.execute('register').subscribe({
      next: (token) => {
        this.authService.register({ ...org, ...admin, recaptchaToken: token }).subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: (err) => {
            this.error.set(err.error?.error || 'Registration failed');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Registration failed');
        this.loading.set(false);
      },
    });
  }
}

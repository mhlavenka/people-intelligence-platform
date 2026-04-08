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
import { AuthService } from '../../../core/auth.service';

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
  ],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-logo"><span class="logo-pip">ARTES</span></div>
          <h1>Create Your Organization</h1>
          <p>ARTES</p>
        </div>

        @if (error()) {
          <div class="error-banner">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <mat-stepper orientation="vertical" [linear]="true" #stepper>
            <mat-step label="Organization" [stepControl]="orgGroup">
              <div formGroupName="org" class="step-fields">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Organization Name</mat-label>
                  <input matInput formControlName="orgName" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Slug (unique URL identifier)</mat-label>
                  <input matInput formControlName="orgSlug" />
                  <mat-hint>Lowercase letters, numbers, hyphens only</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Billing Email</mat-label>
                  <input matInput type="email" formControlName="billingEmail" />
                </mat-form-field>
                <button mat-raised-button color="primary" matStepperNext type="button">Next</button>
              </div>
            </mat-step>

            <mat-step label="Admin Account" [stepControl]="adminGroup">
              <div formGroupName="admin" class="step-fields">
                <div class="name-row">
                  <mat-form-field appearance="outline">
                    <mat-label>First Name</mat-label>
                    <input matInput formControlName="firstName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Last Name</mat-label>
                    <input matInput formControlName="lastName" />
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Work Email</mat-label>
                  <input matInput type="email" formControlName="email" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" formControlName="password" />
                  <mat-hint>Minimum 8 characters</mat-hint>
                </mat-form-field>
                <div class="step-actions">
                  <button mat-button matStepperPrevious type="button">Back</button>
                  <button
                    mat-raised-button
                    color="primary"
                    type="submit"
                    [disabled]="loading()"
                  >
                    @if (loading()) { <mat-spinner diameter="18" /> }
                    @else { Create Organization }
                  </button>
                </div>
              </div>
            </mat-step>
          </mat-stepper>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/login">Already have an account? Sign in</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1B2A47, #3A9FD6);
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
        background: linear-gradient(135deg, #1B2A47, #3A9FD6);
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        .logo-pip { color: white; font-size: 18px; font-weight: 700; }
      }
      h1 { font-size: 20px; color: #1B2A47; margin: 0 0 4px; }
      p  { font-size: 12px; color: #9aa5b4; margin: 0; }
    }
    .auth-brand-footer {
      text-align: center;
      margin-top: 24px;
      h1 { font-size: 20px; color: #1B2A47; margin: 0 0 4px; }
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
    .auth-links { text-align: center; margin-top: 16px; font-size: 14px; a { color: #3A9FD6; } }
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
    private router: Router
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
    this.authService.register({ ...org, ...admin }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.error || 'Registration failed.');
        this.loading.set(false);
      },
    });
  }
}

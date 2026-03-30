import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', hr_manager: 'HR Manager',
  manager: 'Manager', coach: 'Coach', coachee: 'Employee',
};

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd  = control.get('newPassword')?.value;
  const confirm = control.get('confirmPassword')?.value;
  return newPwd && confirm && newPwd !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="profile-page">
      <div class="page-header">
        <h1>My Profile</h1>
        <p>Manage your personal information and account security</p>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (profile()) {
        <div class="profile-layout">

          <!-- Avatar + account info sidebar -->
          <div class="sidebar-card">
            <div class="avatar-block">
              <div class="avatar-circle">{{ initials() }}</div>
              <div class="avatar-name">{{ profile()!.firstName }} {{ profile()!.lastName }}</div>
              <div class="avatar-email">{{ profile()!.email }}</div>
              <span class="role-badge">{{ roleLabel() }}</span>
            </div>

            <mat-divider />

            <div class="account-meta">
              <div class="meta-item">
                <mat-icon>calendar_today</mat-icon>
                <div>
                  <div class="meta-label">Member since</div>
                  <div class="meta-value">{{ profile()!.createdAt | date:'MMM d, y' }}</div>
                </div>
              </div>
              <div class="meta-item">
                <mat-icon>login</mat-icon>
                <div>
                  <div class="meta-label">Last login</div>
                  <div class="meta-value">
                    {{ profile()!.lastLoginAt ? (profile()!.lastLoginAt | date:'MMM d, y, h:mm a') : 'N/A' }}
                  </div>
                </div>
              </div>
              <div class="meta-item">
                <mat-icon>{{ profile()!.isActive ? 'check_circle' : 'cancel' }}</mat-icon>
                <div>
                  <div class="meta-label">Account status</div>
                  <div class="meta-value" [class.active-text]="profile()!.isActive">
                    {{ profile()!.isActive ? 'Active' : 'Inactive' }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main forms -->
          <div class="forms-col">

            <!-- Personal information -->
            <div class="card">
              <div class="card-header">
                <mat-icon>person</mat-icon>
                <h2>Personal Information</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                <form [formGroup]="profileForm" class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>First Name</mat-label>
                    <input matInput formControlName="firstName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Last Name</mat-label>
                    <input matInput formControlName="lastName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Email address</mat-label>
                    <input matInput [value]="profile()!.email" readonly />
                    <mat-hint>Email cannot be changed. Contact your administrator.</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>Role</mat-label>
                    <input matInput [value]="roleLabel()" readonly />
                    <mat-hint>Role is assigned by your administrator.</mat-hint>
                  </mat-form-field>
                </form>
                <div class="form-actions">
                  <button mat-raised-button color="primary"
                          (click)="saveProfile()"
                          [disabled]="profileForm.invalid || savingProfile()">
                    @if (savingProfile()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>save</mat-icon> Save Changes }
                  </button>
                </div>
              </div>
            </div>

            <!-- Change password -->
            <div class="card">
              <div class="card-header">
                <mat-icon>lock</mat-icon>
                <h2>Change Password</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                @if (pwdError()) {
                  <div class="error-banner">{{ pwdError() }}</div>
                }
                <form [formGroup]="passwordForm" class="form-col">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Current Password</mat-label>
                    <input matInput formControlName="currentPassword"
                           [type]="showCurrent ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showCurrent = !showCurrent">
                      <mat-icon>{{ showCurrent ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>New Password</mat-label>
                    <input matInput formControlName="newPassword"
                           [type]="showNew ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showNew = !showNew">
                      <mat-icon>{{ showNew ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-hint>Minimum 8 characters</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Confirm New Password</mat-label>
                    <input matInput formControlName="confirmPassword"
                           [type]="showConfirm ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showConfirm = !showConfirm">
                      <mat-icon>{{ showConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    @if (passwordForm.hasError('mismatch') && passwordForm.get('confirmPassword')?.touched) {
                      <mat-error>Passwords do not match</mat-error>
                    }
                  </mat-form-field>
                </form>
                <div class="form-actions">
                  <button mat-raised-button color="primary"
                          (click)="changePassword()"
                          [disabled]="passwordForm.invalid || savingPassword()">
                    @if (savingPassword()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>lock_reset</mat-icon> Update Password }
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .profile-page { padding: 32px; max-width: 1000px; }

    .page-header {
      margin-bottom: 28px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .profile-layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 20px;
      align-items: start;
    }

    /* Sidebar card */
    .sidebar-card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      overflow: hidden; position: sticky; top: 24px;
    }

    .avatar-block {
      display: flex; flex-direction: column; align-items: center;
      padding: 28px 20px; gap: 8px; text-align: center;
    }

    .avatar-circle {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 700; color: white; margin-bottom: 4px;
    }

    .avatar-name  { font-size: 16px; font-weight: 600; color: #1B2A47; }
    .avatar-email { font-size: 12px; color: #9aa5b4; }

    .role-badge {
      margin-top: 4px; padding: 3px 12px; border-radius: 999px;
      background: rgba(58,159,214,0.12); color: #2080b0;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
    }

    .account-meta {
      padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;
    }

    .meta-item {
      display: flex; align-items: flex-start; gap: 12px;
      mat-icon { font-size: 18px; color: #9aa5b4; margin-top: 2px; flex-shrink: 0; }
      .meta-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.4px; }
      .meta-value { font-size: 13px; color: #374151; margin-top: 1px; }
      .active-text { color: #27C4A0; font-weight: 500; }
    }

    /* Main forms */
    .forms-col { display: flex; flex-direction: column; gap: 20px; }

    .card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .card-header {
      display: flex; align-items: center; gap: 10px; padding: 20px 24px;
      mat-icon { color: #3A9FD6; }
      h2 { font-size: 16px; color: #1B2A47; margin: 0; font-weight: 600; }
    }

    .card-body { padding: 20px 24px; }

    .form-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-bottom: 16px;
      .span-2 { grid-column: span 2; }
    }

    .form-col { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }

    .full-width { width: 100%; }

    .form-actions { display: flex; justify-content: flex-end; }

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;
    }
  `],
})
export class ProfileComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);
  private fb   = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  profile  = signal<UserProfile | null>(null);
  loading  = signal(true);
  savingProfile  = signal(false);
  savingPassword = signal(false);
  pwdError = signal('');

  showCurrent = false;
  showNew     = false;
  showConfirm = false;

  profileForm!: FormGroup;
  passwordForm!: FormGroup;

  initials  = computed(() => {
    const p = this.profile();
    return p ? `${p.firstName[0]}${p.lastName[0]}`.toUpperCase() : '?';
  });
  roleLabel = computed(() => ROLE_LABELS[this.profile()?.role ?? ''] ?? this.profile()?.role ?? '');

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      currentPassword:  ['', Validators.required],
      newPassword:      ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword:  ['', Validators.required],
    }, { validators: passwordMatchValidator });

    this.api.get<UserProfile>('/users/me').subscribe({
      next: (p) => {
        this.profile.set(p);
        this.profileForm = this.fb.group({
          firstName: [p.firstName, Validators.required],
          lastName:  [p.lastName,  Validators.required],
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) { this.profileForm.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    this.api.put<UserProfile>('/users/me', this.profileForm.value).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        // Keep the auth signal in sync so the sidebar name updates
        const cur = this.auth.currentUser();
        if (cur) {
          this.auth.currentUser.set({ ...cur, ...this.profileForm.value });
        }
        this.savingProfile.set(false);
        this.snackBar.open('Profile updated', 'Close', { duration: 2500 });
      },
      error: () => { this.savingProfile.set(false); this.snackBar.open('Save failed', 'Close', { duration: 2500 }); },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) { this.passwordForm.markAllAsTouched(); return; }
    this.savingPassword.set(true);
    this.pwdError.set('');
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.api.put<{ message: string }>('/users/me/password', { currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.snackBar.open('Password updated successfully', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.pwdError.set(err.error?.error || 'Password update failed.');
        this.savingPassword.set(false);
      },
    });
  }
}

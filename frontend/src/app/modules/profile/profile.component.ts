import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PasskeyLabelDialogComponent } from './passkey-label-dialog.component';
import { LoginSessionsDialogComponent } from './login-sessions-dialog.component';
import { environment } from '../../../environments/environment';

interface PasskeyInfo {
  credentialId: string;
  label: string;
  deviceType: string;
  createdAt: string;
}

interface OAuthAccountInfo {
  provider: string;
  providerId: string;
  email: string;
  linkedAt: string;
}

interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  profilePicture?: string;
  lastLoginAt?: string;
  createdAt: string;
  passkeys?: PasskeyInfo[];
  oauthAccounts?: OAuthAccountInfo[];
  twoFactorEnabled?: boolean;
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
    MatTooltipModule,
    DatePipe,
    TranslateModule,
  ],
  template: `
    <div class="profile-page">
      <div class="page-header">
        <h1>{{ 'PROFILE.title' | translate }}</h1>
        <p>{{ 'PROFILE.subtitle' | translate }}</p>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (profile()) {
        <div class="profile-layout">

          <!-- Avatar + account info sidebar -->
          <div class="sidebar-card">
            <div class="avatar-block">
              <div class="avatar-wrapper" (click)="avatarInput.click()">
                @if (avatarUrl()) {
                  <img class="avatar-circle avatar-img" [src]="avatarUrl()" alt="Profile" />
                } @else {
                  <div class="avatar-circle">{{ initials() }}</div>
                }
                <div class="avatar-overlay"><mat-icon>photo_camera</mat-icon></div>
                <input #avatarInput type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="uploadAvatar($event)" />
              </div>
              <div class="avatar-name">{{ profile()!.firstName }} {{ profile()!.lastName }}</div>
              <div class="avatar-email">{{ profile()!.email }}</div>
              <span class="role-badge">{{ roleLabel() }}</span>
            </div>

            <mat-divider />

            <div class="account-meta">
              <div class="meta-item">
                <mat-icon>calendar_today</mat-icon>
                <div>
                  <div class="meta-label">{{ 'PROFILE.memberSince' | translate }}</div>
                  <div class="meta-value">{{ profile()!.createdAt | date:'MMM d, y' }}</div>
                </div>
              </div>
              <div class="meta-item">
                <mat-icon>login</mat-icon>
                <div>
                  <div class="meta-label">{{ 'PROFILE.lastLogin' | translate }}</div>
                  <div class="meta-value">
                    {{ profile()!.lastLoginAt ? (profile()!.lastLoginAt | date:'MMM d, y, h:mm a') : 'N/A' }}
                  </div>
                </div>
              </div>
              <div class="meta-item">
                <mat-icon>{{ profile()!.isActive ? 'check_circle' : 'cancel' }}</mat-icon>
                <div>
                  <div class="meta-label">{{ 'PROFILE.accountStatus' | translate }}</div>
                  <div class="meta-value" [class.active-text]="profile()!.isActive">
                    {{ profile()!.isActive ? ('PROFILE.active' | translate) : ('PROFILE.inactive' | translate) }}
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
                <h2>{{ 'PROFILE.personalInfo' | translate }}</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                <form [formGroup]="profileForm" class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'PROFILE.firstName' | translate }}</mat-label>
                    <input matInput formControlName="firstName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'PROFILE.lastName' | translate }}</mat-label>
                    <input matInput formControlName="lastName" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>{{ 'PROFILE.emailAddress' | translate }}</mat-label>
                    <input matInput [value]="profile()!.email" readonly />
                    <mat-hint>{{ 'PROFILE.emailReadonly' | translate }}</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-2">
                    <mat-label>{{ 'PROFILE.role' | translate }}</mat-label>
                    <input matInput [value]="roleLabel()" readonly />
                    <mat-hint>{{ 'PROFILE.roleReadonly' | translate }}</mat-hint>
                  </mat-form-field>
                </form>
                <div class="form-actions">
                  <button mat-raised-button color="primary"
                          (click)="saveProfile()"
                          [disabled]="profileForm.invalid || savingProfile()">
                    @if (savingProfile()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>save</mat-icon> {{ 'PROFILE.saveChanges' | translate }} }
                  </button>
                </div>
              </div>
            </div>

            <!-- Change password -->
            <div class="card">
              <div class="card-header">
                <mat-icon>lock</mat-icon>
                <h2>{{ 'PROFILE.changePassword' | translate }}</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                @if (pwdError()) {
                  <div class="error-banner">{{ pwdError() }}</div>
                }
                <form [formGroup]="passwordForm" class="form-col">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'PROFILE.currentPassword' | translate }}</mat-label>
                    <input matInput formControlName="currentPassword"
                           [type]="showCurrent ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showCurrent = !showCurrent">
                      <mat-icon>{{ showCurrent ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'PROFILE.newPassword' | translate }}</mat-label>
                    <input matInput formControlName="newPassword"
                           [type]="showNew ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showNew = !showNew">
                      <mat-icon>{{ showNew ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    <mat-hint>{{ 'PROFILE.minChars' | translate }}</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>{{ 'PROFILE.confirmNewPassword' | translate }}</mat-label>
                    <input matInput formControlName="confirmPassword"
                           [type]="showConfirm ? 'text' : 'password'" />
                    <button mat-icon-button matSuffix type="button"
                            (click)="showConfirm = !showConfirm">
                      <mat-icon>{{ showConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                    @if (passwordForm.hasError('mismatch') && passwordForm.get('confirmPassword')?.touched) {
                      <mat-error>{{ 'PROFILE.passwordsMismatch' | translate }}</mat-error>
                    }
                  </mat-form-field>
                </form>
                <div class="form-actions">
                  <button mat-raised-button color="primary"
                          (click)="changePassword()"
                          [disabled]="passwordForm.invalid || savingPassword()">
                    @if (savingPassword()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>lock_reset</mat-icon> {{ 'PROFILE.updatePassword' | translate }} }
                  </button>
                </div>
              </div>
            </div>

            <!-- Sign-in Methods -->
            <div class="card">
              <div class="card-header">
                <mat-icon>fingerprint</mat-icon>
                <h2>{{ 'PROFILE.signinMethods' | translate }}</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                <p class="section-desc">{{ 'PROFILE.signinMethodsDesc' | translate }}</p>

                <!-- Passkeys -->
                <div class="signin-section">
                  <div class="signin-section-header">
                    <mat-icon>key</mat-icon>
                    <span>{{ 'PROFILE.passkeys' | translate }}</span>
                    <button mat-stroked-button class="add-passkey-btn" (click)="registerPasskey()"
                            [disabled]="registeringPasskey()">
                      @if (registeringPasskey()) { <mat-spinner diameter="16" /> }
                      @else { <mat-icon>add</mat-icon> }
                      {{ 'PROFILE.addPasskey' | translate }}
                    </button>
                  </div>
                  @if (passkeys().length === 0) {
                    <div class="signin-empty">
                      {{ 'PROFILE.noPasskeys' | translate }}
                    </div>
                  } @else {
                    <div class="signin-list">
                      @for (pk of passkeys(); track pk.credentialId) {
                        <div class="signin-item">
                          <mat-icon class="signin-item-icon">fingerprint</mat-icon>
                          <div class="signin-item-info">
                            <strong>{{ pk.label || 'Passkey' }}</strong>
                            <span>{{ pk.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device-bound' }} · Added {{ pk.createdAt | date:'MMM d, y' }}</span>
                          </div>
                          <button mat-icon-button class="signin-remove" [matTooltip]="'COMMON.remove' | translate" (click)="removePasskey(pk)">
                            <mat-icon>delete_outline</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>

                <mat-divider style="margin: 16px 0" />

                <!-- Linked accounts -->
                <div class="signin-section">
                  <div class="signin-section-header">
                    <mat-icon>link</mat-icon>
                    <span>{{ 'PROFILE.linkedAccounts' | translate }}</span>
                  </div>
                  @if (oauthAccounts().length === 0) {
                    <div class="signin-empty">
                      {{ 'PROFILE.noLinkedAccounts' | translate }}
                    </div>
                  } @else {
                    <div class="signin-list">
                      @for (acct of oauthAccounts(); track acct.provider + acct.providerId) {
                        <div class="signin-item">
                          <mat-icon class="signin-item-icon" [class]="acct.provider">
                            {{ acct.provider === 'google' ? 'g_mobiledata' : 'window' }}
                          </mat-icon>
                          <div class="signin-item-info">
                            <strong>{{ acct.provider === 'google' ? 'Google' : 'Microsoft' }}</strong>
                            <span>{{ acct.email }} · Linked {{ acct.linkedAt | date:'MMM d, y' }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Security / 2FA -->
            <div class="card">
              <div class="card-header">
                <mat-icon>security</mat-icon>
                <h2>{{ 'PROFILE.security' | translate }}</h2>
              </div>
              <mat-divider />
              <div class="card-body">

                <!-- 2FA: disabled state -->
                @if (!twoFactorEnabled() && !twoFactorSetupStep()) {
                  <div class="security-row">
                    <div class="security-icon"><mat-icon>phonelink_lock</mat-icon></div>
                    <div class="toggle-info">
                      <div class="toggle-label">{{ 'PROFILE.twoFactorAuth' | translate }}</div>
                      <div class="toggle-desc">{{ 'PROFILE.twoFactorAuthDesc' | translate }}</div>
                    </div>
                    <button mat-raised-button color="primary" (click)="setup2fa()" [disabled]="twoFactorLoading()">
                      @if (twoFactorLoading()) { <mat-spinner diameter="18" /> } @else { {{ 'PROFILE.enable2FA' | translate }} }
                    </button>
                  </div>
                }

                <!-- 2FA: setup flow — scan QR then verify -->
                @if (twoFactorSetupStep()) {
                  <div class="twofa-setup">
                    @if (twoFactorSetupStep() === 'scan') {
                      <div class="setup-step">
                        <h3><span class="step-num">1</span> {{ 'PROFILE.scanQR' | translate }}</h3>
                        <p [innerHTML]="'PROFILE.scanQRDesc' | translate"></p>
                        @if (qrCodeDataUrl()) {
                          <div class="qr-block">
                            <img [src]="qrCodeDataUrl()" alt="2FA QR Code" class="qr-img" />
                          </div>
                        }
                        <details class="manual-key">
                          <summary>{{ 'PROFILE.cantScanManualKey' | translate }}</summary>
                          <code>{{ manualSecret() }}</code>
                        </details>
                        <button mat-raised-button color="primary" (click)="twoFactorSetupStep.set('verify')">
                          {{ 'COMMON.next' | translate }} <mat-icon>arrow_forward</mat-icon>
                        </button>
                        <button mat-button (click)="cancelSetup()">{{ 'COMMON.cancel' | translate }}</button>
                      </div>
                    }

                    @if (twoFactorSetupStep() === 'verify') {
                      <div class="setup-step">
                        <h3><span class="step-num">2</span> {{ 'PROFILE.enterCode' | translate }}</h3>
                        <p>{{ 'PROFILE.enterCodeDesc' | translate }}</p>
                        @if (twoFactorError()) {
                          <div class="error-banner">{{ twoFactorError() }}</div>
                        }
                        <mat-form-field appearance="outline" class="otp-field">
                          <mat-label>{{ 'PROFILE.authenticatorCode' | translate }}</mat-label>
                          <input matInput [formControl]="otpControl" inputmode="numeric"
                                 maxlength="6" placeholder="000000" />
                          <mat-icon matPrefix>pin</mat-icon>
                        </mat-form-field>
                        <div class="step-actions">
                          <button mat-button (click)="twoFactorSetupStep.set('scan')">
                            <mat-icon>arrow_back</mat-icon> {{ 'COMMON.back' | translate }}
                          </button>
                          <button mat-raised-button color="primary"
                                  (click)="enable2fa()" [disabled]="otpControl.invalid || twoFactorLoading()">
                            @if (twoFactorLoading()) { <mat-spinner diameter="18" /> }
                            @else { <mat-icon>verified</mat-icon> {{ 'PROFILE.confirmEnable' | translate }} }
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- 2FA: enabled state -->
                @if (twoFactorEnabled()) {
                  @if (twoFactorSetupStep() !== 'disable') {
                    <div class="security-row enabled-row">
                      <div class="security-icon green"><mat-icon>verified_user</mat-icon></div>
                      <div class="toggle-info">
                        <div class="toggle-label">{{ 'PROFILE.twoFactorAuth' | translate }}
                          <span class="enabled-badge">{{ 'PROFILE.enabled' | translate }}</span>
                        </div>
                        <div class="toggle-desc">{{ 'PROFILE.twoFactorProtected' | translate }}</div>
                      </div>
                      <button mat-stroked-button color="warn" (click)="twoFactorSetupStep.set('disable')">
                        {{ 'PROFILE.disable' | translate }}
                      </button>
                    </div>
                  }

                  @if (twoFactorSetupStep() === 'disable') {
                    <div class="twofa-setup">
                      <div class="setup-step">
                        @if (twoFactorError()) {
                          <div class="error-banner">{{ twoFactorError() }}</div>
                        }
                        <p>{{ 'PROFILE.disable2FAConfirm' | translate }}</p>
                        <mat-form-field appearance="outline" class="otp-field">
                          <mat-label>{{ 'PROFILE.authenticatorCode' | translate }}</mat-label>
                          <input matInput [formControl]="otpControl" inputmode="numeric"
                                 maxlength="6" placeholder="000000" />
                          <mat-icon matPrefix>pin</mat-icon>
                        </mat-form-field>
                        <div class="step-actions">
                          <button mat-button (click)="cancelSetup()">{{ 'COMMON.cancel' | translate }}</button>
                          <button mat-raised-button color="warn"
                                  (click)="disable2fa()" [disabled]="otpControl.invalid || twoFactorLoading()">
                            @if (twoFactorLoading()) { <mat-spinner diameter="18" /> }
                            @else { {{ 'PROFILE.disable2FA' | translate }} }
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                }

                <mat-divider />

                <div class="security-row">
                  <div class="security-icon"><mat-icon>devices</mat-icon></div>
                  <div class="toggle-info">
                    <div class="toggle-label">{{ 'PROFILE.activeSessions' | translate }}</div>
                    <div class="toggle-desc">{{ 'PROFILE.activeSessionsDesc' | translate }}</div>
                  </div>
                  <button mat-stroked-button (click)="openLoginSessions()">{{ 'COMMON.view' | translate }}</button>
                </div>

                <mat-divider />

                <div class="security-row">
                  <div class="security-icon warn"><mat-icon>download</mat-icon></div>
                  <div class="toggle-info">
                    <div class="toggle-label">{{ 'PROFILE.exportData' | translate }}</div>
                    <div class="toggle-desc">{{ 'PROFILE.exportDataDesc' | translate }}</div>
                  </div>
                  <button mat-stroked-button disabled>{{ 'COMMON.comingSoon' | translate }}</button>
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
      h1 { font-size: 28px; color: var(--artes-primary); margin: 0 0 4px; }
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

    .avatar-wrapper {
      position: relative; cursor: pointer; margin-bottom: 4px;
      &:hover .avatar-overlay { opacity: 1; }
    }
    .avatar-circle {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, var(--artes-accent), #27C4A0);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: 700; color: white;
    }
    .avatar-img { object-fit: cover; }
    .avatar-overlay {
      position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.15s;
      mat-icon { color: white; font-size: 24px; }
    }

    .avatar-name  { font-size: 16px; font-weight: 600; color: var(--artes-primary); }
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
      mat-icon { color: var(--artes-accent); }
      h2 { font-size: 16px; color: var(--artes-primary); margin: 0; font-weight: 600; }
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

    /* Sign-in methods */
    .section-desc { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }

    .signin-section-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 14px; font-weight: 600; color: var(--artes-primary);
      mat-icon { font-size: 18px; color: var(--artes-accent); }
      .add-passkey-btn { margin-left: auto; font-size: 12px; }
    }

    .signin-empty { font-size: 13px; color: #9aa5b4; padding: 8px 0; }

    .signin-list { display: flex; flex-direction: column; gap: 8px; }

    .signin-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px; border: 1px solid #e8edf4; border-radius: 10px; background: #fafbfc;
    }

    .signin-item-icon {
      font-size: 22px; width: 22px; height: 22px; color: #7c5cbf;
      &.google { color: #4285F4; }
      &.microsoft { color: #00a4ef; }
    }

    .signin-item-info {
      flex: 1; min-width: 0;
      strong { display: block; font-size: 13px; color: var(--artes-primary); }
      span { font-size: 11px; color: #9aa5b4; }
    }

    .signin-remove { color: #c5d0db; &:hover { color: #e53e3e; } }

    /* Security / 2FA */
    .security-row {
      display: flex; align-items: center; gap: 14px; padding: 14px 24px;
    }

    .security-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: rgba(58,159,214,0.10); color: var(--artes-accent);
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; }
      &.warn  { background: rgba(232,108,58,0.10);  color: #c04a14; }
      &.green { background: rgba(39,196,160,0.12);  color: #1a9678; }
    }

    .toggle-info { flex: 1; }
    .toggle-label { font-size: 14px; color: var(--artes-primary); font-weight: 500; }
    .toggle-desc  { font-size: 12px; color: #9aa5b4; margin-top: 2px; line-height: 1.4; }

    .enabled-row {}
    .enabled-badge {
      display: inline-block; margin-left: 8px;
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: rgba(39,196,160,0.15); color: #1a9678;
    }

    .twofa-setup { padding: 0 24px 16px; }

    .setup-step {
      background: #f8fafc; border-radius: 12px; padding: 20px;
      h3 {
        font-size: 15px; color: var(--artes-primary); margin: 0 0 8px; font-weight: 600;
        display: flex; align-items: center; gap: 8px;
      }
      p { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; line-height: 1.5; }
    }

    .step-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--artes-accent); color: white; font-size: 12px; font-weight: 700;
    }

    .qr-block {
      display: flex; justify-content: center; margin: 0 0 16px;
      img.qr-img { width: 180px; height: 180px; border-radius: 8px; border: 1px solid #e5eaf0; }
    }

    .manual-key {
      font-size: 12px; color: #5a6a7e; margin-bottom: 16px;
      summary { cursor: pointer; margin-bottom: 8px; }
      code {
        display: block; padding: 8px 12px; background: #eef2f7; border-radius: 6px;
        font-family: monospace; letter-spacing: 2px; word-break: break-all;
      }
    }

    .otp-field { width: 200px; display: block; }

    .step-actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
  `],
})
export class ProfileComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);
  private fb   = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

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

  passkeys = signal<PasskeyInfo[]>([]);
  oauthAccounts = signal<OAuthAccountInfo[]>([]);
  registeringPasskey = signal(false);

  // 2FA state
  twoFactorEnabled    = signal(false);
  twoFactorSetupStep  = signal<'' | 'scan' | 'verify' | 'disable'>('');
  qrCodeDataUrl       = signal('');
  manualSecret        = signal('');
  twoFactorLoading    = signal(false);
  twoFactorError      = signal('');
  otpControl          = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]);

  initials  = computed(() => {
    const p = this.profile();
    return p ? `${p.firstName[0]}${p.lastName[0]}`.toUpperCase() : '?';
  });
  roleLabel = computed(() => ROLE_LABELS[this.profile()?.role ?? ''] ?? this.profile()?.role ?? '');
  avatarUrl = computed(() => this.profile()?.profilePicture || '');

  ngOnInit(): void {
    this.passwordForm = this.fb.group({
      currentPassword:  ['', Validators.required],
      newPassword:      ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword:  ['', Validators.required],
    }, { validators: passwordMatchValidator });

    this.api.get<UserProfile>('/users/me').subscribe({
      next: (p) => {
        this.profile.set(p);
        this.passkeys.set(p.passkeys ?? []);
        this.oauthAccounts.set(p.oauthAccounts ?? []);
        this.twoFactorEnabled.set(p.twoFactorEnabled ?? false);
        this.profileForm = this.fb.group({
          firstName: [p.firstName, Validators.required],
          lastName:  [p.lastName,  Validators.required],
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.loadPasskeys();
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
        this.snackBar.open(this.translate.instant('PROFILE.profileUpdated'), this.translate.instant('COMMON.close'), { duration: 2500 });
      },
      error: () => { this.savingProfile.set(false); this.snackBar.open(this.translate.instant('PROFILE.saveFailed'), this.translate.instant('COMMON.close'), { duration: 2500 }); },
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
        this.snackBar.open(this.translate.instant('PROFILE.passwordUpdated'), this.translate.instant('COMMON.close'), { duration: 3000 });
      },
      error: (err) => {
        this.pwdError.set(err.error?.error || this.translate.instant('PROFILE.passwordFailed'));
        this.savingPassword.set(false);
      },
    });
  }

  // ── Passkeys ──────────────────────────────────────────────────
  loadPasskeys(): void {
    this.api.get<PasskeyInfo[]>('/auth/passkey/passkeys').subscribe({
      next: (pks) => this.passkeys.set(pks),
    });
  }

  async registerPasskey(): Promise<void> {
    this.registeringPasskey.set(true);
    try {
      // 1. Get registration options from server
      const optionsRes = await fetch(`${environment.apiUrl}/auth/passkey/register-options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.auth.getToken()}`,
        },
      });
      if (!optionsRes.ok) throw new Error('Failed to get registration options');
      const options = await optionsRes.json();

      // 2. Create credential via browser WebAuthn API
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rp: { name: options.rp.name, id: options.rp.id },
        user: {
          id: Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout || 60000,
        attestation: options.attestation || 'none',
        authenticatorSelection: options.authenticatorSelection,
        excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
          id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)),
          type: c.type || 'public-key',
          transports: c.transports,
        })),
      };

      const credential = await navigator.credentials.create({ publicKey: publicKeyOptions }) as PublicKeyCredential;
      if (!credential) throw new Error('No credential created');

      const response = credential.response as AuthenticatorAttestationResponse;
      const toBase64Url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const credentialJSON = {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: toBase64Url(response.attestationObject),
          clientDataJSON: toBase64Url(response.clientDataJSON),
          transports: (response as any).getTransports?.() || [],
        },
        clientExtensionResults: credential.getClientExtensionResults(),
      };

      // 3. Ask for a label via dialog
      const label = await new Promise<string>((resolve) => {
        const ref = this.dialog.open(PasskeyLabelDialogComponent, { width: '440px' });
        ref.afterClosed().subscribe((result) => resolve(result || 'Passkey'));
      });

      // 4. Verify with server
      const verifyRes = await fetch(`${environment.apiUrl}/auth/passkey/register-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.auth.getToken()}`,
        },
        body: JSON.stringify({ credential: credentialJSON, label }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || 'Registration failed');
      }

      this.registeringPasskey.set(false);
      this.loadPasskeys();
      this.snackBar.open(this.translate.instant('PROFILE.passkeyRegistered'), this.translate.instant('COMMON.ok'), { duration: 3000 });
    } catch (e: any) {
      this.registeringPasskey.set(false);
      const msg = e?.message === 'The operation either timed out or was not allowed.'
        ? this.translate.instant('PROFILE.passkeyCancelled')
        : (e?.message || this.translate.instant('PROFILE.passkeyFailed'));
      this.snackBar.open(msg, this.translate.instant('COMMON.dismiss'), { duration: 4000 });
    }
  }

  // ── 2FA ───────────────────────────────────────────────────────
  setup2fa(): void {
    this.twoFactorLoading.set(true);
    this.twoFactorError.set('');
    this.api.post<{ qrCodeDataUrl: string; secret: string }>('/users/me/2fa/setup', {}).subscribe({
      next: (res) => {
        this.qrCodeDataUrl.set(res.qrCodeDataUrl);
        this.manualSecret.set(res.secret);
        this.twoFactorSetupStep.set('scan');
        this.twoFactorLoading.set(false);
      },
      error: (err) => {
        this.twoFactorError.set(err.error?.error || 'Setup failed. Please try again.');
        this.twoFactorLoading.set(false);
      },
    });
  }

  enable2fa(): void {
    if (this.otpControl.invalid) return;
    this.twoFactorLoading.set(true);
    this.twoFactorError.set('');
    const otp = this.otpControl.value!.replace(/\s/g, '');
    this.api.post<{ message: string }>('/users/me/2fa/enable', { otp }).subscribe({
      next: () => {
        this.twoFactorEnabled.set(true);
        this.twoFactorSetupStep.set('');
        this.otpControl.reset();
        this.twoFactorLoading.set(false);
        this.snackBar.open(this.translate.instant('PROFILE.twoFactorEnabled'), undefined, { duration: 3000 });
      },
      error: (err) => {
        this.twoFactorError.set(err.error?.error || this.translate.instant('PROFILE.invalidCode'));
        this.twoFactorLoading.set(false);
      },
    });
  }

  disable2fa(): void {
    if (this.otpControl.invalid) return;
    this.twoFactorLoading.set(true);
    this.twoFactorError.set('');
    const otp = this.otpControl.value!.replace(/\s/g, '');
    this.api.delete<{ message: string }>('/users/me/2fa', { body: { otp } }).subscribe({
      next: () => {
        this.twoFactorEnabled.set(false);
        this.twoFactorSetupStep.set('');
        this.otpControl.reset();
        this.twoFactorLoading.set(false);
        this.snackBar.open(this.translate.instant('PROFILE.twoFactorDisabled'), undefined, { duration: 3000 });
      },
      error: (err) => {
        this.twoFactorError.set(err.error?.error || this.translate.instant('PROFILE.invalidCode'));
        this.twoFactorLoading.set(false);
      },
    });
  }

  cancelSetup(): void {
    this.twoFactorSetupStep.set('');
    this.otpControl.reset();
    this.twoFactorError.set('');
  }

  uploadAvatar(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    // Use raw HttpClient for multipart — ApiService wraps JSON only
    const url = `${environment.apiUrl}/users/me/avatar`;
    const headers = { Authorization: `Bearer ${this.auth.getToken()}` };
    fetch(url, { method: 'POST', headers, body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.profilePicture) {
          this.profile.update((p) => p ? { ...p, profilePicture: data.profilePicture } : p);
          // Update auth signal so sidebar avatar updates immediately
          const cur = this.auth.currentUser();
          if (cur) {
            const updated = { ...cur, profilePicture: data.profilePicture };
            this.auth.currentUser.set(updated);
            localStorage.setItem('pip_user', JSON.stringify(updated));
          }
          this.snackBar.open(this.translate.instant('PROFILE.pictureUpdated'), '', { duration: 2000 });
        }
      })
      .catch(() => this.snackBar.open(this.translate.instant('PROFILE.pictureFailed'), '', { duration: 3000 }));
  }

  removePasskey(pk: PasskeyInfo): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Remove Passkey',
        message: `Remove "${pk.label}"? You won't be able to use it to sign in anymore.`,
        confirmLabel: 'Remove',
        confirmColor: 'warn',
        icon: 'fingerprint',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/auth/passkey/passkeys/${pk.credentialId}`).subscribe({
        next: () => {
          this.passkeys.update((list) => list.filter((p) => p.credentialId !== pk.credentialId));
          this.snackBar.open(this.translate.instant('PROFILE.passkeyRemoved'), this.translate.instant('COMMON.ok'), { duration: 3000 });
        },
      });
    });
  }

  openLoginSessions() {
    this.dialog.open(LoginSessionsDialogComponent, { width: '500px' });
  }
}

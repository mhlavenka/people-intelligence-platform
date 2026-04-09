import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PasskeyLabelDialogComponent } from './passkey-label-dialog.component';
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

            <!-- Sign-in Methods -->
            <div class="card">
              <div class="card-header">
                <mat-icon>fingerprint</mat-icon>
                <h2>Sign-in Methods</h2>
              </div>
              <mat-divider />
              <div class="card-body">
                <p class="section-desc">Manage passkeys and linked accounts for faster, more secure sign-in.</p>

                <!-- Passkeys -->
                <div class="signin-section">
                  <div class="signin-section-header">
                    <mat-icon>key</mat-icon>
                    <span>Passkeys</span>
                    <button mat-stroked-button class="add-passkey-btn" (click)="registerPasskey()"
                            [disabled]="registeringPasskey()">
                      @if (registeringPasskey()) { <mat-spinner diameter="16" /> }
                      @else { <mat-icon>add</mat-icon> }
                      Add Passkey
                    </button>
                  </div>
                  @if (passkeys().length === 0) {
                    <div class="signin-empty">
                      No passkeys registered. Add one to sign in with Touch ID, Face ID, or a security key.
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
                          <button mat-icon-button class="signin-remove" matTooltip="Remove" (click)="removePasskey(pk)">
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
                    <span>Linked Accounts</span>
                  </div>
                  @if (oauthAccounts().length === 0) {
                    <div class="signin-empty">
                      No linked accounts. Sign in with Google or Microsoft once to link automatically.
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

    .avatar-wrapper {
      position: relative; cursor: pointer; margin-bottom: 4px;
      &:hover .avatar-overlay { opacity: 1; }
    }
    .avatar-circle {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, #3A9FD6, #27C4A0);
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

    /* Sign-in methods */
    .section-desc { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }

    .signin-section-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 14px; font-weight: 600; color: #1B2A47;
      mat-icon { font-size: 18px; color: #3A9FD6; }
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
      strong { display: block; font-size: 13px; color: #1B2A47; }
      span { font-size: 11px; color: #9aa5b4; }
    }

    .signin-remove { color: #c5d0db; &:hover { color: #e53e3e; } }
  `],
})
export class ProfileComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);
  private fb   = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

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

  initials  = computed(() => {
    const p = this.profile();
    return p ? `${p.firstName[0]}${p.lastName[0]}`.toUpperCase() : '?';
  });
  roleLabel = computed(() => ROLE_LABELS[this.profile()?.role ?? ''] ?? this.profile()?.role ?? '');
  avatarUrl = computed(() => {
    const pic = this.profile()?.profilePicture;
    return pic ? `${environment.apiUrl.replace('/api', '')}${pic}` : '';
  });

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
      this.snackBar.open('Passkey registered successfully', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.registeringPasskey.set(false);
      const msg = e?.message === 'The operation either timed out or was not allowed.'
        ? 'Passkey registration was cancelled.'
        : (e?.message || 'Failed to register passkey.');
      this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
    }
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
          this.snackBar.open('Profile picture updated', '', { duration: 2000 });
        }
      })
      .catch(() => this.snackBar.open('Failed to upload picture', '', { duration: 3000 }));
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
          this.snackBar.open('Passkey removed', 'OK', { duration: 3000 });
        },
      });
    });
  }
}

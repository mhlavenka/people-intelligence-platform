import { Component, OnInit, signal } from '@angular/core';
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
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-logo">
            <img src="assets/PIP_Logo_Light.png" alt="HeadSoft" class="logo-img" />
          </div>
        </div>

        @if (!twoFactorStep()) {
          <!-- Step 1: email + password -->
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

          <div class="auth-brand-footer">
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
    .auth-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1B2A47 0%, #2a3f6b 50%, #3A9FD6 100%);
      padding: 16px;
    }

    .auth-card {
      background: white; border-radius: 16px; padding: 48px;
      width: 100%; max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }

    .auth-brand {
      text-align: center; margin-bottom: 32px;
      .brand-logo {
        width: 100%; max-width: 320px; height: auto; border-radius: 16px; margin: 0 auto;
        display: flex; align-items: center; justify-content: center; overflow: hidden;
        .logo-img { width: 100%; height: auto; max-height: 120px; object-fit: contain; display: block; }
      }
    }

    @media (max-width: 480px) {
      .auth-card { padding: 32px 24px; border-radius: 12px; }
      .auth-brand .brand-logo { max-width: 240px; }
    }

    .auth-brand-footer {
      text-align: center; margin-top: 24px;
      p { font-size: 12px; color: #9aa5b4; margin: 0; }
    }
    .icon-logo { width: 16px; height: 16px; margin: -3px 2px; }

    h2 { font-size: 20px; color: #1B2A47; margin-bottom: 24px; font-weight: 600; }

    .full-width { width: 100%; }
    .submit-btn { height: 48px; font-size: 16px; font-weight: 600; margin-top: 8px; }

    .auth-links {
      display: flex; gap: 8px; justify-content: center; margin-top: 20px; font-size: 14px;
      a { color: #3A9FD6; }
      span { color: #9aa5b4; }
    }

    /* Divider */
    .divider-row {
      display: flex; align-items: center; gap: 12px; margin: 24px 0 16px;
      mat-divider { flex: 1; }
      .divider-text { font-size: 12px; color: #9aa5b4; white-space: nowrap; }
    }

    /* Alt auth buttons */
    .alt-auth-buttons {
      display: flex; gap: 10px;
    }

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
      h2 { margin-bottom: 8px; }
      p  { font-size: 14px; color: #5a6a7e; margin: 0; }
    }
    .otp-field input { font-size: 24px; letter-spacing: 8px; text-align: center; }
    .back-link { display: flex; justify-content: center; margin-top: 8px; }
  `],
})
export class LoginComponent implements OnInit {
  form: FormGroup;
  otpForm: FormGroup;
  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);
  twoFactorStep = signal(false);
  providers    = signal<OAuthProviders | null>(null);
  private tempToken = '';

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
    // Load available auth providers
    this.api.get<OAuthProviders>('/auth/oauth/providers').subscribe({
      next: (p) => this.providers.set(p),
      error: () => {}, // providers endpoint not available — just hide buttons
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
      // 1. Get challenge from server
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

      // 2. Prompt browser for passkey via WebAuthn API
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

      // 3. Verify with server
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

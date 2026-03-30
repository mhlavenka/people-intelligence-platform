import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';

interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
}

interface Settings {
  notifications: Record<string, boolean>;
  language: string;
  timezone: string;
  surveyAnonymous: boolean;
  compactSidebar: boolean;
  showTips: boolean;
}

const STORAGE_KEY = 'pip_settings';

const DEFAULT_SETTINGS: Settings = {
  notifications: {
    conflict_analysis:  true,
    escalation_alerts:  true,
    idp_milestones:     true,
    survey_reminders:   false,
    weekly_digest:      true,
    new_idp_assigned:   true,
  },
  language:        'en',
  timezone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
  surveyAnonymous: true,
  compactSidebar:  false,
  showTips:        true,
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ReactiveFormsModule,
  ],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1>Settings</h1>
        <p>Customize your experience and notification preferences</p>
      </div>

      <div class="settings-layout">

        <!-- Notifications -->
        <div class="card">
          <div class="card-header">
            <mat-icon>notifications</mat-icon>
            <div>
              <h2>Email Notifications</h2>
              <p>Choose which events trigger an email notification</p>
            </div>
          </div>
          <mat-divider />
          <div class="card-body">
            @for (n of notificationItems; track n.key) {
              <div class="toggle-row">
                <div class="toggle-icon" [class]="n.iconClass">
                  <mat-icon>{{ n.icon }}</mat-icon>
                </div>
                <div class="toggle-info">
                  <div class="toggle-label">{{ n.label }}</div>
                  <div class="toggle-desc">{{ n.description }}</div>
                </div>
                <mat-slide-toggle
                  color="primary"
                  [checked]="settings().notifications[n.key]"
                  (change)="setNotification(n.key, $event.checked)"
                />
              </div>
              @if (!$last) { <mat-divider /> }
            }
          </div>
        </div>

        <!-- Display preferences -->
        <div class="card">
          <div class="card-header">
            <mat-icon>palette</mat-icon>
            <div>
              <h2>Display Preferences</h2>
              <p>Adjust language, timezone, and layout options</p>
            </div>
          </div>
          <mat-divider />
          <div class="card-body">
            <div class="select-row">
              <mat-form-field appearance="outline">
                <mat-label>Language</mat-label>
                <mat-select [ngModel]="settings().language"
                            (ngModelChange)="updateSetting('language', $event)">
                  <mat-option value="en">English</mat-option>
                  <mat-option value="cs">Czech</mat-option>
                  <mat-option value="sk">Slovak</mat-option>
                  <mat-option value="de">German</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Timezone</mat-label>
                <mat-select [ngModel]="settings().timezone"
                            (ngModelChange)="updateSetting('timezone', $event)">
                  @for (tz of timezones; track tz.value) {
                    <mat-option [value]="tz.value">{{ tz.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <mat-divider />

            <div class="toggle-row">
              <div class="toggle-icon blue"><mat-icon>view_sidebar</mat-icon></div>
              <div class="toggle-info">
                <div class="toggle-label">Compact sidebar</div>
                <div class="toggle-desc">Start with the sidebar collapsed by default</div>
              </div>
              <mat-slide-toggle color="primary"
                [checked]="settings().compactSidebar"
                (change)="updateSetting('compactSidebar', $event.checked)" />
            </div>

            <mat-divider />

            <div class="toggle-row">
              <div class="toggle-icon green"><mat-icon>tips_and_updates</mat-icon></div>
              <div class="toggle-info">
                <div class="toggle-label">Show contextual tips</div>
                <div class="toggle-desc">Display helpful hints and guidance throughout the platform</div>
              </div>
              <mat-slide-toggle color="primary"
                [checked]="settings().showTips"
                (change)="updateSetting('showTips', $event.checked)" />
            </div>
          </div>
        </div>

        <!-- Privacy & surveys -->
        <div class="card">
          <div class="card-header">
            <mat-icon>shield</mat-icon>
            <div>
              <h2>Privacy & Surveys</h2>
              <p>Control how your data is handled when taking surveys</p>
            </div>
          </div>
          <mat-divider />
          <div class="card-body">
            <div class="toggle-row">
              <div class="toggle-icon green"><mat-icon>visibility_off</mat-icon></div>
              <div class="toggle-info">
                <div class="toggle-label">Submit surveys anonymously</div>
                <div class="toggle-desc">
                  Your identity is never stored with your responses. Only an
                  irreversible token is used to prevent duplicate submissions.
                </div>
              </div>
              <mat-slide-toggle color="primary"
                [checked]="settings().surveyAnonymous"
                (change)="updateSetting('surveyAnonymous', $event.checked)" />
            </div>

            <mat-divider />

            <div class="info-box">
              <mat-icon>info</mat-icon>
              <p>Survey results are only visible to administrators after a minimum of
              <strong>5 responses</strong> have been collected, protecting individual privacy at all times.</p>
            </div>
          </div>
        </div>

        <!-- Security / 2FA -->
        <div class="card">
          <div class="card-header">
            <mat-icon>security</mat-icon>
            <div>
              <h2>Security</h2>
              <p>Manage two-factor authentication and account security</p>
            </div>
          </div>
          <mat-divider />
          <div class="card-body">

            <!-- 2FA: disabled state -->
            @if (!twoFactorEnabled() && !twoFactorSetupStep()) {
              <div class="security-row">
                <div class="security-icon"><mat-icon>phonelink_lock</mat-icon></div>
                <div class="toggle-info">
                  <div class="toggle-label">Two-factor authentication</div>
                  <div class="toggle-desc">Protect your account with Google Authenticator or any TOTP app</div>
                </div>
                <button mat-raised-button color="primary" (click)="setup2fa()" [disabled]="twoFactorLoading()">
                  @if (twoFactorLoading()) { <mat-spinner diameter="18" /> } @else { Enable 2FA }
                </button>
              </div>
            }

            <!-- 2FA: setup flow — scan QR then verify -->
            @if (twoFactorSetupStep()) {
              <div class="twofa-setup">
                @if (twoFactorSetupStep() === 'scan') {
                  <div class="setup-step">
                    <h3><span class="step-num">1</span> Scan with Google Authenticator</h3>
                    <p>Open <strong>Google Authenticator</strong> (or any TOTP app), tap <strong>+</strong> → <em>Scan a QR code</em>.</p>
                    @if (qrCodeDataUrl()) {
                      <div class="qr-block">
                        <img [src]="qrCodeDataUrl()" alt="2FA QR Code" class="qr-img" />
                      </div>
                    }
                    <details class="manual-key">
                      <summary>Can't scan? Enter key manually</summary>
                      <code>{{ manualSecret() }}</code>
                    </details>
                    <button mat-raised-button color="primary" (click)="twoFactorSetupStep.set('verify')">
                      Next <mat-icon>arrow_forward</mat-icon>
                    </button>
                    <button mat-button (click)="cancelSetup()">Cancel</button>
                  </div>
                }

                @if (twoFactorSetupStep() === 'verify') {
                  <div class="setup-step">
                    <h3><span class="step-num">2</span> Enter the 6-digit code</h3>
                    <p>Type the current code shown in your authenticator app to confirm setup.</p>
                    @if (twoFactorError()) {
                      <div class="error-banner">{{ twoFactorError() }}</div>
                    }
                    <mat-form-field appearance="outline" class="otp-field">
                      <mat-label>Authenticator code</mat-label>
                      <input matInput [formControl]="otpControl" inputmode="numeric"
                             maxlength="6" placeholder="000000" />
                      <mat-icon matPrefix>pin</mat-icon>
                    </mat-form-field>
                    <div class="step-actions">
                      <button mat-button (click)="twoFactorSetupStep.set('scan')">
                        <mat-icon>arrow_back</mat-icon> Back
                      </button>
                      <button mat-raised-button color="primary"
                              (click)="enable2fa()" [disabled]="otpControl.invalid || twoFactorLoading()">
                        @if (twoFactorLoading()) { <mat-spinner diameter="18" /> }
                        @else { <mat-icon>verified</mat-icon> Confirm & Enable }
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
                    <div class="toggle-label">Two-factor authentication
                      <span class="enabled-badge">Enabled</span>
                    </div>
                    <div class="toggle-desc">Your account is protected with Google Authenticator</div>
                  </div>
                  <button mat-stroked-button color="warn" (click)="twoFactorSetupStep.set('disable')">
                    Disable
                  </button>
                </div>
              }

              @if (twoFactorSetupStep() === 'disable') {
                <div class="twofa-setup">
                  <div class="setup-step">
                    @if (twoFactorError()) {
                      <div class="error-banner">{{ twoFactorError() }}</div>
                    }
                    <p>Enter your current authenticator code to confirm disabling 2FA.</p>
                    <mat-form-field appearance="outline" class="otp-field">
                      <mat-label>Authenticator code</mat-label>
                      <input matInput [formControl]="otpControl" inputmode="numeric"
                             maxlength="6" placeholder="000000" />
                      <mat-icon matPrefix>pin</mat-icon>
                    </mat-form-field>
                    <div class="step-actions">
                      <button mat-button (click)="cancelSetup()">Cancel</button>
                      <button mat-raised-button color="warn"
                              (click)="disable2fa()" [disabled]="otpControl.invalid || twoFactorLoading()">
                        @if (twoFactorLoading()) { <mat-spinner diameter="18" /> }
                        @else { Disable 2FA }
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
                <div class="toggle-label">Active sessions</div>
                <div class="toggle-desc">View and revoke sessions on other devices</div>
              </div>
              <button mat-stroked-button disabled>Coming soon</button>
            </div>

            <mat-divider />

            <div class="security-row">
              <div class="security-icon warn"><mat-icon>download</mat-icon></div>
              <div class="toggle-info">
                <div class="toggle-label">Export personal data</div>
                <div class="toggle-desc">Download a copy of all data associated with your account</div>
              </div>
              <button mat-stroked-button disabled>Coming soon</button>
            </div>

          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .settings-page { padding: 32px; max-width: 820px; }

    .page-header {
      margin-bottom: 28px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .settings-layout { display: flex; flex-direction: column; gap: 20px; }

    .card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .card-header {
      display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px;
      > mat-icon { color: #3A9FD6; margin-top: 2px; flex-shrink: 0; }
      h2 { font-size: 16px; color: #1B2A47; margin: 0 0 2px; font-weight: 600; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
    }

    .card-body { padding: 8px 0; }

    .toggle-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 24px;
    }

    .toggle-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; }
    }

    .toggle-icon.blue   { background: rgba(58,159,214,0.12); color: #2080b0; }
    .toggle-icon.green  { background: rgba(39,196,160,0.12); color: #1a9678; }
    .toggle-icon.orange { background: rgba(240,165,0,0.12);  color: #b07800; }
    .toggle-icon.red    { background: rgba(232,108,58,0.12); color: #c04a14; }
    .toggle-icon.navy   { background: rgba(27,42,71,0.10);   color: #1B2A47; }

    .toggle-info { flex: 1; }
    .toggle-label { font-size: 14px; color: #1B2A47; font-weight: 500; }
    .toggle-desc  { font-size: 12px; color: #9aa5b4; margin-top: 2px; line-height: 1.4; }

    .select-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      padding: 14px 24px;
    }

    .security-row {
      display: flex; align-items: center; gap: 14px; padding: 14px 24px;
    }

    .security-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      background: rgba(58,159,214,0.10); color: #3A9FD6;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; }
      &.warn  { background: rgba(232,108,58,0.10);  color: #c04a14; }
      &.green { background: rgba(39,196,160,0.12);  color: #1a9678; }
    }

    .enabled-badge {
      display: inline-block; margin-left: 8px;
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: rgba(39,196,160,0.15); color: #1a9678;
    }

    .twofa-setup { padding: 0 24px 16px; }

    .setup-step {
      background: #f8fafc; border-radius: 12px; padding: 20px;
      h3 {
        font-size: 15px; color: #1B2A47; margin: 0 0 8px; font-weight: 600;
        display: flex; align-items: center; gap: 8px;
      }
      p { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; line-height: 1.5; }
    }

    .step-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 50%;
      background: #3A9FD6; color: white; font-size: 12px; font-weight: 700;
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

    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px;
    }

    .info-box {
      display: flex; align-items: flex-start; gap: 10px;
      margin: 8px 24px 14px; padding: 12px 14px;
      background: rgba(39,196,160,0.08); border-radius: 10px;
      mat-icon { color: #27C4A0; flex-shrink: 0; font-size: 18px; margin-top: 1px; }
      p { font-size: 13px; color: #374151; margin: 0; line-height: 1.5; }
    }
  `],
})
export class SettingsComponent implements OnInit {
  settings = signal<Settings>({ ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications } });

  // 2FA state
  twoFactorEnabled    = signal(false);
  twoFactorSetupStep  = signal<'' | 'scan' | 'verify' | 'disable'>('');
  qrCodeDataUrl       = signal('');
  manualSecret        = signal('');
  twoFactorLoading    = signal(false);
  twoFactorError      = signal('');
  otpControl          = new FormControl('', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]);

  notificationItems = [
    { key: 'conflict_analysis', label: 'Conflict analysis completed',    description: 'Notify when a new AI conflict analysis is ready',             icon: 'analytics',   iconClass: 'red' },
    { key: 'escalation_alerts', label: 'Escalation alerts',              description: 'Notify when a conflict is escalated to HR or coach',          icon: 'warning_amber',iconClass: 'orange' },
    { key: 'idp_milestones',    label: 'IDP milestone updates',          description: 'Notify when a development plan milestone status changes',      icon: 'trending_up', iconClass: 'blue' },
    { key: 'new_idp_assigned',  label: 'New IDP assigned to you',        description: 'Notify when a coach creates a development plan for you',      icon: 'assignment_ind',iconClass: 'navy' },
    { key: 'survey_reminders',  label: 'Survey reminders',               description: 'Receive reminders for surveys you have not yet completed',    icon: 'assignment',  iconClass: 'green' },
    { key: 'weekly_digest',     label: 'Weekly digest',                  description: 'Summary of key activity across all modules every Monday',     icon: 'summarize',   iconClass: 'blue' },
  ];

  timezones = [
    { value: 'Europe/Prague',      label: 'Prague (CET/CEST)' },
    { value: 'Europe/London',      label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin',      label: 'Berlin (CET/CEST)' },
    { value: 'America/New_York',   label: 'New York (ET)' },
    { value: 'America/Chicago',    label: 'Chicago (CT)' },
    { value: 'America/Denver',     label: 'Denver (MT)' },
    { value: 'America/Los_Angeles',label: 'Los Angeles (PT)' },
    { value: 'UTC',                label: 'UTC' },
  ];

  constructor(private snackBar: MatSnackBar, private api: ApiService) {}

  ngOnInit(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        this.settings.set({
          ...DEFAULT_SETTINGS,
          ...parsed,
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications ?? {}) },
        });
      } catch { /* use defaults */ }
    }

    // Load current 2FA status
    this.api.get<{ twoFactorEnabled: boolean }>('/users/me').subscribe({
      next: (user) => this.twoFactorEnabled.set(user.twoFactorEnabled ?? false),
      error: () => {},
    });
  }

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
        this.snackBar.open('Two-factor authentication enabled', undefined, { duration: 3000 });
      },
      error: (err) => {
        this.twoFactorError.set(err.error?.error || 'Invalid code. Please try again.');
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
        this.snackBar.open('Two-factor authentication disabled', undefined, { duration: 3000 });
      },
      error: (err) => {
        this.twoFactorError.set(err.error?.error || 'Invalid code. Please try again.');
        this.twoFactorLoading.set(false);
      },
    });
  }

  cancelSetup(): void {
    this.twoFactorSetupStep.set('');
    this.otpControl.reset();
    this.twoFactorError.set('');
  }

  setNotification(key: string, value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, [key]: value },
    }));
    this.persist();
  }

  updateSetting(key: keyof Settings, value: unknown): void {
    this.settings.update((s) => ({ ...s, [key]: value }));
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings()));
    this.snackBar.open('Settings saved', undefined, { duration: 1500 });
  }
}

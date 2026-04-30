import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/api.service';
import { COUNTRIES, CANADIAN_PROVINCES } from '../../../core/geo.constants';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface AppSettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  loginPolicy: {
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    twoFactorEnforced: boolean;
  };
  sessionPolicy: {
    autoLogoutMinutes: number;
    showLogoutWarning: boolean;
    logoutWarningSeconds: number;
    maxConcurrentSessions: number;
  };
  tokenPolicy: {
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
  general: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    defaultTimezone: string;
    dataRetentionDays: number;
    maxFileUploadMB: number;
  };
  companyInfo: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    taxId: string;
    phone: string;
    email: string;
  };
  emailDelivery: {
    senderEmail: string;
    senderName: string;
  };
  updatedAt?: string;
}

const TIMEZONES = [
  'UTC', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Amsterdam',
  'Europe/Prague', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Johannesburg',
];

const TOKEN_EXPIRY_OPTIONS = [
  { value: '5m',  label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h',  label: '1 hour' },
  { value: '2h',  label: '2 hours' },
];

const REFRESH_EXPIRY_OPTIONS = [
  { value: '1d',  label: '1 day' },
  { value: '7d',  label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
];

@Component({
  selector: 'app-app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    TranslateModule,
  ],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <div>
          <h1>{{ "SYSADMIN.appSettingsTitle" | translate }}</h1>
          <p>{{ "SYSADMIN.appSettingsSubtitle" | translate }}</p>
        </div>
        @if (settings()?.updatedAt) {
          <span class="last-saved">Last saved {{ formatDate(settings()!.updatedAt!) }}</span>
        }
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="36" /></div>
      } @else {
        <form [formGroup]="form">

          <!-- ── Password Policy ─────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>lock</mat-icon>
              <div>
                <h3>Password Policy</h3>
                <p>Minimum requirements for user passwords across all organisations</p>
              </div>
            </div>
            <div class="card-body" formGroupName="passwordPolicy">
              <mat-form-field appearance="outline" class="field-sm">
                <mat-label>Minimum Length</mat-label>
                <input matInput type="number" formControlName="minLength" min="6" max="128" />
                <mat-hint>6–128 characters</mat-hint>
              </mat-form-field>

              <div class="toggle-grid">
                <label class="toggle-row">
                  <mat-slide-toggle formControlName="requireUppercase" color="primary" />
                  <div class="toggle-info">
                    <span class="toggle-label">Require uppercase letter</span>
                    <span class="toggle-desc">At least one A–Z character</span>
                  </div>
                </label>
                <label class="toggle-row">
                  <mat-slide-toggle formControlName="requireLowercase" color="primary" />
                  <div class="toggle-info">
                    <span class="toggle-label">Require lowercase letter</span>
                    <span class="toggle-desc">At least one a–z character</span>
                  </div>
                </label>
                <label class="toggle-row">
                  <mat-slide-toggle formControlName="requireNumbers" color="primary" />
                  <div class="toggle-info">
                    <span class="toggle-label">Require number</span>
                    <span class="toggle-desc">At least one 0–9 digit</span>
                  </div>
                </label>
                <label class="toggle-row">
                  <mat-slide-toggle formControlName="requireSpecialChars" color="primary" />
                  <div class="toggle-info">
                    <span class="toggle-label">Require special character</span>
                    <span class="toggle-desc">e.g. !&#64;#$%^&amp;*</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- ── Login Policy ────────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>login</mat-icon>
              <div>
                <h3>Login &amp; Authentication</h3>
                <p>Brute-force protection and two-factor authentication settings</p>
              </div>
            </div>
            <div class="card-body" formGroupName="loginPolicy">
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Max Login Attempts</mat-label>
                  <input matInput type="number" formControlName="maxLoginAttempts" min="0" max="100" />
                  <mat-hint>0 = unlimited</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Lockout Duration (min)</mat-label>
                  <input matInput type="number" formControlName="lockoutDurationMinutes" min="1" max="1440" />
                  <mat-hint>Minutes locked after max attempts</mat-hint>
                </mat-form-field>
              </div>

              <label class="toggle-row">
                <mat-slide-toggle formControlName="twoFactorEnforced" color="primary" />
                <div class="toggle-info">
                  <span class="toggle-label">Enforce two-factor authentication</span>
                  <span class="toggle-desc">All users must enable 2FA — they will be prompted on next login</span>
                </div>
              </label>
            </div>
          </div>

          <!-- ── Session Policy ──────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>timer</mat-icon>
              <div>
                <h3>Session &amp; Timeout</h3>
                <p>Inactivity auto-logout and concurrent session limits</p>
              </div>
            </div>
            <div class="card-body" formGroupName="sessionPolicy">
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Auto-Logout (minutes)</mat-label>
                  <input matInput type="number" formControlName="autoLogoutMinutes" min="0" max="1440" />
                  <mat-hint>0 = disabled</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Warning Before Logout (sec)</mat-label>
                  <input matInput type="number" formControlName="logoutWarningSeconds" min="10" max="600" />
                  <mat-hint>Countdown shown to user</mat-hint>
                </mat-form-field>
              </div>

              <label class="toggle-row">
                <mat-slide-toggle formControlName="showLogoutWarning" color="primary" />
                <div class="toggle-info">
                  <span class="toggle-label">Show logout warning</span>
                  <span class="toggle-desc">Display a countdown dialog before auto-logout</span>
                </div>
              </label>

              <mat-form-field appearance="outline" class="field-sm" style="margin-top: 12px">
                <mat-label>Max Concurrent Sessions</mat-label>
                <input matInput type="number" formControlName="maxConcurrentSessions" min="0" max="50" />
                <mat-hint>0 = unlimited</mat-hint>
              </mat-form-field>
            </div>
          </div>

          <!-- ── Token Policy ────────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>vpn_key</mat-icon>
              <div>
                <h3>Token Lifetimes</h3>
                <p>JWT access and refresh token expiration periods</p>
              </div>
            </div>
            <div class="card-body" formGroupName="tokenPolicy">
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>Access Token Expiry</mat-label>
                  <mat-select formControlName="accessTokenExpiresIn">
                    @for (opt of tokenExpiryOptions; track opt.value) {
                      <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                    }
                  </mat-select>
                  <mat-hint>Short-lived authentication token</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>Refresh Token Expiry</mat-label>
                  <mat-select formControlName="refreshTokenExpiresIn">
                    @for (opt of refreshExpiryOptions; track opt.value) {
                      <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                    }
                  </mat-select>
                  <mat-hint>Long-lived token for silent refresh</mat-hint>
                </mat-form-field>
              </div>
            </div>
          </div>

          <!-- ── Company Info (Invoice Sender) ─────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>business</mat-icon>
              <div>
                <h3>{{ 'SYSADMIN.companyInfoTitle' | translate }}</h3>
                <p>{{ 'SYSADMIN.companyInfoDesc' | translate }}</p>
              </div>
            </div>
            <div class="card-body" formGroupName="companyInfo">
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.companyName' | translate }}</mat-label>
                  <input matInput formControlName="name" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.companyTaxId' | translate }}</mat-label>
                  <input matInput formControlName="taxId" placeholder="GST/HST #" />
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SYSADMIN.addressLine1' | translate }}</mat-label>
                <input matInput formControlName="line1" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ 'SYSADMIN.addressLine2' | translate }}</mat-label>
                <input matInput formControlName="line2" />
              </mat-form-field>
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.city' | translate }}</mat-label>
                  <input matInput formControlName="city" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>{{ 'SYSADMIN.postalCode' | translate }}</mat-label>
                  <input matInput formControlName="postalCode" />
                </mat-form-field>
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.country' | translate }}</mat-label>
                  <mat-select formControlName="country">
                    @for (c of countries; track c.code) {
                      <mat-option [value]="c.code">{{ c.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @if (form.get('companyInfo.country')?.value === 'CA') {
                  <mat-form-field appearance="outline" class="field-md">
                    <mat-label>{{ 'SYSADMIN.stateProvince' | translate }}</mat-label>
                    <mat-select formControlName="state">
                      @for (p of provinces; track p.code) {
                        <mat-option [value]="p.code">{{ p.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                } @else {
                  <mat-form-field appearance="outline" class="field-md">
                    <mat-label>{{ 'SYSADMIN.stateProvince' | translate }}</mat-label>
                    <input matInput formControlName="state" />
                  </mat-form-field>
                }
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.companyPhone' | translate }}</mat-label>
                  <input matInput formControlName="phone" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.companyEmail' | translate }}</mat-label>
                  <input matInput formControlName="email" type="email" />
                </mat-form-field>
              </div>
            </div>
          </div>

          <!-- ── Email Delivery (SES sender) ─────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>mail</mat-icon>
              <div>
                <h3>{{ 'SYSADMIN.emailDeliveryTitle' | translate }}</h3>
                <p>{{ 'SYSADMIN.emailDeliveryDesc' | translate }}</p>
              </div>
            </div>
            <div class="card-body" formGroupName="emailDelivery">
              <div class="field-row">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.senderName' | translate }}</mat-label>
                  <input matInput formControlName="senderName" placeholder="ARTES Hub" />
                  <mat-hint>{{ 'SYSADMIN.senderNameHint' | translate }}</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>{{ 'SYSADMIN.senderEmail' | translate }}</mat-label>
                  <input matInput formControlName="senderEmail" type="email" placeholder="noreply@yourdomain.com" />
                  <mat-hint>{{ 'SYSADMIN.senderEmailHint' | translate }}</mat-hint>
                </mat-form-field>
              </div>
            </div>
          </div>

          <!-- ── General ─────────────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <mat-icon>tune</mat-icon>
              <div>
                <h3>General</h3>
                <p>Platform-wide defaults and maintenance controls</p>
              </div>
            </div>
            <div class="card-body" formGroupName="general">
              <label class="toggle-row maintenance-toggle">
                <mat-slide-toggle formControlName="maintenanceMode" color="warn" />
                <div class="toggle-info">
                  <span class="toggle-label">Maintenance mode</span>
                  <span class="toggle-desc">When enabled, all non-admin users see a maintenance message and cannot access the platform</span>
                </div>
              </label>

              @if (form.get('general.maintenanceMode')?.value) {
                <mat-form-field appearance="outline" class="full-width" style="margin-top: 8px">
                  <mat-label>Maintenance Message</mat-label>
                  <textarea matInput formControlName="maintenanceMessage" rows="2"></textarea>
                </mat-form-field>
              }

              <div class="field-row" style="margin-top: 12px">
                <mat-form-field appearance="outline" class="field-md">
                  <mat-label>Default Timezone</mat-label>
                  <mat-select formControlName="defaultTimezone">
                    @for (tz of timezones; track tz) {
                      <mat-option [value]="tz">{{ tz }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Max Upload Size (MB)</mat-label>
                  <input matInput type="number" formControlName="maxFileUploadMB" min="1" max="100" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="field-sm">
                <mat-label>Data Retention (days)</mat-label>
                <input matInput type="number" formControlName="dataRetentionDays" min="0" max="3650" />
                <mat-hint>0 = keep indefinitely</mat-hint>
              </mat-form-field>
            </div>
          </div>

        </form>

        <!-- Action bar -->
        <div class="action-bar">
          <button mat-stroked-button (click)="resetDefaults()" [disabled]="saving()"
                  [matTooltip]="'SYSADMIN.resetToDefaultsTooltip' | translate">
            <mat-icon>restart_alt</mat-icon> {{ 'SYSADMIN.resetToDefaults' | translate }}
          </button>
          <button mat-raised-button color="primary" (click)="save()" [disabled]="saving() || !form.dirty">
            @if (saving()) { <mat-spinner diameter="18" /> }
            @else { <mat-icon>save</mat-icon> }
            Save Settings
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Full-width layout — fill the panel rather than capping at 1400px. The
     * masonry column flow below balances vertical whitespace so short cards
     * (Token Lifetimes, Email Delivery) sit underneath taller ones rather
     * than getting their own row. */
    .settings-page { padding: 32px 40px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 28px;
      h1 { font-size: 28px; color: var(--artes-primary); margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .last-saved { font-size: 12px; color: #9aa5b4; white-space: nowrap; margin-top: 6px; }

    .loading { display: flex; justify-content: center; padding: 80px; }

    /* Masonry-style flow: cards pack into 2/3/4 columns by viewport width and
     * smaller cards naturally fill underneath taller ones. break-inside keeps
     * a card intact across columns. */
    form {
      column-count: 2;
      column-gap: 20px;
    }
    @media (min-width: 1500px) { form { column-count: 3; } }
    @media (min-width: 2100px) { form { column-count: 4; } }
    @media (max-width: 900px)  { form { column-count: 1; } }

    /* Cards */
    .settings-card {
      background: white; border-radius: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden;
      break-inside: avoid;
      margin-bottom: 20px;
      width: 100%;
    }

    .card-header {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 20px 24px 0;
      mat-icon { font-size: 22px; color: var(--artes-accent); margin-top: 2px; }
      h3 { font-size: 16px; font-weight: 700; color: var(--artes-primary); margin: 0 0 2px; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
    }

    .card-body { padding: 20px 24px 24px; }

    /* Fields */
    .field-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .field-sm  { width: 180px; }
    .field-md  { width: 240px; }
    .full-width { width: 100%; }

    /* Toggle rows */
    .toggle-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }

    .toggle-row {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 14px; border-radius: 10px;
      cursor: pointer; transition: background 0.15s;
      &:hover { background: #f8fafc; }
    }

    .toggle-info {
      display: flex; flex-direction: column; gap: 1px;
    }
    .toggle-label { font-size: 14px; font-weight: 500; color: var(--artes-primary); }
    .toggle-desc  { font-size: 12px; color: #9aa5b4; }

    .maintenance-toggle {
      background: #fff8f0; border: 1px solid #fde0c2; border-radius: 10px;
    }

    /* Action bar */
    .action-bar {
      display: flex; justify-content: flex-end; gap: 12px;
      padding: 16px 0 32px;
    }
  `],
})
export class AppSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snack = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);

  form!: FormGroup;
  loading = signal(true);
  saving = signal(false);
  settings = signal<AppSettings | null>(null);

  timezones = TIMEZONES;
  tokenExpiryOptions = TOKEN_EXPIRY_OPTIONS;
  refreshExpiryOptions = REFRESH_EXPIRY_OPTIONS;

  countries = COUNTRIES;
  provinces = CANADIAN_PROVINCES;

  ngOnInit(): void {
    this.form = this.fb.group({
      passwordPolicy: this.fb.group({
        minLength:           [8],
        requireUppercase:    [true],
        requireLowercase:    [true],
        requireNumbers:      [true],
        requireSpecialChars: [false],
      }),
      loginPolicy: this.fb.group({
        maxLoginAttempts:       [5],
        lockoutDurationMinutes: [15],
        twoFactorEnforced:      [false],
      }),
      sessionPolicy: this.fb.group({
        autoLogoutMinutes:     [30],
        showLogoutWarning:     [true],
        logoutWarningSeconds:  [120],
        maxConcurrentSessions: [0],
      }),
      tokenPolicy: this.fb.group({
        accessTokenExpiresIn:  ['15m'],
        refreshTokenExpiresIn: ['7d'],
      }),
      general: this.fb.group({
        maintenanceMode:    [false],
        maintenanceMessage: [''],
        defaultTimezone:    ['UTC'],
        dataRetentionDays:  [0],
        maxFileUploadMB:    [10],
      }),
      companyInfo: this.fb.group({
        name:       ['ARTES'],
        line1:      [''],
        line2:      [''],
        city:       [''],
        state:      [''],
        postalCode: [''],
        country:    ['CA'],
        taxId:      [''],
        phone:      [''],
        email:      [''],
      }),
      emailDelivery: this.fb.group({
        senderEmail: [''],
        senderName:  ['ARTES Hub'],
      }),
    });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<AppSettings>('/system-admin/settings').subscribe({
      next: (s) => {
        this.settings.set(s);
        this.form.patchValue(s);
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.saving.set(true);
    this.api.put<AppSettings>('/system-admin/settings', this.form.value).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.form.markAsPristine();
        this.saving.set(false);
        this.snack.open('Settings saved', 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to save settings', 'Dismiss', { duration: 5000 });
      },
    });
  }

  resetDefaults(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '460px',
      data: {
        title: this.translate.instant('SYSADMIN.confirmResetDefaultsTitle'),
        message: this.translate.instant('SYSADMIN.confirmResetDefaults'),
        confirmLabel: this.translate.instant('COMMON.reset'),
        confirmColor: 'primary',
      },
    }).afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.saving.set(true);
      this.api.post<AppSettings>('/system-admin/settings/reset', {}).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.form.patchValue(s);
        this.form.markAsPristine();
        this.saving.set(false);
        this.snack.open('Settings reset to defaults', 'OK', { duration: 3000 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to reset settings', 'Dismiss', { duration: 5000 });
      },
    });
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(localStorage.getItem('artes_language') || 'en');
  }
}

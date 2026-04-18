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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

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
    TranslateModule,
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
            <!-- Booking notifications: calendar invites vs email -->
            <div class="group-label">Booking & session notifications</div>
            <div class="group-desc">Choose how you receive booking updates — via calendar invites or email. When calendar invites are on, booking emails are automatically suppressed to avoid duplicates.</div>

            <div class="toggle-row">
              <div class="toggle-icon green">
                <mat-icon>event</mat-icon>
              </div>
              <div class="toggle-info">
                <div class="toggle-label">Calendar invites</div>
                <div class="toggle-desc">Receive calendar invites (Google/Outlook) when sessions are booked, changed, or cancelled</div>
              </div>
              <mat-slide-toggle
                color="primary"
                [checked]="settings().notifications['calendarInvites']"
                (change)="toggleCalendarInvites($event.checked)"
              />
            </div>
            <mat-divider />

            @for (n of bookingNotificationItems; track n.key) {
              <div class="toggle-row" [class.suppressed]="settings().notifications['calendarInvites']">
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
                  [disabled]="settings().notifications['calendarInvites']"
                  (change)="setNotification(n.key, $event.checked)"
                />
              </div>
              <mat-divider />
            }

            <!-- Other notifications -->
            <div class="group-label" style="margin-top: 20px;">Other notifications</div>

            @for (n of otherNotificationItems; track n.key) {
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
              <mat-divider />
            }
            @if (isSystemAdmin()) {
              <div class="test-email-row">
                <div class="toggle-icon blue"><mat-icon>send</mat-icon></div>
                <div class="toggle-info">
                  <div class="toggle-label">Send a test email</div>
                  <div class="toggle-desc">Verify that AWS SES is configured correctly</div>
                </div>
                <div class="test-email-controls">
                  <mat-form-field appearance="outline" class="test-email-field">
                    <mat-label>Recipient</mat-label>
                    <input matInput type="email" [formControl]="testEmailControl" placeholder="you@example.com" />
                    <mat-icon matPrefix>alternate_email</mat-icon>
                  </mat-form-field>
                  <button mat-stroked-button
                          (click)="sendTestEmail()"
                          [disabled]="testEmailLoading() || testEmailControl.invalid">
                    @if (testEmailLoading()) {
                      <mat-spinner diameter="16" />
                    } @else {
                      <mat-icon>send</mat-icon> Send
                    }
                  </button>
                </div>
              </div>
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
                            (ngModelChange)="changeLanguage($event)">
                  <mat-option value="en">English</mat-option>
                  <mat-option value="fr">Fran\u00e7ais</mat-option>
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

      </div>
    </div>
  `,
  styles: [`
    .settings-page { padding: 32px; max-width: 1100px; }

    .page-header {
      margin-bottom: 28px;
      h1 { font-size: 28px; color: var(--artes-primary); margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .settings-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .settings-layout { grid-template-columns: 1fr; } }

    .card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .card-header {
      display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px;
      > mat-icon { color: var(--artes-accent); margin-top: 2px; flex-shrink: 0; }
      h2 { font-size: 16px; color: var(--artes-primary); margin: 0 0 2px; font-weight: 600; }
      p  { font-size: 13px; color: #9aa5b4; margin: 0; }
    }

    .card-body { padding: 8px 0; }

    .group-label {
      font-size: 13px; font-weight: 600; color: var(--artes-primary);
      padding: 16px 24px 0; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .group-desc {
      font-size: 12px; color: #9aa5b4; padding: 2px 24px 8px; line-height: 1.4;
    }
    .toggle-row, .test-email-row {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 24px;
      transition: opacity 0.2s;
      &.suppressed { opacity: 0.45; }
    }

    .test-email-controls {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .test-email-field {
      width: 220px;
      /* pull up the extra bottom margin mat-form-field adds */
      margin-bottom: -1.25em;
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
    .toggle-icon.navy   { background: rgba(27,42,71,0.10);   color: var(--artes-primary); }

    .toggle-info { flex: 1; }
    .toggle-label { font-size: 14px; color: var(--artes-primary); font-weight: 500; }
    .toggle-desc  { font-size: 12px; color: #9aa5b4; margin-top: 2px; line-height: 1.4; }

    .select-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      padding: 14px 24px;
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

  testEmailLoading = signal(false);
  testEmailControl = new FormControl('', [Validators.required, Validators.email]);

  bookingNotificationItems = [
    { key: 'bookingConfirmed',   label: 'Booking confirmed',       description: 'Email when a booking is confirmed',                              icon: 'event_available',iconClass: 'green' },
    { key: 'bookingCancelled',   label: 'Booking cancelled',       description: 'Email when a booking is cancelled',                              icon: 'event_busy',     iconClass: 'red' },
    { key: 'bookingRescheduled', label: 'Booking rescheduled',     description: 'Email when a booking is rescheduled',                            icon: 'event_repeat',   iconClass: 'orange' },
    { key: 'sessionReminders',   label: 'Session reminders',       description: 'Email reminders 24h and 1h before sessions',                    icon: 'alarm',          iconClass: 'blue' },
  ];

  otherNotificationItems = [
    { key: 'sessionScheduled',   label: 'Session scheduled',       description: 'Notify when a coaching session is created or assigned to you',   icon: 'event_note',     iconClass: 'green' },
    { key: 'sessionForms',       label: 'Session forms',           description: 'Notify when pre-session or post-session forms are ready',        icon: 'assignment',     iconClass: 'navy' },
    { key: 'engagementCreated',  label: 'New engagement',          description: 'Notify when a coach starts a coaching engagement with you',      icon: 'handshake',      iconClass: 'blue' },
    { key: 'directMessages',     label: 'Direct messages',         description: 'Notify when someone sends you a message in the hub',             icon: 'mail',           iconClass: 'navy' },
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

  constructor(
    private snackBar: MatSnackBar,
    private api: ApiService,
    private auth: AuthService,
    private translate: TranslateService,
  ) {}

  isCoach(): boolean {
    return this.auth.currentUser()?.role === 'coach';
  }

  isSystemAdmin(): boolean {
    return this.auth.currentUser()?.role === 'system_admin';
  }

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

    // Load notification preferences from API
    this.api.get<Record<string, boolean>>('/users/me/notification-preferences').subscribe({
      next: (prefs) => {
        this.settings.update(s => ({
          ...s,
          notifications: { ...s.notifications, ...prefs },
        }));
      },
      error: () => {},
    });

    // Pre-fill test email address
    this.api.get<{ email: string }>('/users/me').subscribe({
      next: (user) => {
        if (user.email) this.testEmailControl.setValue(user.email);
      },
      error: () => {},
    });
  }

  sendTestEmail(): void {
    if (this.testEmailControl.invalid) return;
    this.testEmailLoading.set(true);
    this.api.post<{ ok: boolean; sentTo: string }>('/users/me/test-email', {
      to: this.testEmailControl.value,
    }).subscribe({
      next: (res) => {
        this.testEmailLoading.set(false);
        this.snackBar.open(`Test email sent to ${res.sentTo}`, undefined, { duration: 4000 });
      },
      error: (err) => {
        this.testEmailLoading.set(false);
        const msg = err.error?.error || 'Failed to send test email';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }

  toggleCalendarInvites(on: boolean): void {
    const updates: Record<string, boolean> = { calendarInvites: on };
    if (on) {
      for (const item of this.bookingNotificationItems) {
        updates[item.key] = false;
      }
    } else {
      for (const item of this.bookingNotificationItems) {
        updates[item.key] = true;
      }
    }
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, ...updates },
    }));
    this.api.put('/users/me/notification-preferences', this.settings().notifications).subscribe({
      next: () => this.snackBar.open('Notification preferences saved', undefined, { duration: 1500 }),
      error: () => this.snackBar.open('Failed to save preferences', 'Dismiss', { duration: 3000 }),
    });
  }

  setNotification(key: string, value: boolean): void {
    this.settings.update((s) => ({
      ...s,
      notifications: { ...s.notifications, [key]: value },
    }));
    this.api.put('/users/me/notification-preferences', this.settings().notifications).subscribe({
      next: () => this.snackBar.open('Notification preference saved', undefined, { duration: 1500 }),
      error: () => this.snackBar.open('Failed to save preference', 'Dismiss', { duration: 3000 }),
    });
  }

  changeLanguage(lang: string): void {
    this.settings.update((s) => ({ ...s, language: lang }));
    this.translate.use(lang);
    localStorage.setItem('artes_language', lang);
    this.api.put('/users/me', { preferredLanguage: lang }).subscribe({
      next: () => this.snackBar.open('Language updated', undefined, { duration: 1500 }),
      error: () => this.snackBar.open('Failed to save language preference', 'Dismiss', { duration: 3000 }),
    });
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

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/api.service';

interface Organization {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  modules: string[];
  billingEmail: string;
  employeeCount?: number;
  industry?: string;
  createdAt: string;
}

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance & Banking', 'Education', 'Manufacturing',
  'Retail', 'Professional Services', 'Non-profit', 'Government', 'Other',
];

const ALL_MODULES = [
  { key: 'conflict',       label: 'Conflict Intelligence™',    icon: 'warning_amber', color: '#c04a14' },
  { key: 'neuroinclusion', label: 'Neuro-Inclusion Compass™',  icon: 'psychology',    color: '#1a9678' },
  { key: 'succession',     label: 'Leadership & Succession Hub™', icon: 'trending_up', color: '#2080b0' },
];

const PLAN_META: Record<string, { label: string; color: string }> = {
  starter:      { label: 'Starter',      color: '#5a6a7e' },
  professional: { label: 'Professional', color: '#2080b0' },
  enterprise:   { label: 'Enterprise',   color: '#b07800' },
};

@Component({
  selector: 'app-organization-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
  ],
  template: `
    <div class="org-page">
      <div class="page-header">
        <div>
          <h1>Organization Settings</h1>
          <p>Manage your organization profile and enabled modules</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else if (org()) {
        <div class="settings-layout">

          <!-- Profile card -->
          <div class="card">
            <div class="card-header">
              <mat-icon>business</mat-icon>
              <h2>Organization Profile</h2>
            </div>
            <mat-divider />

            <form [formGroup]="form" class="card-body">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Organization Name</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>

              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Industry</mat-label>
                  <mat-select formControlName="industry">
                    @for (ind of industries; track ind) {
                      <mat-option [value]="ind">{{ ind }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Employee Count</mat-label>
                  <input matInput formControlName="employeeCount" type="number" min="1" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Billing Email</mat-label>
                <input matInput formControlName="billingEmail" type="email" />
              </mat-form-field>

              <!-- Read-only fields -->
              <div class="readonly-row">
                <div class="readonly-field">
                  <span class="readonly-label">Slug</span>
                  <span class="readonly-value mono">{{ org()!.slug }}</span>
                </div>
                <div class="readonly-field">
                  <span class="readonly-label">Plan</span>
                  <span class="plan-badge" [style.background]="planMeta(org()!.plan).color + '22'"
                        [style.color]="planMeta(org()!.plan).color">
                    {{ planMeta(org()!.plan).label }}
                  </span>
                </div>
                <div class="readonly-field">
                  <span class="readonly-label">Member Since</span>
                  <span class="readonly-value">{{ org()!.createdAt | date:'MMM d, y' }}</span>
                </div>
              </div>

              <div class="form-actions">
                <button mat-raised-button color="primary"
                        (click)="saveProfile()" [disabled]="form.invalid || savingProfile()">
                  @if (savingProfile()) { <mat-spinner diameter="18" /> }
                  @else { <mat-icon>save</mat-icon> Save Changes }
                </button>
              </div>
            </form>
          </div>

          <!-- Modules card -->
          <div class="card">
            <div class="card-header">
              <mat-icon>extension</mat-icon>
              <h2>Enabled Modules</h2>
            </div>
            <mat-divider />
            <div class="card-body">
              <p class="modules-hint">Toggle which modules are active for your organization.</p>
              <div class="modules-list">
                @for (mod of allModules; track mod.key) {
                  <div class="module-row" [class.enabled]="isModuleEnabled(mod.key)">
                    <div class="module-icon" [style.background]="mod.color + '18'"
                                             [style.color]="mod.color">
                      <mat-icon>{{ mod.icon }}</mat-icon>
                    </div>
                    <div class="module-info">
                      <span class="module-name">{{ mod.label }}</span>
                      <span class="module-status">{{ isModuleEnabled(mod.key) ? 'Active' : 'Inactive' }}</span>
                    </div>
                    <button mat-stroked-button
                            [color]="isModuleEnabled(mod.key) ? 'warn' : 'primary'"
                            (click)="toggleModule(mod.key)"
                            [disabled]="savingModules()">
                      {{ isModuleEnabled(mod.key) ? 'Disable' : 'Enable' }}
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

        </div>
      }
    </div>
  `,
  styles: [`
    .org-page { padding: 32px; max-width: 900px; }

    .page-header {
      margin-bottom: 28px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .loading-center { display: flex; justify-content: center; padding: 64px; }

    .settings-layout { display: flex; flex-direction: column; gap: 20px; }

    .card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .card-header {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 24px;
      mat-icon { color: #3A9FD6; }
      h2 { font-size: 16px; color: #1B2A47; margin: 0; font-weight: 600; }
    }

    .card-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }

    .full-width { width: 100%; }

    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .readonly-row {
      display: flex; gap: 32px; flex-wrap: wrap;
      padding: 12px 0; border-top: 1px solid #f0f4f8; margin-top: 4px;
    }

    .readonly-field {
      display: flex; flex-direction: column; gap: 4px;
      .readonly-label { font-size: 11px; color: #9aa5b4; text-transform: uppercase; letter-spacing: 0.5px; }
      .readonly-value { font-size: 14px; color: #1B2A47; }
      .mono { font-family: monospace; font-size: 13px; }
    }

    .plan-badge {
      display: inline-block; padding: 2px 10px; border-radius: 999px;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
    }

    .form-actions { display: flex; justify-content: flex-end; padding-top: 8px; }

    .modules-hint { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }

    .modules-list { display: flex; flex-direction: column; gap: 12px; }

    .module-row {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 16px; border-radius: 12px;
      background: #f8fafc; border: 1px solid #e8edf4;
      transition: all 0.15s;
      &.enabled { border-color: #d1e9f5; background: #f0f9ff; }
    }

    .module-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; }
    }

    .module-info {
      flex: 1; display: flex; flex-direction: column; gap: 2px;
      .module-name   { font-size: 14px; font-weight: 500; color: #1B2A47; }
      .module-status { font-size: 12px; color: #9aa5b4; }
    }
  `],
})
export class OrganizationSettingsComponent implements OnInit {
  org = signal<Organization | null>(null);
  loading = signal(true);
  savingProfile = signal(false);
  savingModules = signal(false);

  form!: FormGroup;
  industries = INDUSTRIES;
  allModules = ALL_MODULES;

  planMeta = (plan: string) => PLAN_META[plan] ?? { label: plan, color: '#5a6a7e' };
  isModuleEnabled = (key: string) => this.org()?.modules.includes(key) ?? false;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.get<Organization>('/organizations/me').subscribe({
      next: (org) => {
        this.org.set(org);
        this.form = this.fb.group({
          name:          [org.name,          Validators.required],
          billingEmail:  [org.billingEmail,   [Validators.required, Validators.email]],
          industry:      [org.industry  ?? ''],
          employeeCount: [org.employeeCount ?? ''],
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  saveProfile(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.savingProfile.set(true);
    this.api.put<Organization>('/organizations/me', this.form.value).subscribe({
      next: (updated) => {
        this.org.set(updated);
        this.savingProfile.set(false);
        this.snackBar.open('Organization profile saved', 'Close', { duration: 2500 });
      },
      error: () => {
        this.savingProfile.set(false);
        this.snackBar.open('Save failed', 'Close', { duration: 2500 });
      },
    });
  }

  toggleModule(key: string): void {
    const current = this.org()!.modules;
    const updated = current.includes(key)
      ? current.filter((m) => m !== key)
      : [...current, key];

    this.savingModules.set(true);
    this.api.put<Organization>('/organizations/me', { modules: updated }).subscribe({
      next: (org) => {
        this.org.set(org);
        this.savingModules.set(false);
        this.snackBar.open(
          `${ALL_MODULES.find((m) => m.key === key)?.label} ${updated.includes(key) ? 'enabled' : 'disabled'}`,
          'Close', { duration: 2500 }
        );
      },
      error: () => {
        this.savingModules.set(false);
        this.snackBar.open('Update failed', 'Close', { duration: 2500 });
      },
    });
  }
}

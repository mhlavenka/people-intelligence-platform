import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
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

interface OrgTheme {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: 'sharp' | 'rounded' | 'pill';
}

interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface Organization {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  modules: string[];
  departments: string[];
  billingEmail: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  employeeCount?: number;
  industry?: string;
  theme?: OrgTheme;
  logoUrl?: string;
  createdAt: string;
}

const DEFAULT_THEME: OrgTheme = {
  primaryColor: '#1B2A47',
  accentColor: '#3A9FD6',
  backgroundColor: '#EBF5FB',
  surfaceColor: '#ffffff',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  borderRadius: 'rounded',
};

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance & Banking', 'Education', 'Manufacturing',
  'Retail', 'Professional Services', 'Non-profit', 'Government', 'Other',
];

const ALL_MODULES = [
  { key: 'conflict',       label: 'Conflict Intelligence™',       icon: 'warning_amber', color: '#c04a14' },
  { key: 'neuroinclusion', label: 'Neuro-Inclusion Compass™',     icon: 'psychology',    color: '#1a9678' },
  { key: 'succession',     label: 'Leadership & Succession Hub™', icon: 'trending_up',   color: '#2080b0' },
];

const PLAN_META: Record<string, { label: string; color: string }> = {
  starter:      { label: 'Starter',      color: '#5a6a7e' },
  professional: { label: 'Professional', color: '#2080b0' },
  enterprise:   { label: 'Enterprise',   color: '#b07800' },
};

interface ThemePreset { name: string; source: string; theme: OrgTheme; }

const PRESETS: ThemePreset[] = [
  {
    name: 'Helena Coaching',
    source: 'helenacoaching.com',
    theme: {
      primaryColor: '#25366a',
      accentColor: '#f3bf3b',
      backgroundColor: '#f7f0e8',
      surfaceColor: '#ffffff',
      headingFont: 'Merriweather',
      bodyFont: 'Open Sans',
      borderRadius: 'rounded',
    },
  },
  {
    name: 'HeadSoft Blue',
    source: 'Platform default',
    theme: { ...DEFAULT_THEME },
  },
  {
    name: 'Forest',
    source: '',
    theme: {
      primaryColor: '#1a4731',
      accentColor: '#27C4A0',
      backgroundColor: '#f0faf6',
      surfaceColor: '#ffffff',
      headingFont: 'Poppins',
      bodyFont: 'Nunito',
      borderRadius: 'rounded',
    },
  },
  {
    name: 'Midnight',
    source: '',
    theme: {
      primaryColor: '#1e2235',
      accentColor: '#7c6ef7',
      backgroundColor: '#f4f3ff',
      surfaceColor: '#ffffff',
      headingFont: 'Montserrat',
      bodyFont: 'Inter',
      borderRadius: 'pill',
    },
  },
  {
    name: 'Slate',
    source: '',
    theme: {
      primaryColor: '#2d3748',
      accentColor: '#4a90d9',
      backgroundColor: '#f7f8fa',
      surfaceColor: '#ffffff',
      headingFont: 'Raleway',
      bodyFont: 'Lato',
      borderRadius: 'sharp',
    },
  },
];

const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Raleway', 'Lato',
  'Open Sans', 'Nunito', 'Roboto', 'Merriweather', 'Playfair Display',
];

const COLOR_FIELDS = [
  { key: 'primaryColor',    label: 'Primary',    desc: 'Navigation, headings, primary buttons' },
  { key: 'accentColor',     label: 'Accent',     desc: 'Highlights, links, active states'      },
  { key: 'backgroundColor', label: 'Background', desc: 'Page background'                       },
  { key: 'surfaceColor',    label: 'Surface',    desc: 'Cards and panels'                      },
];

const RADIUS_OPTIONS = [
  { value: 'sharp',   label: 'Sharp',   demo: '2px'  },
  { value: 'rounded', label: 'Rounded', demo: '12px' },
  { value: 'pill',    label: 'Pill',    demo: '999px' },
];

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
          <p>Manage your organization profile, modules, and visual brand</p>
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

            <!-- Logo upload -->
            <div class="logo-section">
              <div class="logo-preview-wrap">
                @if (logoPreview()) {
                  <img [src]="logoPreview()" alt="Organization logo" class="logo-img" />
                } @else {
                  <div class="logo-initials">{{ orgInitials() }}</div>
                }
              </div>
              <div class="logo-actions">
                <span class="logo-label">Organization Logo</span>
                <span class="logo-hint">PNG, JPG or SVG · max 2 MB · displayed in the platform header</span>
                <div class="logo-btns">
                  <label class="logo-upload-btn" [class.saving]="savingLogo()">
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                           (change)="onLogoSelect($event)" style="display:none" />
                    <mat-icon>upload</mat-icon>
                    {{ savingLogo() ? 'Saving…' : 'Upload Logo' }}
                  </label>
                  @if (logoPreview()) {
                    <button type="button" class="logo-remove-btn" (click)="removeLogo()"
                            [disabled]="savingLogo()">
                      <mat-icon>delete_outline</mat-icon> Remove
                    </button>
                  }
                </div>
              </div>
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

          <!-- Billing Details card -->
          <div class="card">
            <div class="card-header">
              <mat-icon>receipt_long</mat-icon>
              <h2>Billing Details</h2>
            </div>
            <mat-divider />
            <form [formGroup]="billingForm" class="card-body">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Address Line 1</mat-label>
                <input matInput formControlName="billingLine1" placeholder="Street address" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Address Line 2</mat-label>
                <input matInput formControlName="billingLine2" placeholder="Suite, floor, etc. (optional)" />
              </mat-form-field>
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>City</mat-label>
                  <input matInput formControlName="billingCity" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>State / Region</mat-label>
                  <input matInput formControlName="billingState" />
                </mat-form-field>
              </div>
              <div class="field-row">
                <mat-form-field appearance="outline">
                  <mat-label>Postal Code</mat-label>
                  <input matInput formControlName="billingPostalCode" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Country</mat-label>
                  <mat-select formControlName="billingCountry">
                    @for (c of countries; track c.code) {
                      <mat-option [value]="c.code">{{ c.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Tax ID (VAT / EIN)</mat-label>
                <input matInput formControlName="taxId" placeholder="e.g. DE123456789" />
                <mat-hint>Used on invoices for tax compliance</mat-hint>
              </mat-form-field>
              <div class="form-actions">
                <button mat-raised-button color="primary"
                        (click)="saveBilling()" [disabled]="savingBilling()">
                  @if (savingBilling()) { <mat-spinner diameter="18" /> }
                  @else { <mat-icon>save</mat-icon> Save Billing Details }
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

          <!-- Brand & Theme card -->
          <div class="card">
            <div class="card-header">
              <mat-icon>palette</mat-icon>
              <h2>Brand &amp; Theme</h2>
            </div>
            <mat-divider />
            <div class="card-body">

              <!-- Presets -->
              <div class="section-label">Quick Presets</div>
              <div class="presets-grid">
                @for (preset of presets; track preset.name) {
                  <button type="button" class="preset-btn"
                          [class.active]="isPresetActive(preset)"
                          (click)="applyPreset(preset)">
                    <div class="preset-swatches">
                      <div class="swatch" [style.background]="preset.theme.primaryColor"></div>
                      <div class="swatch" [style.background]="preset.theme.accentColor"></div>
                      <div class="swatch" [style.background]="preset.theme.backgroundColor"></div>
                    </div>
                    <div class="preset-name">{{ preset.name }}</div>
                    @if (preset.source) {
                      <div class="preset-source">{{ preset.source }}</div>
                    }
                  </button>
                }
              </div>

              <mat-divider />

              <!-- Colors -->
              <div class="section-label" style="margin-top:4px">Colors</div>
              <form [formGroup]="themeForm" class="colors-grid">
                @for (field of colorFields; track field.key) {
                  <div class="color-row">
                    <label class="color-swatch-wrap">
                      <input type="color" class="color-native"
                             [value]="themeForm.get(field.key)!.value"
                             (input)="themeForm.get(field.key)!.setValue($any($event.target).value)" />
                      <div class="color-swatch"
                           [style.background]="themeForm.get(field.key)!.value"></div>
                    </label>
                    <div class="color-meta">
                      <span class="color-label">{{ field.label }}</span>
                      <span class="color-desc">{{ field.desc }}</span>
                    </div>
                    <input class="hex-input" [formControlName]="field.key"
                           maxlength="7" spellcheck="false" />
                  </div>
                }
              </form>

              <mat-divider />

              <!-- Typography -->
              <div class="section-label" style="margin-top:4px">Typography</div>
              <form [formGroup]="themeForm" class="font-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Heading Font</mat-label>
                  <mat-select formControlName="headingFont">
                    @for (f of fonts; track f) {
                      <mat-option [value]="f">
                        <span [style.fontFamily]="f + ', sans-serif'">{{ f }}</span>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Body Font</mat-label>
                  <mat-select formControlName="bodyFont">
                    @for (f of fonts; track f) {
                      <mat-option [value]="f">
                        <span [style.fontFamily]="f + ', sans-serif'">{{ f }}</span>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </form>

              <!-- Corner radius -->
              <div class="section-label">Corner Style</div>
              <div class="radius-group">
                @for (r of radiusOptions; track r.value) {
                  <button type="button" class="radius-btn"
                          [class.active]="themeForm.get('borderRadius')!.value === r.value"
                          (click)="themeForm.get('borderRadius')!.setValue(r.value)">
                    <div class="radius-demo" [style.borderRadius]="r.demo"></div>
                    <span>{{ r.label }}</span>
                  </button>
                }
              </div>

              <mat-divider />

              <!-- Live preview -->
              <div class="section-label" style="margin-top:4px">Preview</div>
              <div class="theme-preview"
                   [style.background]="themeForm.get('backgroundColor')!.value"
                   [style.fontFamily]="themeForm.get('bodyFont')!.value + ', sans-serif'">

                <div class="preview-nav"
                     [style.background]="themeForm.get('primaryColor')!.value">
                  <span class="preview-nav-brand"
                        [style.fontFamily]="themeForm.get('headingFont')!.value + ', sans-serif'">
                    {{ org()!.name }}
                  </span>
                  <div class="preview-nav-links">
                    <span>Dashboard</span>
                    <span class="active"
                          [style.color]="themeForm.get('accentColor')!.value">Reports</span>
                    <span>Settings</span>
                  </div>
                </div>

                <div class="preview-body">
                  <div class="preview-card"
                       [style.background]="themeForm.get('surfaceColor')!.value"
                       [style.borderRadius]="previewRadius()">
                    <div class="preview-card-label"
                         [style.color]="themeForm.get('accentColor')!.value">
                      Conflict Intelligence™
                    </div>
                    <div class="preview-card-title"
                         [style.fontFamily]="themeForm.get('headingFont')!.value + ', sans-serif'"
                         [style.color]="themeForm.get('primaryColor')!.value">
                      Team Wellbeing Report
                    </div>
                    <p class="preview-card-body">
                      AI-powered insights based on 42 survey responses from your team members.
                    </p>
                    <div class="preview-actions">
                      <div class="preview-btn"
                           [style.background]="themeForm.get('primaryColor')!.value"
                           [style.borderRadius]="previewBtnRadius()">
                        View Report
                      </div>
                      <div class="preview-chip"
                           [style.color]="themeForm.get('accentColor')!.value"
                           [style.borderColor]="themeForm.get('accentColor')!.value"
                           [style.borderRadius]="previewBtnRadius()">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-actions">
                <button mat-raised-button color="primary"
                        (click)="saveTheme()" [disabled]="savingTheme()">
                  @if (savingTheme()) { <mat-spinner diameter="18" /> }
                  @else { <mat-icon>save</mat-icon> Save Theme }
                </button>
              </div>

            </div>
          </div>

          <!-- ── Departments ──────────────────────────────────────────────── -->
          <div class="settings-card">
            <div class="card-header">
              <div class="card-icon" style="background:rgba(39,196,160,0.12);color:#1a9678">
                <mat-icon>corporate_fare</mat-icon>
              </div>
              <div>
                <h2>Departments</h2>
                <p>Define the departments in your organization. Used in Conflict Intelligence analysis and the Org Chart.</p>
              </div>
            </div>
            <mat-divider />

            <div class="dept-section">
              <!-- existing department chips -->
              <div class="dept-chips">
                @for (dept of departments(); track dept) {
                  <div class="dept-chip">
                    <span>{{ dept }}</span>
                    <button class="dept-remove" (click)="removeDepartment(dept)"
                            [disabled]="savingDepts()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
                @if (departments().length === 0) {
                  <span class="dept-empty">No departments defined yet.</span>
                }
              </div>

              <!-- add new department -->
              <div class="dept-add-row">
                <mat-form-field appearance="outline" class="dept-input">
                  <mat-label>New department name</mat-label>
                  <input matInput #deptInput
                         [disabled]="savingDepts()"
                         (keydown.enter)="addDepartmentFromInput(deptInput); $event.preventDefault()"
                         placeholder="e.g. Engineering" />
                </mat-form-field>
                <button mat-stroked-button
                        [disabled]="savingDepts()"
                        (click)="addDepartmentFromInput(deptInput)">
                  @if (savingDepts()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon>add</mat-icon> Add }
                </button>
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
      display: flex; align-items: center; gap: 10px; padding: 20px 24px;
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

    /* ── Logo upload ── */
    .logo-section {
      display: flex; align-items: center; gap: 20px; padding: 20px 24px;
    }

    .logo-preview-wrap {
      width: 80px; height: 80px; border-radius: 14px; flex-shrink: 0;
      border: 2px dashed #dce6f0; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      background: #f8fafc;
    }

    .logo-img {
      width: 100%; height: 100%; object-fit: contain;
    }

    .logo-initials {
      font-size: 24px; font-weight: 800; color: #3A9FD6; letter-spacing: -1px;
    }

    .logo-actions {
      display: flex; flex-direction: column; gap: 4px;
    }

    .logo-label {
      font-size: 14px; font-weight: 600; color: #1B2A47;
    }

    .logo-hint {
      font-size: 12px; color: #9aa5b4;
    }

    .logo-btns {
      display: flex; gap: 8px; margin-top: 6px; align-items: center;
    }

    .logo-upload-btn {
      display: inline-flex; align-items: center; gap: 5px; cursor: pointer;
      padding: 6px 14px; border-radius: 8px;
      background: #1B2A47; color: white;
      font-size: 13px; font-weight: 500; border: none;
      transition: background 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #253659; }
      &.saving { opacity: 0.6; pointer-events: none; }
    }

    .logo-remove-btn {
      display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
      padding: 6px 12px; border-radius: 8px;
      background: none; color: #e53e3e;
      font-size: 13px; border: 1px solid #fca5a5;
      transition: background 0.15s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #fef2f2; }
      &:disabled { opacity: 0.5; cursor: default; }
    }

    .form-actions { display: flex; justify-content: flex-end; padding-top: 8px; }

    .modules-hint { font-size: 13px; color: #5a6a7e; margin: 0 0 16px; }
    .modules-list { display: flex; flex-direction: column; gap: 12px; }

    .module-row {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 16px; border-radius: 12px;
      background: #f8fafc; border: 1px solid #e8edf4; transition: all 0.15s;
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

    /* ── Theme card ──────────────────────────────────────────── */

    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #9aa5b4; margin-bottom: 12px;
    }

    /* Presets */
    .presets-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
      margin-bottom: 20px;
    }

    .preset-btn {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 12px 8px; border-radius: 12px; border: 2px solid #e8edf4;
      background: #f8fafc; cursor: pointer; transition: all 0.15s;
      &:hover { border-color: #b0cfe8; background: white; }
      &.active { border-color: #3A9FD6; background: #f0f9ff; }
    }

    .preset-swatches {
      display: flex; gap: 4px;
      .swatch { width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.08); }
    }

    .preset-name  { font-size: 11px; font-weight: 600; color: #1B2A47; text-align: center; }
    .preset-source { font-size: 10px; color: #9aa5b4; text-align: center; }

    /* Colors */
    .colors-grid {
      display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px;
    }

    .color-row {
      display: flex; align-items: center; gap: 14px;
      padding: 10px 14px; border-radius: 10px; background: #f8fafc;
      border: 1px solid #edf2f7;
    }

    .color-swatch-wrap {
      position: relative; cursor: pointer; flex-shrink: 0;
    }

    .color-native {
      position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none;
    }

    /* Open the native color picker when the label is clicked */
    .color-swatch-wrap:focus-within .color-native,
    .color-swatch-wrap:active .color-native { pointer-events: auto; }

    .color-swatch {
      width: 40px; height: 40px; border-radius: 10px;
      border: 2px solid rgba(0,0,0,0.1); cursor: pointer;
      transition: transform 0.1s;
      &:hover { transform: scale(1.08); }
    }

    /* Make the whole label area clickable by routing to real input */
    .color-swatch-wrap input[type="color"] {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer; padding: 0; border: none;
    }

    .color-meta { flex: 1; }
    .color-label { display: block; font-size: 13px; font-weight: 500; color: #1B2A47; }
    .color-desc  { display: block; font-size: 11px; color: #9aa5b4; margin-top: 1px; }

    .hex-input {
      width: 86px; font-family: monospace; font-size: 13px; font-weight: 500;
      color: #1B2A47; background: white; border: 1px solid #d8e3ed;
      border-radius: 6px; padding: 6px 10px; outline: none;
      &:focus { border-color: #3A9FD6; box-shadow: 0 0 0 2px rgba(58,159,214,0.15); }
    }

    /* Typography */
    .font-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 4px;
    }

    /* Corner radius */
    .radius-group {
      display: flex; gap: 10px; margin-bottom: 20px;
    }

    .radius-btn {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 12px 20px; border-radius: 10px; border: 2px solid #e8edf4;
      background: #f8fafc; cursor: pointer; transition: all 0.15s; flex: 1;
      &:hover { border-color: #b0cfe8; }
      &.active { border-color: #3A9FD6; background: #f0f9ff; }
      span { font-size: 12px; color: #5a6a7e; }
    }

    .radius-demo {
      width: 40px; height: 28px; background: #1B2A47;
      border: none;
    }

    /* Preview */
    .theme-preview {
      border-radius: 12px; overflow: hidden;
      border: 1px solid #e8edf4; margin-bottom: 16px;
    }

    .preview-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 20px;
    }

    .preview-nav-brand {
      font-size: 14px; font-weight: 700; color: white;
      letter-spacing: 0.3px;
    }

    .preview-nav-links {
      display: flex; gap: 20px;
      span { font-size: 12px; color: rgba(255,255,255,0.7); }
      .active { color: white; font-weight: 600; }
    }

    .preview-body { padding: 20px; }

    .preview-card {
      padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.07);
    }

    .preview-card-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; margin-bottom: 6px;
    }

    .preview-card-title {
      font-size: 18px; font-weight: 700; margin-bottom: 8px; line-height: 1.3;
    }

    .preview-card-body {
      font-size: 13px; color: #5a6a7e; margin: 0 0 16px; line-height: 1.5;
    }

    .preview-actions { display: flex; align-items: center; gap: 10px; }

    .preview-btn {
      display: inline-block; padding: 8px 18px;
      font-size: 12px; font-weight: 600; color: white; cursor: default;
    }

    .preview-chip {
      display: inline-block; padding: 5px 14px;
      font-size: 11px; font-weight: 600; border: 1.5px solid; cursor: default;
    }

    /* ── Departments ── */
    .dept-section { padding: 16px 0 4px; }

    .dept-chips {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; min-height: 32px;
    }

    .dept-chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(39,196,160,0.1); border: 1px solid rgba(39,196,160,0.3);
      border-radius: 20px; padding: 4px 8px 4px 12px;
      font-size: 13px; color: #1a9678; font-weight: 500;

      .dept-remove {
        display: flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 50%;
        background: none; border: none; cursor: pointer; color: #9aa5b4; padding: 0;
        &:hover { background: rgba(229,62,62,0.12); color: #e53e3e; }
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
    }

    .dept-empty { font-size: 13px; color: #9aa5b4; font-style: italic; }

    .dept-add-row {
      display: flex; align-items: flex-start; gap: 10px;
      .dept-input { flex: 1; max-width: 320px; }
    }
  `],
})
export class OrganizationSettingsComponent implements OnInit {
  org           = signal<Organization | null>(null);
  departments   = signal<string[]>([]);
  savingDepts   = signal(false);
  loading       = signal(true);
  savingProfile = signal(false);
  savingModules = signal(false);
  savingTheme   = signal(false);
  savingBilling = signal(false);
  savingLogo    = signal(false);
  logoPreview   = signal<string | null>(null);

  form!: FormGroup;
  themeForm!: FormGroup;
  billingForm!: FormGroup;

  industries    = INDUSTRIES;
  allModules    = ALL_MODULES;
  presets       = PRESETS;
  fonts         = FONTS;
  colorFields   = COLOR_FIELDS;
  radiusOptions = RADIUS_OPTIONS;

  countries = [
    { code: 'AT', name: 'Austria' },        { code: 'AU', name: 'Australia' },
    { code: 'BE', name: 'Belgium' },        { code: 'CA', name: 'Canada' },
    { code: 'CH', name: 'Switzerland' },    { code: 'CZ', name: 'Czechia' },
    { code: 'DE', name: 'Germany' },        { code: 'DK', name: 'Denmark' },
    { code: 'ES', name: 'Spain' },          { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },         { code: 'GB', name: 'United Kingdom' },
    { code: 'HR', name: 'Croatia' },        { code: 'HU', name: 'Hungary' },
    { code: 'IE', name: 'Ireland' },        { code: 'IT', name: 'Italy' },
    { code: 'NL', name: 'Netherlands' },    { code: 'NO', name: 'Norway' },
    { code: 'PL', name: 'Poland' },         { code: 'PT', name: 'Portugal' },
    { code: 'RO', name: 'Romania' },        { code: 'SE', name: 'Sweden' },
    { code: 'SI', name: 'Slovenia' },       { code: 'SK', name: 'Slovakia' },
    { code: 'US', name: 'United States' },
  ];

  orgInitials = () => {
    const name = this.org()?.name ?? '';
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  };

  planMeta       = (plan: string) => PLAN_META[plan] ?? { label: plan, color: '#5a6a7e' };
  isModuleEnabled = (key: string) => this.org()?.modules.includes(key) ?? false;

  previewRadius    = () => ({ sharp: '4px',   rounded: '14px', pill: '20px'  }[this.themeForm?.get('borderRadius')?.value as string] ?? '14px');
  previewBtnRadius = () => ({ sharp: '3px',   rounded: '8px',  pill: '999px' }[this.themeForm?.get('borderRadius')?.value as string] ?? '8px');

  isPresetActive(preset: ThemePreset): boolean {
    const t = this.themeForm?.value as OrgTheme;
    if (!t) return false;
    return t.primaryColor    === preset.theme.primaryColor &&
           t.accentColor     === preset.theme.accentColor  &&
           t.backgroundColor === preset.theme.backgroundColor;
  }

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.api.get<Organization>('/organizations/me').subscribe({
      next: (org) => {
        this.org.set(org);
        this.departments.set(org.departments ?? []);
        this.logoPreview.set(org.logoUrl ?? null);
        this.form = this.fb.group({
          name:          [org.name,          Validators.required],
          billingEmail:  [org.billingEmail,   [Validators.required, Validators.email]],
          industry:      [org.industry  ?? ''],
          employeeCount: [org.employeeCount ?? ''],
        });
        const addr = org.billingAddress ?? {};
        this.billingForm = this.fb.group({
          billingLine1:      [addr.line1      ?? ''],
          billingLine2:      [addr.line2      ?? ''],
          billingCity:       [addr.city       ?? ''],
          billingState:      [addr.state      ?? ''],
          billingPostalCode: [addr.postalCode ?? ''],
          billingCountry:    [addr.country    ?? ''],
          taxId:             [org.taxId       ?? ''],
        });
        const t = { ...DEFAULT_THEME, ...(org.theme ?? {}) };
        this.themeForm = this.fb.group({
          primaryColor:    [t.primaryColor],
          accentColor:     [t.accentColor],
          backgroundColor: [t.backgroundColor],
          surfaceColor:    [t.surfaceColor],
          headingFont:     [t.headingFont],
          bodyFont:        [t.bodyFont],
          borderRadius:    [t.borderRadius],
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyPreset(preset: ThemePreset): void {
    this.themeForm.patchValue(preset.theme);
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

  saveBilling(): void {
    this.savingBilling.set(true);
    const v = this.billingForm.value;
    const payload = {
      taxId: v['taxId'] || undefined,
      billingAddress: {
        line1:      v['billingLine1']      || undefined,
        line2:      v['billingLine2']      || undefined,
        city:       v['billingCity']       || undefined,
        state:      v['billingState']      || undefined,
        postalCode: v['billingPostalCode'] || undefined,
        country:    v['billingCountry']    || undefined,
      },
    };
    this.api.put<Organization>('/organizations/me', payload).subscribe({
      next: (updated) => {
        this.org.set(updated);
        this.savingBilling.set(false);
        this.snackBar.open('Billing details saved', 'Close', { duration: 2500 });
      },
      error: () => {
        this.savingBilling.set(false);
        this.snackBar.open('Save failed', 'Close', { duration: 2500 });
      },
    });
  }

  saveTheme(): void {
    this.savingTheme.set(true);
    this.api.put<Organization>('/organizations/me', { theme: this.themeForm.value }).subscribe({
      next: (updated) => {
        this.org.set(updated);
        this.savingTheme.set(false);
        this.snackBar.open('Theme saved', 'Close', { duration: 2500 });
      },
      error: () => {
        this.savingTheme.set(false);
        this.snackBar.open('Save failed', 'Close', { duration: 2500 });
      },
    });
  }

  onLogoSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.snackBar.open('Logo file must be under 2 MB', 'Close', { duration: 3000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.logoPreview.set(dataUrl);
      this.savingLogo.set(true);
      this.api.put<Organization>('/organizations/me', { logoUrl: dataUrl }).subscribe({
        next: (updated) => { this.org.set(updated); this.savingLogo.set(false); this.snackBar.open('Logo saved', 'Close', { duration: 2000 }); },
        error: () => { this.savingLogo.set(false); this.snackBar.open('Logo save failed', 'Close', { duration: 2500 }); },
      });
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.savingLogo.set(true);
    this.api.put<Organization>('/organizations/me', { logoUrl: null }).subscribe({
      next: (updated) => { this.org.set(updated); this.logoPreview.set(null); this.savingLogo.set(false); this.snackBar.open('Logo removed', 'Close', { duration: 2000 }); },
      error: () => { this.savingLogo.set(false); this.snackBar.open('Remove failed', 'Close', { duration: 2500 }); },
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

  addDepartmentFromInput(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (!value) return;
    const current = this.departments();
    if (current.some((d) => d.toLowerCase() === value.toLowerCase())) {
      this.snackBar.open('Department already exists', 'Close', { duration: 2000 });
      return;
    }
    const updated = [...current, value];
    input.value = '';
    this.saveDepartments(updated);
  }

  removeDepartment(dept: string): void {
    const updated = this.departments().filter((d) => d !== dept);
    this.saveDepartments(updated);
  }

  private saveDepartments(updated: string[]): void {
    this.savingDepts.set(true);
    this.api.put<Organization>('/organizations/me', { departments: updated }).subscribe({
      next: (org) => {
        this.org.set(org);
        this.departments.set(org.departments ?? []);
        this.savingDepts.set(false);
        this.snackBar.open('Departments saved', 'Close', { duration: 2000 });
      },
      error: () => {
        this.savingDepts.set(false);
        this.snackBar.open('Save failed', 'Close', { duration: 2500 });
      },
    });
  }
}

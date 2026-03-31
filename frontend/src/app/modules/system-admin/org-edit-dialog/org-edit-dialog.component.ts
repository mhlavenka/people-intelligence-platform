import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface OrgRow {
  _id: string;
  name: string;
  slug: string;
  billingEmail: string;
  billingAddress?: BillingAddress;
  taxId?: string;
  plan: string;
  modules: string[];
  isActive: boolean;
  trialEndsAt?: string;
  maxUsers: number;
  notes?: string;
  userCount?: number;
  logoUrl?: string;
}

@Component({
  selector: 'app-org-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>business</mat-icon>
      {{ data._id ? 'Edit Organisation' : 'New Organisation' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="edit-form">

        <!-- Logo upload -->
        <div class="logo-row">
          <div class="logo-thumb">
            @if (logoPreview) {
              <img [src]="logoPreview" alt="Logo" class="logo-thumb-img" />
            } @else {
              <mat-icon class="logo-thumb-icon">business</mat-icon>
            }
          </div>
          <div class="logo-meta">
            <span class="logo-meta-label">Organization Logo</span>
            <span class="logo-meta-hint">PNG, JPG or SVG · max 2 MB</span>
            <div class="logo-meta-btns">
              <label class="logo-pick-btn">
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                       (change)="onLogoSelect($event)" style="display:none" />
                <mat-icon>upload</mat-icon> Upload
              </label>
              @if (logoPreview) {
                <button type="button" class="logo-clear-btn" (click)="clearLogo()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
          </div>
        </div>

        <div class="form-row">
          <mat-form-field>
            <mat-label>Organisation Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Slug</mat-label>
            <input matInput formControlName="slug" [readonly]="!!data._id" />
            @if (!!data._id) {
              <mat-hint>Slug cannot be changed after creation</mat-hint>
            }
          </mat-form-field>
        </div>

        <mat-form-field class="full-width">
          <mat-label>Billing Email</mat-label>
          <input matInput formControlName="billingEmail" type="email" />
        </mat-form-field>

        <!-- Billing Address -->
        <div class="section-label">Billing Address</div>
        <mat-form-field class="full-width">
          <mat-label>Address Line 1</mat-label>
          <input matInput formControlName="billingAddressLine1" placeholder="Street address" />
        </mat-form-field>
        <mat-form-field class="full-width">
          <mat-label>Address Line 2</mat-label>
          <input matInput formControlName="billingAddressLine2" placeholder="Suite, floor, etc. (optional)" />
        </mat-form-field>
        <div class="form-row">
          <mat-form-field>
            <mat-label>City</mat-label>
            <input matInput formControlName="billingAddressCity" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>State / Region</mat-label>
            <input matInput formControlName="billingAddressState" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Postal Code</mat-label>
            <input matInput formControlName="billingAddressPostalCode" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Country (ISO code)</mat-label>
            <mat-select formControlName="billingAddressCountry">
              @for (c of countries; track c.code) {
                <mat-option [value]="c.code">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field class="full-width">
          <mat-label>Tax ID (VAT / EIN)</mat-label>
          <input matInput formControlName="taxId" placeholder="e.g. DE123456789" />
          <mat-hint>Used on invoices for tax compliance</mat-hint>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field>
            <mat-label>Plan</mat-label>
            <mat-select formControlName="plan">
              <mat-option value="starter">Starter</mat-option>
              <mat-option value="professional">Professional</mat-option>
              <mat-option value="enterprise">Enterprise</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Max Users</mat-label>
            <input matInput formControlName="maxUsers" type="number" min="1" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field>
            <mat-label>Trial Ends At</mat-label>
            <input matInput formControlName="trialEndsAt" type="date" />
            <mat-hint>Leave blank for no trial limit</mat-hint>
          </mat-form-field>

          <div class="toggle-field">
            <mat-slide-toggle formControlName="isActive" color="primary">
              Account Active
            </mat-slide-toggle>
            @if (!form.value.isActive) {
              <span class="suspended-badge">Suspended</span>
            }
          </div>
        </div>

        <div class="modules-label">Enabled Modules</div>
        <div class="modules-row">
          @for (m of availableModules; track m.key) {
            <label class="module-check" [class.checked]="isModuleChecked(m.key)">
              <input type="checkbox"
                     [checked]="isModuleChecked(m.key)"
                     (change)="toggleModule(m.key)" />
              <mat-icon>{{ m.icon }}</mat-icon>
              {{ m.label }}
            </label>
          }
        </div>

        <mat-form-field class="full-width">
          <mat-label>Internal Notes</mat-label>
          <textarea matInput formControlName="notes" rows="3" placeholder="Admin notes (not visible to the org)"></textarea>
        </mat-form-field>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving">
        <mat-icon>save</mat-icon>
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px;
      font-size: 18px; color: #1B2A47;
      mat-icon { color: #3A9FD6; }
    }

    mat-dialog-content { padding-top: 8px !important; min-width: 560px; }

    .edit-form { display: flex; flex-direction: column; gap: 12px; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
    }

    .full-width { width: 100%; }

    mat-form-field { width: 100%; }

    .toggle-field {
      display: flex; align-items: center; gap: 12px;
      padding-top: 12px;
    }

    .suspended-badge {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: #fef3cd; color: #856404;
      padding: 2px 8px; border-radius: 999px;
    }

    .section-label {
      font-size: 12px; font-weight: 600; color: #5a6a7e;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: -4px; margin-top: 4px;
      border-top: 1px solid #e8eef4; padding-top: 12px;
    }

    .modules-label {
      font-size: 12px; font-weight: 600; color: #5a6a7e;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: -4px;
    }

    .modules-row {
      display: flex; gap: 10px; flex-wrap: wrap;
    }

    .module-check {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px;
      border: 1.5px solid #dce6f0;
      font-size: 13px; cursor: pointer; color: #5a6a7e;
      transition: all 0.15s;
      input[type=checkbox] { display: none; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.checked { background: #e8f4fd; border-color: #3A9FD6; color: #1B2A47; }
      &:hover { border-color: #3A9FD6; }
    }

    /* Logo row */
    .logo-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 0 4px;
    }

    .logo-thumb {
      width: 64px; height: 64px; border-radius: 12px; flex-shrink: 0;
      border: 2px dashed #dce6f0; background: #f8fafc;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }

    .logo-thumb-img { width: 100%; height: 100%; object-fit: contain; }
    .logo-thumb-icon { color: #9aa5b4; font-size: 28px; }

    .logo-meta {
      display: flex; flex-direction: column; gap: 2px;
    }

    .logo-meta-label { font-size: 13px; font-weight: 600; color: #1B2A47; }
    .logo-meta-hint  { font-size: 11px; color: #9aa5b4; }

    .logo-meta-btns { display: flex; gap: 6px; align-items: center; margin-top: 6px; }

    .logo-pick-btn {
      display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
      padding: 5px 12px; border-radius: 7px; background: #1B2A47; color: white;
      font-size: 12px; font-weight: 500; border: none;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: #253659; }
    }

    .logo-clear-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
      background: none; border: 1px solid #fca5a5; color: #e53e3e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #fef2f2; }
    }

    mat-dialog-actions { padding: 12px 24px 16px; gap: 8px; }
  `],
})
export class OrgEditDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  logoPreview: string | null = null;

  availableModules = [
    { key: 'conflict',       label: 'Conflict',        icon: 'warning_amber' },
    { key: 'neuroinclusion', label: 'Neuro-Inclusion',  icon: 'psychology' },
    { key: 'succession',     label: 'Succession',       icon: 'trending_up' },
  ];

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

  private selectedModules: string[] = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private snack: MatSnackBar,
    public dialogRef: MatDialogRef<OrgEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<OrgRow>,
  ) {}

  onLogoSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.snack.open('Logo must be under 2 MB', 'Close', { duration: 3000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { this.logoPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  clearLogo(): void { this.logoPreview = null; }

  ngOnInit(): void {
    this.logoPreview = this.data.logoUrl ?? null;
    this.selectedModules = [...(this.data.modules ?? ['conflict'])];

    const trialDate = this.data.trialEndsAt
      ? new Date(this.data.trialEndsAt).toISOString().split('T')[0]
      : '';

    const addr = this.data.billingAddress ?? {};
    this.form = this.fb.group({
      name:                   [this.data.name ?? '', Validators.required],
      slug:                   [this.data.slug ?? '', Validators.required],
      billingEmail:           [this.data.billingEmail ?? '', [Validators.required, Validators.email]],
      billingAddressLine1:    [addr.line1 ?? ''],
      billingAddressLine2:    [addr.line2 ?? ''],
      billingAddressCity:     [addr.city ?? ''],
      billingAddressState:    [addr.state ?? ''],
      billingAddressPostalCode: [addr.postalCode ?? ''],
      billingAddressCountry:  [addr.country ?? ''],
      taxId:                  [this.data.taxId ?? ''],
      plan:                   [this.data.plan ?? 'starter', Validators.required],
      maxUsers:               [this.data.maxUsers ?? 100, [Validators.required, Validators.min(1)]],
      trialEndsAt:            [trialDate],
      isActive:               [this.data.isActive ?? true],
      notes:                  [this.data.notes ?? ''],
    });
  }

  isModuleChecked(key: string): boolean {
    return this.selectedModules.includes(key);
  }

  toggleModule(key: string): void {
    if (this.selectedModules.includes(key)) {
      this.selectedModules = this.selectedModules.filter((m) => m !== key);
    } else {
      this.selectedModules = [...this.selectedModules, key];
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const v = this.form.value;
    const body = {
      name:         v['name'],
      slug:         v['slug'],
      billingEmail: v['billingEmail'],
      taxId:        v['taxId'] || undefined,
      billingAddress: {
        line1:      v['billingAddressLine1'] || undefined,
        line2:      v['billingAddressLine2'] || undefined,
        city:       v['billingAddressCity'] || undefined,
        state:      v['billingAddressState'] || undefined,
        postalCode: v['billingAddressPostalCode'] || undefined,
        country:    v['billingAddressCountry'] || undefined,
      },
      plan:         v['plan'],
      maxUsers:     v['maxUsers'],
      trialEndsAt:  v['trialEndsAt'] || null,
      isActive:     v['isActive'],
      notes:        v['notes'],
      modules:      this.selectedModules,
      logoUrl:      this.logoPreview ?? null,
    };

    const req$ = this.data._id
      ? this.api.put<OrgRow>(`/system-admin/organizations/${this.data._id}`, body)
      : this.api.post<OrgRow>('/system-admin/organizations', body);

    req$.subscribe({
      next: (org) => {
        this.saving = false;
        this.dialogRef.close(org);
      },
      error: (err) => {
        this.saving = false;
        this.snack.open(err?.error?.error ?? 'Save failed', 'Close', { duration: 3000 });
      },
    });
  }
}

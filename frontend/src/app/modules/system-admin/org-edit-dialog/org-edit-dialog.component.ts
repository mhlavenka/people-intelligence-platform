import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { TranslateModule } from '@ngx-translate/core';

interface PlanOption {
  _id: string;
  key: string;
  name: string;
  maxUsers: number;
  modules: string[];
  priceMonthly: number;
}

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
  taxExempt?: boolean;
  isActive: boolean;
  trialEndsAt?: string;
  previousPlan?: string;
  previousModules?: string[];
  previousMaxUsers?: number;
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
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatIconModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>business</mat-icon>
      {{ data._id ? 'Edit Organization' : 'New Organization' }}
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
            <mat-label>Organization Name</mat-label>
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
          @if (form.get('billingAddressCountry')?.value === 'CA') {
            <mat-form-field>
              <mat-label>Province</mat-label>
              <mat-select formControlName="billingAddressState">
                <mat-option value="">— Select —</mat-option>
                @for (p of canadianProvinces; track p.code) {
                  <mat-option [value]="p.code">{{ p.name }} ({{ p.code }})</mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field>
              <mat-label>State / Region</mat-label>
              <input matInput formControlName="billingAddressState" />
            </mat-form-field>
          }
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
        <div class="form-row">
          <mat-form-field>
            <mat-label>Tax ID (GST/HST # / VAT / EIN)</mat-label>
            <input matInput formControlName="taxId" placeholder="e.g. 123456789 RT0001" />
            <mat-hint>Used on invoices for tax compliance</mat-hint>
          </mat-form-field>
          <div class="toggle-field">
            <mat-slide-toggle formControlName="taxExempt" color="warn">
              Tax Exempt
            </mat-slide-toggle>
            @if (form.get('taxExempt')?.value) {
              <span class="exempt-badge">Exempt</span>
            }
          </div>
        </div>

        <mat-form-field class="full-width">
          <mat-label>Plan</mat-label>
          <mat-select formControlName="plan" (selectionChange)="onPlanChange($event.value)">
            @for (p of plans(); track p.key) {
              <mat-option [value]="p.key">
                {{ p.name }}
                @if (p.priceMonthly > 0) {
                  — {{ formatPrice(p.priceMonthly) }}/mo
                } @else {
                  — Custom
                }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Max Users</mat-label>
          <input matInput formControlName="maxUsers" type="number" min="1" />
        </mat-form-field>

        <div class="form-row">
          <div></div>
          <div class="toggle-field">
            <mat-slide-toggle formControlName="isActive" color="primary">
              Account Active
            </mat-slide-toggle>
            @if (!form.value.isActive) {
              <span class="suspended-badge">Suspended</span>
            }
          </div>
        </div>

        <div class="modules-label">Included Modules <span class="modules-hint">(determined by plan)</span></div>
        <div class="modules-row">
          @for (m of availableModules; track m.key) {
            <div class="module-check" [class.checked]="isModuleChecked(m.key)">
              <mat-icon>{{ m.icon }}</mat-icon>
              {{ m.label }}
              @if (isModuleChecked(m.key)) {
                <mat-icon class="module-check-icon">check_circle</mat-icon>
              }
            </div>
          }
        </div>

        @if (data._id) {
          <div class="section-label trial-label">
            <mat-icon>schedule</mat-icon> Trial Period
          </div>

          @if (trialActive()) {
            <div class="trial-banner">
              <div class="trial-banner-head">
                <div class="trial-banner-title">
                  <mat-icon>auto_awesome</mat-icon> Trial active
                </div>
                <div class="trial-countdown" [class.urgent]="daysRemaining() !== null && daysRemaining()! <= 3">
                  <mat-icon>schedule</mat-icon>
                  @if (daysRemaining() !== null) {
                    @if (daysRemaining()! > 0) {
                      <strong>{{ daysRemaining() }}</strong> {{ daysRemaining() === 1 ? 'day' : 'days' }} remaining
                    } @else {
                      expires today
                    }
                  }
                </div>
              </div>

              <div class="trial-details">
                <div class="trial-col">
                  <div class="trial-col-label">Current (trial)</div>
                  <div class="trial-kv"><span>Plan</span><strong>{{ planName(data.plan) }}</strong></div>
                  <div class="trial-kv"><span>Max users</span><strong>{{ data.maxUsers }}</strong></div>
                  <div class="trial-kv"><span>Modules</span>
                    @if (data.modules?.length) {
                      <div class="trial-chips">
                        @for (m of data.modules!; track m) { <span class="trial-chip trial-chip-active">{{ moduleLabel(m) }}</span> }
                      </div>
                    } @else { <em>None</em> }
                  </div>
                </div>

                <mat-icon class="trial-arrow">arrow_forward</mat-icon>

                <div class="trial-col">
                  <div class="trial-col-label">Reverts to</div>
                  <div class="trial-kv"><span>Plan</span><strong>{{ planName(data.previousPlan!) }}</strong></div>
                  <div class="trial-kv"><span>Max users</span><strong>{{ data.previousMaxUsers ?? '—' }}</strong></div>
                  <div class="trial-kv"><span>Modules</span>
                    @if (data.previousModules?.length) {
                      <div class="trial-chips">
                        @for (m of data.previousModules!; track m) { <span class="trial-chip">{{ moduleLabel(m) }}</span> }
                      </div>
                    } @else { <em>None</em> }
                  </div>
                </div>
              </div>

              <div class="trial-footer">
                <div class="trial-end-date">
                  <mat-icon>event</mat-icon>
                  Ends on <strong>{{ formatDate(data.trialEndsAt!) }}</strong>
                </div>
                <button type="button" class="trial-end-btn" (click)="cancelTrial()" [disabled]="trialSaving">
                  <mat-icon>undo</mat-icon>
                  {{ trialSaving ? 'Reverting…' : 'End trial & revert now' }}
                </button>
              </div>
            </div>
          } @else {
            <div class="trial-form">
              <p class="trial-hint">
                Temporarily upgrade this org to a different plan or add modules for a trial period.
                The pre-trial state is saved and auto-restored when the trial ends.
              </p>
              <div class="form-row">
                <mat-form-field>
                  <mat-label>Trial Plan (optional)</mat-label>
                  <mat-select [(value)]="trialPlan">
                    <mat-option [value]="null">— Keep current plan —</mat-option>
                    @for (p of plans(); track p.key) {
                      <mat-option [value]="p.key">{{ p.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Trial ends on</mat-label>
                  <input matInput [(ngModel)]="trialEndDate" [ngModelOptions]="{standalone:true}" type="date" [min]="minTrialDate" />
                </mat-form-field>
              </div>
              <div class="modules-label">Add modules for trial (optional)</div>
              <div class="modules-row">
                @for (m of availableModules; track m.key) {
                  <div class="module-check" [class.checked]="trialModules.includes(m.key)" (click)="toggleTrialModule(m.key)">
                    <mat-icon>{{ m.icon }}</mat-icon>
                    {{ m.label }}
                    @if (trialModules.includes(m.key)) {
                      <mat-icon class="module-check-icon">check_circle</mat-icon>
                    }
                  </div>
                }
              </div>
              <div class="trial-actions">
                <button type="button" mat-raised-button color="accent" (click)="startTrial()" [disabled]="!trialEndDate || trialSaving">
                  <mat-icon>play_arrow</mat-icon>
                  {{ trialSaving ? 'Starting…' : 'Start trial' }}
                </button>
              </div>
            </div>
          }
        }

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
      font-size: 18px; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); }
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

    .exempt-badge {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      background: #fef2f2; color: #dc2626;
      padding: 2px 8px; border-radius: 999px;
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
      .modules-hint { font-weight: 400; text-transform: none; letter-spacing: 0; color: #9aa5b4; }
    }

    .modules-row {
      display: flex; gap: 10px; flex-wrap: wrap;
    }

    .module-check {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px;
      border: 1.5px solid #dce6f0;
      font-size: 13px; color: #9aa5b4;
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.checked { background: #e8f4fd; border-color: var(--artes-accent); color: var(--artes-primary); }
      .module-check-icon { font-size: 14px; width: 14px; height: 14px; color: #27C4A0; margin-left: 4px; }
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

    .logo-meta-label { font-size: 13px; font-weight: 600; color: var(--artes-primary); }
    .logo-meta-hint  { font-size: 11px; color: #9aa5b4; }

    .logo-meta-btns { display: flex; gap: 6px; align-items: center; margin-top: 6px; }

    .logo-pick-btn {
      display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
      padding: 5px 12px; border-radius: 7px; background: var(--artes-primary); color: white;
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

    /* Trial */
    .trial-label {
      display: flex; align-items: center; gap: 6px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7c5cbf; }
    }
    .trial-banner {
      background: linear-gradient(135deg, #f3eeff 0%, #faf7ff 100%);
      border-left: 4px solid #7c5cbf; border-radius: 12px;
      padding: 16px 18px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .trial-banner-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .trial-banner-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 15px; font-weight: 700; color: var(--artes-primary);
      mat-icon { color: #7c5cbf; font-size: 20px; width: 20px; height: 20px; }
    }
    .trial-countdown {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; font-weight: 600; color: #5a6a7e;
      background: white; border-radius: 999px; padding: 4px 12px;
      border: 1px solid #e8eef4;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #7c5cbf; }
      strong { color: var(--artes-primary); font-weight: 700; }
      &.urgent {
        background: #fef2f2; border-color: #fca5a5; color: #b91c1c;
        mat-icon, strong { color: #b91c1c; }
      }
    }

    .trial-details {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 14px;
      align-items: stretch;
      background: white; border-radius: 10px; padding: 14px;
    }
    .trial-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .trial-col-label {
      font-size: 10px; font-weight: 700; color: #9aa5b4;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .trial-kv {
      display: flex; align-items: baseline; gap: 8px; font-size: 12px;
      span { color: #9aa5b4; min-width: 70px; }
      strong { color: var(--artes-primary); font-size: 13px; font-weight: 600; }
      em { color: #b8c0cc; font-style: normal; font-size: 12px; }
    }
    .trial-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .trial-chip {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
      background: #f0f4f8; color: #5a6a7e;
    }
    .trial-chip-active { background: #f3eeff; color: #7c5cbf; }
    .trial-arrow {
      align-self: center; color: #b8a5e0;
      font-size: 28px; width: 28px; height: 28px;
    }

    .trial-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding-top: 10px; border-top: 1px dashed #d9ccf0;
    }
    .trial-end-date {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #5a6a7e;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #7c5cbf; }
      strong { color: var(--artes-primary); font-weight: 700; }
    }
    .trial-end-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px; cursor: pointer;
      background: white; color: #b91c1c;
      border: 1.5px solid #fca5a5;
      font-size: 13px; font-weight: 600;
      transition: all 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover:not(:disabled) { background: #fef2f2; border-color: #ef4444; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }

    @media (max-width: 600px) {
      .trial-details { grid-template-columns: 1fr; }
      .trial-arrow { transform: rotate(90deg); }
      .trial-footer { flex-direction: column; align-items: stretch; }
    }
    .trial-form {
      border: 1px solid #e8eef4; border-radius: 10px; padding: 14px;
      background: #fafbfd;
    }
    .trial-hint { font-size: 12px; color: #5a6a7e; margin: 0 0 10px; }
    .trial-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
  `],
})
export class OrgEditDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  logoPreview: string | null = null;
  plans = signal<PlanOption[]>([]);

  // Trial state
  trialPlan: string | null = null;
  trialModules: string[] = [];
  trialEndDate: string = '';
  trialSaving = false;
  minTrialDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  availableModules = [
    { key: 'conflict',       label: 'Conflict',        icon: 'warning_amber' },
    { key: 'neuroinclusion', label: 'Neuro-Inclusion',  icon: 'psychology' },
    { key: 'succession',     label: 'Succession',       icon: 'trending_up' },
    { key: 'coaching',       label: 'Coaching',          icon: 'psychology_alt' },
  ];

  canadianProvinces = [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' },
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
      taxExempt:              [this.data.taxExempt ?? false],
      plan:                   [this.data.plan ?? '', Validators.required],
      maxUsers:               [this.data.maxUsers ?? 100, [Validators.required, Validators.min(1)]],
      isActive:               [this.data.isActive ?? true],
      notes:                  [this.data.notes ?? ''],
    });

    // Load plans from API
    this.api.get<PlanOption[]>('/plans/admin').subscribe({
      next: (plans) => this.plans.set(plans),
    });
  }

  onPlanChange(planKey: string): void {
    const plan = this.plans().find((p) => p.key === planKey);
    if (!plan) return;

    // Auto-fill maxUsers and modules from the selected plan
    this.form.patchValue({ maxUsers: plan.maxUsers });
    if (plan.modules?.length) {
      this.selectedModules = [...plan.modules];
    }
  }

  formatPrice(cents: number): string {
    return '$' + (cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  isModuleChecked(key: string): boolean {
    return this.selectedModules.includes(key);
  }

  trialActive(): boolean {
    return !!this.data.previousPlan;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  daysRemaining(): number | null {
    if (!this.data.trialEndsAt) return null;
    const end = new Date(this.data.trialEndsAt).getTime();
    if (isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }

  planName(key: string | undefined): string {
    if (!key) return '—';
    return this.plans().find((p) => p.key === key)?.name ?? key;
  }

  moduleLabel(key: string): string {
    return this.availableModules.find((m) => m.key === key)?.label ?? key;
  }

  toggleTrialModule(key: string): void {
    this.trialModules = this.trialModules.includes(key)
      ? this.trialModules.filter((m) => m !== key)
      : [...this.trialModules, key];
  }

  startTrial(): void {
    if (!this.data._id || !this.trialEndDate) return;
    this.trialSaving = true;
    const body: { plan?: string; addModules?: string[]; endsAt: string } = {
      endsAt: new Date(this.trialEndDate).toISOString(),
    };
    if (this.trialPlan) body.plan = this.trialPlan;
    if (this.trialModules.length) body.addModules = this.trialModules;

    this.api.post<OrgRow>(`/system-admin/organizations/${this.data._id}/trial`, body).subscribe({
      next: (org) => {
        this.trialSaving = false;
        this.data = { ...this.data, ...org };
        this.selectedModules = [...(org.modules ?? [])];
        this.form.patchValue({ plan: org.plan, maxUsers: org.maxUsers });
        this.trialPlan = null;
        this.trialModules = [];
        this.trialEndDate = '';
        this.snack.open('Trial started', '', { duration: 2000 });
      },
      error: (err) => {
        this.trialSaving = false;
        this.snack.open(err?.error?.error ?? 'Failed to start trial', 'Close', { duration: 3000 });
      },
    });
  }

  cancelTrial(): void {
    if (!this.data._id) return;
    this.trialSaving = true;
    this.api.delete<OrgRow>(`/system-admin/organizations/${this.data._id}/trial`).subscribe({
      next: (org) => {
        this.trialSaving = false;
        this.data = { ...this.data, ...org, previousPlan: undefined, previousModules: undefined, previousMaxUsers: undefined, trialEndsAt: undefined };
        this.selectedModules = [...(org.modules ?? [])];
        this.form.patchValue({ plan: org.plan, maxUsers: org.maxUsers });
        this.snack.open('Trial ended, plan reverted', '', { duration: 2500 });
      },
      error: (err) => {
        this.trialSaving = false;
        this.snack.open(err?.error?.error ?? 'Failed to end trial', 'Close', { duration: 3000 });
      },
    });
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
      taxExempt:    v['taxExempt'] ?? false,
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

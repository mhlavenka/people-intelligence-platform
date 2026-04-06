import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

interface PlanLimits {
  maxAIAnalyses: number;
  maxSurveyResponses: number;
  maxCoachingSessions: number;
  maxFileStorageMB: number;
}

interface Plan {
  _id: string;
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  overagePriceCents: number;
  maxUsers: number;
  modules: string[];
  limits: PlanLimits;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

interface PlanForm {
  key: string;
  name: string;
  description: string;
  priceMonthly: number | null;
  overagePriceCents: number | null;
  maxUsers: number | null;
  modules: Record<string, boolean>;
  limits: PlanLimits;
  featuresRaw: string;   // newline-separated
  isActive: boolean;
  sortOrder: number | null;
}

const MODULE_DEFS = [
  { key: 'conflict',       label: 'Conflict Intelligence\u2122',      icon: 'warning_amber' },
  { key: 'neuroinclusion', label: 'Neuro-Inclusion Compass\u2122',    icon: 'psychology' },
  { key: 'succession',     label: 'Leadership & Succession Hub\u2122', icon: 'trending_up' },
];

function emptyForm(): PlanForm {
  return {
    key: '',
    name: '',
    description: '',
    priceMonthly: null,
    overagePriceCents: 1500,
    maxUsers: null,
    modules: { conflict: false, neuroinclusion: false, succession: false },
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 0 },
    featuresRaw: '',
    isActive: true,
    sortOrder: 0,
  };
}

@Component({
  selector: 'app-sa-plans',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page">

      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1>Subscription Plans</h1>
          <p>Define and manage the plans available to organizations</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New Plan
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="loading-center"><mat-spinner diameter="36" /></div>
      } @else {

        <!-- Create / Edit panel -->
        @if (showForm()) {
          <div class="form-panel">
            <div class="form-panel-header">
              <h2>{{ editingId() ? 'Edit Plan' : 'Create Plan' }}</h2>
              <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
            </div>

            <div class="form-grid">

              <div class="form-row">
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Plan Key</mat-label>
                  <input matInput [(ngModel)]="form().key" placeholder="e.g. starter" [disabled]="!!editingId()" />
                  <mat-hint>Lowercase, no spaces. Used in code & invoice lookups.</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-lg">
                  <mat-label>Display Name</mat-label>
                  <input matInput [(ngModel)]="form().name" placeholder="e.g. Starter" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <input matInput [(ngModel)]="form().description" placeholder="Short description shown to customers" />
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Price / month (cents)</mat-label>
                  <input matInput type="number" [(ngModel)]="form().priceMonthly" min="0" />
                  <mat-hint>{{ centsToDisplay(form().priceMonthly) }}</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Overage / user (cents)</mat-label>
                  <input matInput type="number" [(ngModel)]="form().overagePriceCents" min="0" />
                  <mat-hint>{{ centsToDisplay(form().overagePriceCents) }} per extra user</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Included users</mat-label>
                  <input matInput type="number" [(ngModel)]="form().maxUsers" min="1" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-xs">
                  <mat-label>Sort order</mat-label>
                  <input matInput type="number" [(ngModel)]="form().sortOrder" min="0" />
                </mat-form-field>
              </div>

              <!-- Included Modules -->
              <div class="section-label">
                <mat-icon>extension</mat-icon>
                Included Modules
              </div>
              <div class="module-check-row">
                @for (m of moduleDefs; track m.key) {
                  <label class="module-check">
                    <mat-checkbox [(ngModel)]="form().modules[m.key]" color="primary" />
                    <mat-icon [style.color]="moduleColor(m.key)">{{ m.icon }}</mat-icon>
                    <span>{{ m.label }}</span>
                  </label>
                }
              </div>

              <!-- Usage Limits -->
              <div class="section-label">
                <mat-icon>speed</mat-icon>
                Usage Limits
                <span class="section-hint">0 = unlimited</span>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>AI Analyses / month</mat-label>
                  <input matInput type="number" [(ngModel)]="form().limits.maxAIAnalyses" min="0" />
                  <mat-icon matPrefix class="field-icon">smart_toy</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Survey Responses / month</mat-label>
                  <input matInput type="number" [(ngModel)]="form().limits.maxSurveyResponses" min="0" />
                  <mat-icon matPrefix class="field-icon">assignment</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>Coaching Sessions / year</mat-label>
                  <input matInput type="number" [(ngModel)]="form().limits.maxCoachingSessions" min="0" />
                  <mat-icon matPrefix class="field-icon">psychology_alt</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-sm">
                  <mat-label>File Storage (MB)</mat-label>
                  <input matInput type="number" [(ngModel)]="form().limits.maxFileStorageMB" min="0" />
                  <mat-icon matPrefix class="field-icon">cloud_upload</mat-icon>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Features (one per line)</mat-label>
                <textarea matInput [(ngModel)]="form().featuresRaw" rows="5"
                          placeholder="Conflict Intelligence module&#10;Up to 50 users&#10;Email support"></textarea>
                <mat-hint>Each line becomes a bullet in the billing plan sidebar</mat-hint>
              </mat-form-field>

              <div class="toggle-row">
                <mat-slide-toggle [(ngModel)]="form().isActive" color="primary">
                  Active — visible to customers
                </mat-slide-toggle>
              </div>

            </div>

            <div class="form-actions">
              <button mat-raised-button color="primary" [disabled]="saving()" (click)="save()">
                @if (saving()) { <mat-spinner diameter="16" /> } @else { <mat-icon>save</mat-icon> }
                {{ editingId() ? 'Save Changes' : 'Create Plan' }}
              </button>
              <button mat-button (click)="closeForm()">Cancel</button>
            </div>
          </div>
        }

        <!-- Plans list -->
        @if (plans().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">sell</mat-icon>
            <p>No plans yet. Create your first subscription plan.</p>
          </div>
        } @else {
          <div class="plans-grid">
            @for (plan of sortedPlans(); track plan._id) {
              <div class="plan-card" [class.inactive]="!plan.isActive">
                <div class="plan-card-header">
                  <div class="plan-title-row">
                    <span class="plan-badge" [class.inactive-badge]="!plan.isActive">{{ plan.name }}</span>
                    <span class="plan-key">{{ plan.key }}</span>
                    @if (!plan.isActive) {
                      <span class="inactive-chip">Inactive</span>
                    }
                  </div>
                  <div class="plan-actions">
                    <button mat-icon-button matTooltip="Edit" (click)="openEdit(plan)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete" class="delete-btn" (click)="deletePlan(plan)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>

                @if (plan.description) {
                  <p class="plan-desc">{{ plan.description }}</p>
                }

                <div class="plan-pricing">
                  <div class="price-main">
                    <span class="price-value">{{ formatPrice(plan.priceMonthly) }}</span>
                    <span class="price-per">/mo</span>
                  </div>
                  <div class="price-meta">
                    {{ plan.maxUsers }} included seats
                    @if (plan.overagePriceCents > 0) {
                      · {{ formatPrice(plan.overagePriceCents) }}/extra user
                    }
                  </div>
                </div>

                <!-- Modules -->
                @if (plan.modules.length) {
                  <div class="plan-modules">
                    @for (mod of plan.modules; track mod) {
                      <span class="module-chip" [style.background]="moduleColor(mod) + '18'"
                            [style.color]="moduleColor(mod)">
                        <mat-icon>{{ moduleIcon(mod) }}</mat-icon>
                        {{ moduleLabel(mod) }}
                      </span>
                    }
                  </div>
                }

                <!-- Limits -->
                <div class="plan-limits">
                  <div class="limit-item" [matTooltip]="plan.limits.maxAIAnalyses === 0 ? 'Unlimited' : plan.limits.maxAIAnalyses + ' per month'">
                    <mat-icon>smart_toy</mat-icon>
                    <span>{{ plan.limits.maxAIAnalyses === 0 ? '∞' : plan.limits.maxAIAnalyses }} AI analyses</span>
                  </div>
                  <div class="limit-item" [matTooltip]="plan.limits.maxSurveyResponses === 0 ? 'Unlimited' : plan.limits.maxSurveyResponses + ' per month'">
                    <mat-icon>assignment</mat-icon>
                    <span>{{ plan.limits.maxSurveyResponses === 0 ? '∞' : plan.limits.maxSurveyResponses }} responses</span>
                  </div>
                  @if (plan.limits.maxCoachingSessions) {
                    <div class="limit-item">
                      <mat-icon>psychology_alt</mat-icon>
                      <span>{{ plan.limits.maxCoachingSessions }} coaching/yr</span>
                    </div>
                  }
                  @if (plan.limits.maxFileStorageMB) {
                    <div class="limit-item">
                      <mat-icon>cloud_upload</mat-icon>
                      <span>{{ plan.limits.maxFileStorageMB >= 1000 ? (plan.limits.maxFileStorageMB / 1000) + ' GB' : plan.limits.maxFileStorageMB + ' MB' }}</span>
                    </div>
                  }
                </div>

                @if (plan.features.length > 0) {
                  <mat-divider class="plan-divider" />
                  <ul class="features-list">
                    @for (f of plan.features; track $index) {
                      <li><mat-icon class="check-icon">check_circle</mat-icon> {{ f }}</li>
                    }
                  </ul>
                }

                <div class="plan-footer">
                  <span class="sort-label">Sort: {{ plan.sortOrder }}</span>
                </div>
              </div>
            }
          </div>
        }
      }

    </div>
  `,
  styles: [`
    .page {
      padding: 32px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px;
      h1 { font-size: 22px; font-weight: 700; color: #1B2A47; margin: 0 0 4px; }
      p  { font-size: 13px; color: #6b7280; margin: 0; }
    }

    .loading-center { display: flex; justify-content: center; padding: 80px 0; }

    /* ── Form panel ─────────────────────────────────────── */
    .form-panel {
      background: white; border-radius: 16px; margin-bottom: 28px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .form-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 0;
      h2 { font-size: 16px; font-weight: 600; color: #1B2A47; margin: 0; }
    }
    .form-grid {
      padding: 20px 24px 0; display: flex; flex-direction: column; gap: 12px;
    }
    .form-row {
      display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;
    }
    .full-width { width: 100%; }
    .field-xs { width: 100px; flex-shrink: 0; }
    .field-sm { width: 200px; flex-shrink: 0; }
    .field-lg { flex: 1; min-width: 200px; }
    .toggle-row { padding: 4px 0 8px; }
    .form-actions {
      display: flex; gap: 12px; align-items: center;
      padding: 16px 24px 24px;
    }

    /* Section labels */
    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: #1B2A47;
      margin-top: 8px;
      mat-icon { font-size: 18px; color: #3A9FD6; }
    }
    .section-hint { font-size: 11px; color: #9aa5b4; font-weight: 400; margin-left: auto; }

    /* Module checkboxes in form */
    .module-check-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .module-check {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: #374151; cursor: pointer;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .field-icon { font-size: 18px !important; color: #9aa5b4; }

    /* ── Plans grid ─────────────────────────────────────── */
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .plan-card {
      background: white; border-radius: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.04);
      padding: 20px; display: flex; flex-direction: column; gap: 12px;
      border: 2px solid transparent; transition: border-color 0.15s;
      &:hover { border-color: #e5e7eb; }
      &.inactive { opacity: 0.65; }
    }

    .plan-card-header {
      display: flex; align-items: flex-start; justify-content: space-between;
    }
    .plan-title-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .plan-badge {
      font-size: 14px; font-weight: 700; color: #1B2A47;
      background: #eff6ff; padding: 3px 10px; border-radius: 20px;
      &.inactive-badge { background: #f3f4f6; color: #9ca3af; }
    }
    .plan-key {
      font-size: 11px; font-family: monospace; color: #9ca3af;
      background: #f9fafb; padding: 2px 6px; border-radius: 4px;
    }
    .inactive-chip {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      background: #fef2f2; color: #b91c1c; padding: 2px 6px; border-radius: 4px;
    }
    .plan-actions {
      display: flex; gap: 2px; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      button { width: 32px; height: 32px; line-height: 32px; color: #9ca3af; }
    }
    .delete-btn:hover { color: #ef4444 !important; }

    .plan-desc {
      font-size: 12px; color: #6b7280; margin: 0; line-height: 1.5;
    }

    .plan-pricing {
      background: #f8fafc; border-radius: 10px; padding: 12px 14px;
    }
    .price-main {
      display: flex; align-items: baseline; gap: 3px; margin-bottom: 4px;
    }
    .price-value {
      font-size: 22px; font-weight: 800; color: #1B2A47;
    }
    .price-per { font-size: 13px; color: #9ca3af; }
    .price-meta { font-size: 11px; color: #9ca3af; }

    /* Modules chips */
    .plan-modules {
      display: flex; gap: 6px; flex-wrap: wrap;
    }
    .module-chip {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    /* Limits row */
    .plan-limits {
      display: flex; gap: 12px; flex-wrap: wrap;
    }
    .limit-item {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #6b7280;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #9aa5b4; }
    }

    .plan-divider { margin: 0; }

    .features-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 6px;
      li {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; color: #374151;
      }
    }
    .check-icon { font-size: 14px; width: 14px; height: 14px; color: #27C4A0; }

    .plan-footer {
      display: flex; justify-content: flex-end;
    }
    .sort-label { font-size: 11px; color: #d1d5db; }

    /* ── Empty state ─────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 80px 0; gap: 12px;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #d1d5db; }
      p { font-size: 14px; color: #9ca3af; margin: 0; }
    }
  `],
})
export class PlansComponent implements OnInit {
  plans = signal<Plan[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  editingId = signal<string | null>(null);
  form = signal<PlanForm>(emptyForm());

  moduleDefs = MODULE_DEFS;

  sortedPlans = computed(() =>
    [...this.plans()].sort((a, b) => a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly)
  );

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<Plan[]>('/plans/admin').subscribe({
      next: (data) => { this.plans.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set(emptyForm());
    this.showForm.set(true);
  }

  openEdit(plan: Plan): void {
    this.editingId.set(plan._id);
    this.form.set({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      overagePriceCents: plan.overagePriceCents,
      maxUsers: plan.maxUsers,
      modules: {
        conflict:       plan.modules?.includes('conflict') ?? false,
        neuroinclusion: plan.modules?.includes('neuroinclusion') ?? false,
        succession:     plan.modules?.includes('succession') ?? false,
      },
      limits: {
        maxAIAnalyses:       plan.limits?.maxAIAnalyses ?? 0,
        maxSurveyResponses:  plan.limits?.maxSurveyResponses ?? 0,
        maxCoachingSessions: plan.limits?.maxCoachingSessions ?? 0,
        maxFileStorageMB:    plan.limits?.maxFileStorageMB ?? 0,
      },
      featuresRaw: plan.features.join('\n'),
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save(): void {
    const f = this.form();
    if (!f.key || !f.name || f.priceMonthly === null || f.maxUsers === null) {
      this.snackBar.open('Please fill in all required fields.', 'Dismiss', { duration: 3000 });
      return;
    }

    const modules: string[] = [];
    if (f.modules['conflict'])       modules.push('conflict');
    if (f.modules['neuroinclusion']) modules.push('neuroinclusion');
    if (f.modules['succession'])     modules.push('succession');

    const payload = {
      key: f.key.trim().toLowerCase().replace(/\s+/g, '-'),
      name: f.name.trim(),
      description: f.description.trim(),
      priceMonthly: Number(f.priceMonthly),
      overagePriceCents: Number(f.overagePriceCents ?? 1500),
      maxUsers: Number(f.maxUsers),
      modules,
      limits: {
        maxAIAnalyses:       Number(f.limits.maxAIAnalyses ?? 0),
        maxSurveyResponses:  Number(f.limits.maxSurveyResponses ?? 0),
        maxCoachingSessions: Number(f.limits.maxCoachingSessions ?? 0),
        maxFileStorageMB:    Number(f.limits.maxFileStorageMB ?? 0),
      },
      features: f.featuresRaw.split('\n').map((l) => l.trim()).filter(Boolean),
      isActive: f.isActive,
      sortOrder: Number(f.sortOrder ?? 0),
    };

    this.saving.set(true);
    const id = this.editingId();

    const req = id
      ? this.api.put<Plan>(`/plans/${id}`, payload)
      : this.api.post<Plan>('/plans', payload);

    req.subscribe({
      next: (plan) => {
        this.saving.set(false);
        if (id) {
          this.plans.update((list) => list.map((p) => (p._id === id ? plan : p)));
          this.snackBar.open('Plan updated.', 'Dismiss', { duration: 3000 });
        } else {
          this.plans.update((list) => [...list, plan]);
          this.snackBar.open('Plan created.', 'Dismiss', { duration: 3000 });
        }
        this.closeForm();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.error ?? 'Failed to save plan.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  deletePlan(plan: Plan): void {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    this.api.delete(`/plans/${plan._id}`).subscribe({
      next: () => {
        this.plans.update((list) => list.filter((p) => p._id !== plan._id));
        this.snackBar.open('Plan deleted.', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete plan.', 'Dismiss', { duration: 3000 });
      },
    });
  }

  centsToDisplay(cents: number | null): string {
    if (cents === null || cents === undefined) return '';
    return `$${(cents / 100).toFixed(2)} CAD`;
  }

  formatPrice(cents: number): string {
    if (cents === 0) return 'Custom';
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  moduleColor(key: string): string {
    const map: Record<string, string> = {
      conflict: '#e86c3a', neuroinclusion: '#27C4A0', succession: '#3A9FD6',
    };
    return map[key] ?? '#9aa5b4';
  }

  moduleIcon(key: string): string {
    return MODULE_DEFS.find((m) => m.key === key)?.icon ?? 'extension';
  }

  moduleLabel(key: string): string {
    const map: Record<string, string> = {
      conflict: 'Conflict', neuroinclusion: 'Neuro-Inclusion', succession: 'Succession',
    };
    return map[key] ?? key;
  }
}

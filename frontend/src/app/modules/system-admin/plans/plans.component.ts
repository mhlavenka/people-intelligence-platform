import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../core/api.service';
import { PlanEditDialogComponent } from '../plan-edit-dialog/plan-edit-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

const MODULE_DEFS = [
  { key: 'conflict',       label: 'Conflict Intelligence\u2122',      icon: 'warning_amber' },
  { key: 'neuroinclusion', label: 'Neuro-Inclusion Compass\u2122',    icon: 'psychology' },
  { key: 'succession',     label: 'Leadership & Succession Hub\u2122', icon: 'trending_up' },
  { key: 'coaching',       label: 'Coaching',                          icon: 'psychology_alt' },
];

@Component({
  selector: 'app-sa-plans',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslateModule,
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

        <!-- Plans list -->
        @if (plans().length === 0) {
          <app-empty-state icon="sell" title="No plans yet" message="Create your first subscription plan."></app-empty-state>
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
                    @if (!isPlanInUse(plan.key)) {
                      <button mat-icon-button matTooltip="Delete" class="delete-btn" (click)="deletePlan(plan)">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    }
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
      h1 { font-size: 22px; font-weight: 700; color: var(--artes-primary); margin: 0 0 4px; }
      p  { font-size: 13px; color: #6b7280; margin: 0; }
    }

    .loading-center { display: flex; justify-content: center; padding: 80px 0; }

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
      font-size: 14px; font-weight: 700; color: var(--artes-primary);
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
      display: flex; align-items: center; gap: 0; flex-shrink: 0;
      button { color: #9ca3af; }
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
      font-size: 22px; font-weight: 800; color: var(--artes-primary);
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

  `],
})
export class PlansComponent implements OnInit {
  plans = signal<Plan[]>([]);
  loading = signal(true);
  private usedPlanKeys = signal<Set<string>>(new Set());

  sortedPlans = computed(() =>
    [...this.plans()].sort((a, b) => a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly)
  );

  constructor(private api: ApiService, private snackBar: MatSnackBar, private dialog: MatDialog) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.api.get<Plan[]>('/plans/admin').subscribe({
      next: (data) => { this.plans.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    // Load which plan keys are in use by organizations
    this.api.get<{ plan: string }[]>('/system-admin/organizations').subscribe({
      next: (orgs) => this.usedPlanKeys.set(new Set(orgs.map((o) => o.plan).filter(Boolean))),
    });
  }

  isPlanInUse(key: string): boolean {
    return this.usedPlanKeys().has(key);
  }

  openCreate(): void {
    const ref = this.dialog.open(PlanEditDialogComponent, {
      data: null, minWidth: '680px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((plan) => {
      if (plan) { this.plans.update((list) => [...list, plan]); }
    });
  }

  openEdit(plan: Plan): void {
    const ref = this.dialog.open(PlanEditDialogComponent, {
      data: plan, minWidth: '680px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((updated) => {
      if (updated) { this.plans.update((list) => list.map((p) => p._id === updated._id ? updated : p)); }
    });
  }

  deletePlan(plan: Plan): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Delete Plan',
        message: `Permanently delete "${plan.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.api.delete(`/plans/${plan._id}`).subscribe({
        next: () => {
          this.plans.update((list) => list.filter((p) => p._id !== plan._id));
          this.snackBar.open('Plan deleted.', 'Dismiss', { duration: 3000 });
        },
        error: () => this.snackBar.open('Failed to delete plan.', 'Dismiss', { duration: 3000 }),
      });
    });
  }

  formatPrice(cents: number): string {
    if (cents === 0) return 'Custom';
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  moduleColor(key: string): string {
    return ({ conflict: '#e86c3a', neuroinclusion: '#27C4A0', succession: '#3A9FD6', coaching: '#7c5cbf' } as Record<string, string>)[key] ?? '#9aa5b4';
  }

  moduleIcon(key: string): string {
    return MODULE_DEFS.find((m) => m.key === key)?.icon ?? 'extension';
  }

  moduleLabel(key: string): string {
    return ({ conflict: 'Conflict', neuroinclusion: 'Neuro-Inclusion', succession: 'Succession', coaching: 'Coaching' } as Record<string, string>)[key] ?? key;
  }
}

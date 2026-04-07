import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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

const MODULE_DEFS = [
  { key: 'conflict',       label: 'Conflict Intelligence\u2122',      icon: 'warning_amber' },
  { key: 'neuroinclusion', label: 'Neuro-Inclusion Compass\u2122',    icon: 'psychology' },
  { key: 'succession',     label: 'Leadership & Succession Hub\u2122', icon: 'trending_up' },
];

@Component({
  selector: 'app-plan-edit-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>sell</mat-icon>
      {{ isEdit ? 'Edit Plan' : 'New Plan' }}
    </h2>

    <mat-dialog-content>
      <div class="form-grid">

        <div class="form-row">
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Plan Key</mat-label>
            <input matInput [(ngModel)]="form.key" placeholder="e.g. starter" [disabled]="isEdit" />
            @if (!isEdit) {
              <mat-hint>Lowercase, no spaces</mat-hint>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-lg">
            <mat-label>Display Name</mat-label>
            <input matInput [(ngModel)]="form.name" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <input matInput [(ngModel)]="form.description" placeholder="Short description" />
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Price / month (cents)</mat-label>
            <input matInput type="number" [(ngModel)]="form.priceMonthly" min="0" />
            <mat-hint>{{ centsToDisplay(form.priceMonthly) }}</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Overage / user (cents)</mat-label>
            <input matInput type="number" [(ngModel)]="form.overagePriceCents" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Included users</mat-label>
            <input matInput type="number" [(ngModel)]="form.maxUsers" min="1" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-xs">
            <mat-label>Sort</mat-label>
            <input matInput type="number" [(ngModel)]="form.sortOrder" min="0" />
          </mat-form-field>
        </div>

        <!-- Modules -->
        <div class="section-label"><mat-icon>extension</mat-icon> Included Modules</div>
        <div class="module-check-row">
          @for (m of moduleDefs; track m.key) {
            <label class="module-check">
              <mat-checkbox [(ngModel)]="form.modules[m.key]" color="primary" />
              <mat-icon [style.color]="moduleColor(m.key)">{{ m.icon }}</mat-icon>
              <span>{{ m.label }}</span>
            </label>
          }
        </div>

        <!-- Limits -->
        <div class="section-label"><mat-icon>speed</mat-icon> Usage Limits <span class="hint">0 = unlimited</span></div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>AI Analyses / month</mat-label>
            <input matInput type="number" [(ngModel)]="form.limits.maxAIAnalyses" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Survey Responses / month</mat-label>
            <input matInput type="number" [(ngModel)]="form.limits.maxSurveyResponses" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>Coaching Sessions / year</mat-label>
            <input matInput type="number" [(ngModel)]="form.limits.maxCoachingSessions" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="field-sm">
            <mat-label>File Storage (MB)</mat-label>
            <input matInput type="number" [(ngModel)]="form.limits.maxFileStorageMB" min="0" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Features (one per line)</mat-label>
          <textarea matInput [(ngModel)]="form.featuresRaw" rows="5"
                    placeholder="Feature 1&#10;Feature 2"></textarea>
        </mat-form-field>

        <mat-slide-toggle [(ngModel)]="form.isActive" color="primary">
          Active — visible to customers
        </mat-slide-toggle>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="saving() || !form.key || !form.name" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        @else { <mat-icon>save</mat-icon> }
        {{ isEdit ? 'Save Changes' : 'Create Plan' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 8px; color: #1B2A47; mat-icon { color: #3A9FD6; } }
    mat-dialog-content { min-width: 620px; max-height: 78vh; overflow-y: auto; padding-top: 8px !important; }
    .form-grid { display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .full-width { width: 100%; }
    .field-xs { width: 80px; flex-shrink: 0; }
    .field-sm { width: 170px; flex-shrink: 0; }
    .field-lg { flex: 1; min-width: 180px; }
    .section-label {
      display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #1B2A47; margin-top: 8px;
      mat-icon { font-size: 18px; color: #3A9FD6; }
      .hint { font-size: 11px; color: #9aa5b4; font-weight: 400; margin-left: auto; }
    }
    .module-check-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .module-check {
      display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; cursor: pointer;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
  `],
})
export class PlanEditDialogComponent implements OnInit {
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<PlanEditDialogComponent>);
  private snack = inject(MatSnackBar);
  data = inject<Plan | null>(MAT_DIALOG_DATA, { optional: true });

  moduleDefs = MODULE_DEFS;
  saving = signal(false);
  isEdit = false;

  form = {
    key: '', name: '', description: '',
    priceMonthly: 0 as number | null, overagePriceCents: 1500 as number | null,
    maxUsers: 10 as number | null, sortOrder: 0 as number | null,
    modules: {} as Record<string, boolean>,
    limits: { maxAIAnalyses: 0, maxSurveyResponses: 0, maxCoachingSessions: 0, maxFileStorageMB: 0 },
    featuresRaw: '', isActive: true,
  };

  ngOnInit(): void {
    if (this.data) {
      this.isEdit = true;
      this.form = {
        key: this.data.key, name: this.data.name, description: this.data.description,
        priceMonthly: this.data.priceMonthly, overagePriceCents: this.data.overagePriceCents,
        maxUsers: this.data.maxUsers, sortOrder: this.data.sortOrder,
        modules: {
          conflict: this.data.modules?.includes('conflict') ?? false,
          neuroinclusion: this.data.modules?.includes('neuroinclusion') ?? false,
          succession: this.data.modules?.includes('succession') ?? false,
        },
        limits: { ...this.data.limits },
        featuresRaw: this.data.features.join('\n'), isActive: this.data.isActive,
      };
    }
  }

  save(): void {
    const f = this.form;
    if (!f.key || !f.name || f.priceMonthly === null || f.maxUsers === null) return;

    const modules: string[] = [];
    if (f.modules['conflict']) modules.push('conflict');
    if (f.modules['neuroinclusion']) modules.push('neuroinclusion');
    if (f.modules['succession']) modules.push('succession');

    const payload = {
      key: f.key.trim().toLowerCase().replace(/\s+/g, '-'),
      name: f.name.trim(), description: f.description.trim(),
      priceMonthly: Number(f.priceMonthly), overagePriceCents: Number(f.overagePriceCents ?? 1500),
      maxUsers: Number(f.maxUsers), modules,
      limits: {
        maxAIAnalyses: Number(f.limits.maxAIAnalyses ?? 0),
        maxSurveyResponses: Number(f.limits.maxSurveyResponses ?? 0),
        maxCoachingSessions: Number(f.limits.maxCoachingSessions ?? 0),
        maxFileStorageMB: Number(f.limits.maxFileStorageMB ?? 0),
      },
      features: f.featuresRaw.split('\n').map((l) => l.trim()).filter(Boolean),
      isActive: f.isActive, sortOrder: Number(f.sortOrder ?? 0),
    };

    this.saving.set(true);
    const req = this.isEdit
      ? this.api.put<Plan>(`/plans/${this.data!._id}`, payload)
      : this.api.post<Plan>('/plans', payload);

    req.subscribe({
      next: (plan) => { this.saving.set(false); this.dialogRef.close(plan); },
      error: (err) => {
        this.saving.set(false);
        this.snack.open(err?.error?.error ?? 'Failed to save plan', 'Dismiss', { duration: 4000 });
      },
    });
  }

  centsToDisplay(cents: number | null): string {
    if (cents === null || cents === undefined) return '';
    return `$${(cents / 100).toFixed(2)} CAD`;
  }

  moduleColor(key: string): string {
    return ({ conflict: '#e86c3a', neuroinclusion: '#27C4A0', succession: '#3A9FD6' } as Record<string, string>)[key] ?? '#9aa5b4';
  }
}

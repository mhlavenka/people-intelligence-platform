import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/api.service';

export interface CustomRole {
  _id: string;
  name: string;
  description?: string;
  color: string;
  baseRole: string;
  permissions: string[];
}

interface PermissionDef { key: string; label: string; description: string; }
interface PermissionGroup { category: string; icon: string; permissions: PermissionDef[]; }

// Permission groups — mirrors backend src/config/permissions.ts
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: 'Administration', icon: 'admin_panel_settings',
    permissions: [
      { key: 'MANAGE_USERS',            label: 'Manage Users',            description: 'Create, edit, and deactivate users' },
      { key: 'MANAGE_ORGANIZATION',     label: 'Organization Settings',   description: 'Edit org name, industry, departments' },
      { key: 'MANAGE_INTAKE_TEMPLATES', label: 'Manage Intake Templates', description: 'Create and edit survey/interview templates' },
      { key: 'VIEW_ALL_USERS',          label: 'View All Users',          description: 'See the full user directory' },
      { key: 'VIEW_ORG_CHART',          label: 'Org Chart',               description: 'View the organizational chart' },
      { key: 'MANAGE_BILLING',          label: 'Billing & Subscription',  description: 'View invoices and change plan' },
      { key: 'MANAGE_ROLES',            label: 'Manage Roles',            description: 'Create and edit custom roles' },
    ],
  },
  {
    category: 'Conflict Intelligence', icon: 'warning_amber',
    permissions: [
      { key: 'VIEW_CONFLICT_DASHBOARD', label: 'Conflict Dashboard',   description: 'View analyses and risk scores' },
      { key: 'RUN_CONFLICT_ANALYSIS',   label: 'Run AI Analysis',      description: 'Trigger new AI conflict analysis' },
      { key: 'ESCALATE_CONFLICT',       label: 'Escalate to HR',       description: 'Request HR/coach intervention' },
      { key: 'VIEW_CONFLICT_RESPONSES', label: 'View Responses',       description: 'See aggregated survey responses' },
      { key: 'TAKE_SURVEY',             label: 'Take Surveys',         description: 'Complete self-service surveys' },
    ],
  },
  {
    category: 'Neuro-Inclusion', icon: 'psychology',
    permissions: [
      { key: 'RUN_NEUROINCLUSION',          label: 'Run Assessment', description: 'Conduct neuro-inclusion assessments' },
      { key: 'VIEW_NEUROINCLUSION_RESULTS', label: 'View Results',   description: 'View neuro-inclusion results' },
    ],
  },
  {
    category: 'Coach & Interviews', icon: 'psychology_alt',
    permissions: [
      { key: 'CONDUCT_INTERVIEWS',    label: 'Conduct Interviews',    description: 'Lead coach-led interview sessions' },
      { key: 'VIEW_INTAKE_TEMPLATES', label: 'View Templates (read)', description: 'Browse intake templates without editing' },
    ],
  },
  {
    category: 'Leadership & Succession', icon: 'trending_up',
    permissions: [
      { key: 'VIEW_ALL_IDPS',         label: 'View All IDPs',     description: 'Access all individual development plans' },
      { key: 'GENERATE_IDP',          label: 'Generate IDP (AI)', description: 'Create GROW model IDPs with AI' },
      { key: 'VIEW_OWN_IDP',          label: 'View Own IDP',      description: 'See own development plan only' },
      { key: 'UPDATE_IDP_MILESTONES', label: 'Update Milestones', description: 'Mark milestones complete, add notes' },
    ],
  },
  {
    category: 'Communication', icon: 'forum',
    permissions: [
      { key: 'VIEW_HUB', label: 'Message Hub', description: 'Access the internal message hub' },
    ],
  },
];

const BASE_ROLES = [
  { value: 'admin',      label: 'Admin',      description: 'Full platform management access' },
  { value: 'hr_manager', label: 'HR Manager', description: 'HR operations and people analytics' },
  { value: 'manager',    label: 'Manager',    description: 'Team-level analytics and escalation' },
  { value: 'coach',      label: 'Coach',      description: 'Interview, coaching, and succession' },
  { value: 'coachee',    label: 'Coachee',    description: 'Survey participation and own IDP' },
];

const PRESET_COLORS = [
  '#1B2A47', '#3A9FD6', '#27C4A0', '#e85a2e',
  '#7c5cbf', '#b07800', '#1a9678', '#c0392b',
  '#2980b9', '#8e44ad', '#16a085', '#5a6a7e',
];

@Component({
  selector: 'app-role-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon [style.color]="form.get('color')?.value || '#3A9FD6'">manage_accounts</mat-icon>
      {{ isEdit ? 'Edit Custom Role' : 'New Custom Role' }}
    </h2>

    <mat-dialog-content>
      @if (error()) { <div class="error-banner">{{ error() }}</div> }

      <form [formGroup]="form">

        <!-- Name + color -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="grow">
            <mat-label>Role Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Department Head, Senior Analyst" />
          </mat-form-field>
        </div>

        <div class="color-row">
          <span class="color-label">Colour</span>
          @for (c of presetColors; track c) {
            <button type="button" class="color-swatch"
                    [style.background]="c"
                    [class.selected]="form.get('color')?.value === c"
                    (click)="form.get('color')?.setValue(c)">
              @if (form.get('color')?.value === c) {
                <mat-icon>check</mat-icon>
              }
            </button>
          }
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description (optional)</mat-label>
          <textarea matInput formControlName="description" rows="2"
            placeholder="What is this role for?"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Base System Role</mat-label>
          <mat-select formControlName="baseRole">
            @for (r of baseRoles; track r.value) {
              <mat-option [value]="r.value">
                <strong>{{ r.label }}</strong> — {{ r.description }}
              </mat-option>
            }
          </mat-select>
          <mat-hint>Determines which API routes this role can access. Use as a starting baseline.</mat-hint>
        </mat-form-field>

        <mat-divider style="margin: 12px 0 16px"></mat-divider>

        <!-- Permission matrix -->
        <div class="perm-header">
          <span>Permissions</span>
          <span class="perm-count">{{ selectedCount() }} selected</span>
          <div class="perm-actions">
            <button type="button" mat-button (click)="selectAll()">Select all</button>
            <button type="button" mat-button (click)="clearAll()">Clear all</button>
          </div>
        </div>

        @for (group of permissionGroups; track group.category) {
          <div class="perm-group">
            <div class="perm-group-label">
              <mat-icon>{{ group.icon }}</mat-icon>
              {{ group.category }}
              <span class="group-count">
                {{ groupSelectedCount(group) }}/{{ group.permissions.length }}
              </span>
            </div>
            <div class="perm-list">
              @for (p of group.permissions; track p.key) {
                <label class="perm-item" [class.checked]="isChecked(p.key)"
                       [matTooltip]="p.description" matTooltipPosition="right">
                  <mat-checkbox [checked]="isChecked(p.key)"
                                (change)="toggle(p.key, $event.checked)"
                                color="primary">
                    {{ p.label }}
                  </mat-checkbox>
                </label>
              }
            </div>
          </div>
        }

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary"
              (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) { <mat-spinner diameter="18" /> }
        @else {
          <mat-icon>{{ isEdit ? 'save' : 'add_circle' }}</mat-icon>
          {{ isEdit ? 'Save Changes' : 'Create Role' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex; align-items: center; gap: 8px; color: var(--artes-primary);
    }
    mat-dialog-content {
      min-width: 560px; max-width: 680px; max-height: 78vh;
      overflow-y: auto; padding-top: 8px !important;
    }
    .error-banner {
      background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
      padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 14px;
    }
    .full-width { width: 100%; }
    .grow { flex: 1; min-width: 0; }
    .form-row { display: flex; gap: 12px; }

    /* Color swatches */
    .color-row {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .color-label { font-size: 12px; color: #9aa5b4; min-width: 40px; }
    .color-swatch {
      width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.1s;
      &:hover { transform: scale(1.15); }
      &.selected { border-color: var(--artes-primary); transform: scale(1.15); }
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: white; }
    }

    /* Permission matrix */
    .perm-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
      font-size: 13px; font-weight: 600; color: var(--artes-primary);
      .perm-count { background: var(--artes-bg); color: var(--artes-accent); padding: 1px 8px; border-radius: 999px; font-size: 11px; }
      .perm-actions { margin-left: auto; display: flex; gap: 0; }
    }

    .perm-group {
      margin-bottom: 12px;
      .perm-group-label {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.5px; color: #9aa5b4; margin-bottom: 4px;
        mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--artes-accent); }
        .group-count { margin-left: auto; font-size: 10px; color: #b4bec8; }
      }
      .perm-list {
        display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px;
      }
    }

    .perm-item {
      display: flex; align-items: center;
      padding: 4px 8px; border-radius: 6px; cursor: pointer;
      font-size: 13px; transition: background 0.1s;
      &:hover { background: #f0f8ff; }
      &.checked { background: var(--artes-bg); }
    }
  `],
})
export class RoleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private dialogRef = inject(MatDialogRef<RoleDialogComponent>);
  existingRole = inject<CustomRole | null>(MAT_DIALOG_DATA, { optional: true });

  form!: FormGroup;
  saving = signal(false);
  error = signal('');
  permissionGroups = PERMISSION_GROUPS;
  presetColors = PRESET_COLORS;
  baseRoles = BASE_ROLES;

  get isEdit(): boolean { return !!this.existingRole; }

  // Track selected permissions as a Set for O(1) lookup
  private selected = new Set<string>();

  ngOnInit(): void {
    const d = this.existingRole;
    this.selected = new Set(d?.permissions ?? []);

    this.form = this.fb.group({
      name:        [d?.name ?? '', Validators.required],
      description: [d?.description ?? ''],
      color:       [d?.color ?? '#3A9FD6'],
      baseRole:    [d?.baseRole ?? 'manager', Validators.required],
    });
  }

  isChecked = (key: string) => this.selected.has(key);

  toggle(key: string, checked: boolean): void {
    checked ? this.selected.add(key) : this.selected.delete(key);
  }

  selectAll(): void {
    PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => this.selected.add(p.key)));
  }

  clearAll(): void { this.selected.clear(); }

  selectedCount = () => this.selected.size;

  groupSelectedCount(group: PermissionGroup): number {
    return group.permissions.filter((p) => this.selected.has(p.key)).length;
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');

    const payload = { ...this.form.value, permissions: [...this.selected] };

    const req = this.isEdit
      ? this.api.put(`/roles/${this.existingRole!._id}`, payload)
      : this.api.post('/roles', payload);

    req.subscribe({
      next: (result) => { this.saving.set(false); this.dialogRef.close(result); },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to save role.');
        this.saving.set(false);
      },
    });
  }
}

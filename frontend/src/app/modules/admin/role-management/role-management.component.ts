import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/api.service';
import { RoleDialogComponent, CustomRole } from '../role-dialog/role-dialog.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Permission key → display label mapping
const PERM_LABELS: Record<string, { feature: string; category: string }> = {
  MANAGE_USERS:            { feature: 'Manage Users',           category: 'Administration' },
  MANAGE_ORGANIZATION:     { feature: 'Manage Organization',    category: 'Administration' },
  MANAGE_INTAKE_TEMPLATES: { feature: 'Manage Intake Templates', category: 'Administration' },
  VIEW_ALL_USERS:          { feature: 'View All Users',         category: 'Administration' },
  VIEW_ORG_CHART:          { feature: 'Org Chart',              category: 'Administration' },
  MANAGE_BILLING:          { feature: 'Billing & Subscription', category: 'Administration' },
  MANAGE_ROLES:            { feature: 'Manage Roles',           category: 'Administration' },
  VIEW_REPORTS:            { feature: 'View Reports',           category: 'Administration' },
  VIEW_CONFLICT_DASHBOARD: { feature: 'View Dashboard',         category: 'Conflict Intelligence' },
  RUN_CONFLICT_ANALYSIS:   { feature: 'Run AI Analysis',        category: 'Conflict Intelligence' },
  ESCALATE_CONFLICT:       { feature: 'Escalate to HR',         category: 'Conflict Intelligence' },
  VIEW_CONFLICT_RESPONSES: { feature: 'View Responses',         category: 'Conflict Intelligence' },
  TAKE_SURVEY:             { feature: 'Take Survey',            category: 'Conflict Intelligence' },
  RUN_NEUROINCLUSION:      { feature: 'Run Assessment',         category: 'Neuro-Inclusion' },
  VIEW_NEUROINCLUSION_RESULTS: { feature: 'View Results',       category: 'Neuro-Inclusion' },
  MANAGE_COACHING:         { feature: 'Manage Coaching',        category: 'Coaching' },
  CONDUCT_INTERVIEWS:      { feature: 'Conduct Interviews',     category: 'Coaching' },
  VIEW_INTAKE_TEMPLATES:   { feature: 'View Templates (read)',  category: 'Coaching' },
  MANAGE_SPONSORS:         { feature: 'Manage Sponsors',        category: 'Coaching' },
  MANAGE_JOURNAL:          { feature: 'Manage Journal',         category: 'Coaching' },
  VIEW_JOURNAL:            { feature: 'View Journal',           category: 'Coaching' },
  IMPORT_EQI:              { feature: 'Import EQ-i',            category: 'Coaching' },
  MANAGE_BOOKING:          { feature: 'Manage Booking',         category: 'Booking & Calendar' },
  VIEW_BOOKINGS:           { feature: 'View Bookings',          category: 'Booking & Calendar' },
  MANAGE_CALENDAR:         { feature: 'Google Calendar',        category: 'Booking & Calendar' },
  VIEW_ALL_IDPS:           { feature: 'View All IDPs',          category: 'Leadership & Succession' },
  GENERATE_IDP:            { feature: 'Generate IDP (AI)',       category: 'Leadership & Succession' },
  VIEW_OWN_IDP:            { feature: 'View Own IDP',           category: 'Leadership & Succession' },
  UPDATE_IDP_MILESTONES:   { feature: 'Update Milestones',      category: 'Leadership & Succession' },
  VIEW_HUB:                { feature: 'Message Hub',            category: 'Communication' },
};

const ALL_PERM_KEYS = Object.keys(PERM_LABELS);
const CATEGORIES = [...new Set(Object.values(PERM_LABELS).map((p) => p.category))];

interface PermRow { key: string; feature: string; category: string; }
const PERM_ROWS: PermRow[] = ALL_PERM_KEYS.map((k) => ({ key: k, ...PERM_LABELS[k] }));

const ROLES = [
  { key: 'admin',      label: 'Admin',            color: '#1B2A47', icon: 'shield' },
  { key: 'hr_manager', label: 'HR Manager',       color: '#2080b0', icon: 'manage_accounts' },
  { key: 'manager',    label: 'Manager',          color: '#b07800', icon: 'supervisor_account' },
  { key: 'coach',      label: 'Coach',            color: '#1a9678', icon: 'psychology_alt' },
  { key: 'employee',   label: 'Employee',         color: '#7c5cbf', icon: 'badge' },
  { key: 'coachee',    label: 'External Coachee', color: '#5a6a7e', icon: 'person' },
];

interface SystemRoleData { permissions: string[]; isOverridden: boolean; }

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatCheckboxModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="roles-page">
      <div class="page-header">
        <div>
          <h1>{{ "ADMIN.rolePermissions" | translate }}</h1>
          <p>{{ "ADMIN.rolePermissionsDesc" | translate }}</p>
        </div>
      </div>

      <!-- ── Custom Roles ─────────────────────────────────── -->
      <div class="section-header">
        <div class="section-title">
          <mat-icon>manage_accounts</mat-icon>
          {{ 'ADMIN.customRoles' | translate }}
        </div>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> {{ "ADMIN.newRole" | translate }}
        </button>
      </div>

      @if (loadingCustom()) {
        <div class="loading-row"><mat-spinner diameter="28" /></div>
      } @else if (customRoles().length === 0) {
        <div class="empty-custom">
          <mat-icon>manage_accounts</mat-icon>
          <p>{{ 'ADMIN.noCustomRolesDesc' | translate }}</p>
        </div>
      } @else {
        <div class="custom-role-grid">
          @for (cr of customRoles(); track cr._id) {
            <div class="custom-role-card">
              <div class="cr-accent" [style.background]="cr.color"></div>
              <div class="cr-body">
                <div class="cr-top">
                  <div class="cr-dot" [style.background]="cr.color"></div>
                  <span class="cr-name">{{ cr.name }}</span>
                  <span class="cr-base" [style.color]="baseColor(cr.baseRole)">{{ baseLabel(cr.baseRole) }}</span>
                  <button mat-icon-button [matMenuTriggerFor]="crMenu" class="cr-menu-btn"
                          (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #crMenu="matMenu">
                    <button mat-menu-item (click)="openEdit(cr)">
                      <mat-icon>edit</mat-icon> {{ 'COMMON.edit' | translate }}
                    </button>
                    <button mat-menu-item class="delete-item" (click)="deleteRole(cr)">
                      <mat-icon>delete</mat-icon> {{ 'COMMON.delete' | translate }}
                    </button>
                  </mat-menu>
                </div>
                @if (cr.description) {
                  <p class="cr-desc">{{ cr.description }}</p>
                }
                <div class="cr-perms">
                  {{ cr.permissions.length }} permission{{ cr.permissions.length !== 1 ? 's' : '' }}
                  @for (p of cr.permissions.slice(0, 5); track p) {
                    <span class="perm-chip">{{ p }}</span>
                  }
                  @if (cr.permissions.length > 5) {
                    <span class="perm-more">+{{ cr.permissions.length - 5 }} more</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <mat-divider style="margin: 32px 0 28px"></mat-divider>

      <!-- ── System Roles Matrix ───────────────────────────── -->
      <div class="section-header" style="margin-top: 8px">
        <div class="section-title">
          <mat-icon>table_chart</mat-icon>
          {{ 'ADMIN.systemRolePerms' | translate }}
        </div>
        @if (systemRolesDirty()) {
          <button mat-raised-button color="primary" (click)="saveSystemRoles()" [disabled]="savingSystemRoles()">
            <mat-icon>save</mat-icon> {{ 'ADMIN.saveChanges' | translate }}
          </button>
        }
      </div>

      <!-- Role summary cards -->
      <div class="role-cards">
        @for (role of roles; track role.key) {
          <div class="role-card">
            <div class="role-icon" [style.background]="role.color + '18'" [style.color]="role.color">
              <mat-icon>{{ role.icon }}</mat-icon>
            </div>
            <div class="role-name">{{ role.label }}</div>
            <div class="role-count">{{ sysPermCount(role.key) }} {{ 'ADMIN.permissionsCount' | translate }}</div>
            @if (isOverridden(role.key)) {
              <span class="override-badge">{{ 'ADMIN.customized' | translate }}</span>
            }
          </div>
        }
      </div>

      <!-- Permissions matrix -->
      <div class="matrix-card">
        @for (category of categories; track category) {
          <div class="category-block">
            <div class="category-header">
              <mat-icon>{{ categoryIcon(category) }}</mat-icon>
              {{ category }}
            </div>

            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="feature-col">{{ 'ADMIN.feature' | translate }}</th>
                  @for (role of roles; track role.key) {
                    <th class="role-col">
                      <span [style.color]="role.color">{{ role.label }}</span>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (perm of permsForCategory(category); track perm.key) {
                  <tr>
                    <td class="feature-cell">{{ perm.feature }}</td>
                    @for (role of roles; track role.key) {
                      <td class="check-cell">
                        <mat-checkbox [checked]="hasSysPerm(role.key, perm.key)"
                                      (change)="toggleSysPerm(role.key, perm.key, $event.checked)"
                                      [color]="'primary'" />
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <mat-divider />
        }
      </div>

      <!-- Legend / actions -->
      <div class="legend">
        @for (role of roles; track role.key) {
          @if (isOverridden(role.key)) {
            <button mat-stroked-button class="reset-btn" (click)="resetRole(role.key)">
              <mat-icon>restart_alt</mat-icon> Reset {{ role.label }}
            </button>
          }
        }
        <span class="legend-note">{{ 'ADMIN.changesApplyOnLogin' | translate }}</span>
      </div>
    </div>
  `,
  styles: [`
    .roles-page { padding: 32px; max-width: 1100px; }

    .page-header {
      margin-bottom: 24px;
      h1 { font-size: 28px; color: var(--artes-primary); margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .section-header {
      display: flex; align-items: center; margin-bottom: 16px;
    }

    .section-title {
      display: flex; align-items: center; gap: 8px; flex: 1;
      font-size: 16px; font-weight: 700; color: var(--artes-primary);
      mat-icon { color: var(--artes-accent); font-size: 20px; }
    }

    .loading-row {
      display: flex; justify-content: center; padding: 32px;
    }

    .empty-custom {
      display: flex; flex-direction: column; align-items: center;
      padding: 40px; gap: 12px; color: #9aa5b4; text-align: center;
      background: white; border-radius: 14px; margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c5d0db; }
      p { margin: 0; font-size: 14px; }
    }

    /* Custom role cards */
    .custom-role-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px; margin-bottom: 8px;
    }

    .custom-role-card {
      background: white; border-radius: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden; display: flex; flex-direction: row;
    }

    .cr-accent { width: 5px; flex-shrink: 0; }

    .cr-body { flex: 1; padding: 14px 12px 12px 14px; min-width: 0; }

    .cr-top {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
    }

    .cr-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }

    .cr-name {
      font-size: 14px; font-weight: 700; color: var(--artes-primary); flex: 1; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .cr-base {
      font-size: 11px; font-weight: 600; background: #f0f4f8;
      padding: 2px 8px; border-radius: 999px; white-space: nowrap;
    }

    .cr-menu-btn { width: 28px; height: 28px; flex-shrink: 0; }

    .cr-desc { font-size: 12px; color: #5a6a7e; margin: 0 0 8px; line-height: 1.4; }

    .cr-perms { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

    .perm-chip {
      font-size: 10px; background: var(--artes-bg); color: var(--artes-accent);
      padding: 2px 6px; border-radius: 4px; white-space: nowrap;
    }

    .perm-more {
      font-size: 10px; color: #9aa5b4; padding: 2px 4px;
    }

    ::ng-deep .delete-item { color: #dc2626 !important;
      mat-icon { color: #dc2626 !important; }
    }

    /* System roles section */
    .role-cards {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;
    }

    .role-card {
      background: white; border-radius: 14px; padding: 20px 16px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }

    .role-icon {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 22px; }
    }

    .role-name  { font-size: 13px; font-weight: 600; color: var(--artes-primary); }
    .role-count { font-size: 11px; color: #9aa5b4; }

    .matrix-card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .category-block { padding: 0; }

    .category-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 20px; background: #f8fafc;
      font-size: 13px; font-weight: 600; color: var(--artes-primary);
      mat-icon { font-size: 18px; color: var(--artes-accent); }
    }

    .matrix-table {
      width: 100%; border-collapse: collapse;

      th, td { padding: 10px 16px; text-align: center; }
      th { font-size: 12px; font-weight: 600; border-bottom: 1px solid #f0f4f8; }

      .feature-col { text-align: left; width: 36%; }
      .role-col    { width: 12.8%; }

      tbody tr:hover { background: #fafbfc; }
      tr + tr td    { border-top: 1px solid #f0f4f8; }
    }

    .feature-cell { font-size: 13px; color: #374151; text-align: left; }
    .check-cell { font-size: 0; }

    .check {
      display: inline-flex;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    .cross {
      display: inline-flex; color: #d1d5db;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .legend {
      display: flex; align-items: center; gap: 24px; padding: 16px 0; margin-top: 8px;
      font-size: 13px; color: #5a6a7e; flex-wrap: wrap;
    }

    .override-badge {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      background: #FFF8E6; color: #b07800; padding: 2px 6px; border-radius: 4px;
    }
    .reset-btn { font-size: 12px; color: #9aa5b4; }
    .legend-note { margin-left: auto; font-size: 12px; color: #b4bec8; font-style: italic; }
  `],
})
export class RoleManagementComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  roles = ROLES;
  categories = CATEGORIES;

  customRoles = signal<CustomRole[]>([]);
  loadingCustom = signal(true);

  // System role permissions (per-org, editable)
  private sysRoles = signal<Record<string, SystemRoleData>>({});
  private sysRoleEdits = signal<Record<string, Set<string>>>({});
  systemRolesDirty = signal(false);
  savingSystemRoles = signal(false);

  private readonly BASE_ROLE_META: Record<string, { label: string; color: string }> = {
    admin:      { label: 'Admin',            color: '#1B2A47' },
    hr_manager: { label: 'HR Manager',       color: '#2080b0' },
    manager:    { label: 'Manager',          color: '#b07800' },
    coach:      { label: 'Coach',            color: '#1a9678' },
    employee:   { label: 'Employee',         color: '#7c5cbf' },
    coachee:    { label: 'External Coachee', color: '#5a6a7e' },
  };

  ngOnInit(): void {
    this.loadCustomRoles();
    this.loadSystemRoles();
  }

  // ── System roles ──────────────────────────────────────────────

  loadSystemRoles(): void {
    this.api.get<Record<string, SystemRoleData>>('/roles/system-roles').subscribe({
      next: (data) => {
        this.sysRoles.set(data);
        const edits: Record<string, Set<string>> = {};
        for (const [role, info] of Object.entries(data)) {
          edits[role] = new Set(info.permissions);
        }
        this.sysRoleEdits.set(edits);
        this.systemRolesDirty.set(false);
      },
    });
  }

  hasSysPerm(role: string, key: string): boolean {
    return this.sysRoleEdits()[role]?.has(key) ?? false;
  }

  toggleSysPerm(role: string, key: string, checked: boolean): void {
    const edits = { ...this.sysRoleEdits() };
    const set = new Set(edits[role] ?? []);
    checked ? set.add(key) : set.delete(key);
    edits[role] = set;
    this.sysRoleEdits.set(edits);
    this.systemRolesDirty.set(true);
  }

  sysPermCount(role: string): number {
    return this.sysRoleEdits()[role]?.size ?? 0;
  }

  isOverridden(role: string): boolean {
    return this.sysRoles()[role]?.isOverridden ?? false;
  }

  saveSystemRoles(): void {
    this.savingSystemRoles.set(true);
    const edits = this.sysRoleEdits();
    const requests = Object.entries(edits).map(([role, permSet]) =>
      this.api.put(`/roles/system-roles/${role}`, { permissions: [...permSet] }).toPromise()
    );
    Promise.all(requests).then(() => {
      this.savingSystemRoles.set(false);
      this.systemRolesDirty.set(false);
      this.loadSystemRoles();
      this.snackBar.open(this.translate.instant('ADMIN.systemRolePermsSaved'), this.translate.instant('COMMON.ok'), { duration: 4000 });
    }).catch(() => {
      this.savingSystemRoles.set(false);
      this.snackBar.open(this.translate.instant('ADMIN.settingsFailed'), this.translate.instant('COMMON.dismiss'), { duration: 3000 });
    });
  }

  resetRole(role: string): void {
    if (!confirm(`Reset ${this.baseLabel(role)} to default permissions?`)) return;
    this.api.delete(`/roles/system-roles/${role}`).subscribe({
      next: () => {
        this.loadSystemRoles();
        this.snackBar.open(`${this.baseLabel(role)} reset to defaults`, 'OK', { duration: 3000 });
      },
    });
  }

  permsForCategory = (cat: string) => PERM_ROWS.filter((p) => p.category === cat);

  categoryIcon = (cat: string): string => {
    if (cat.includes('Administration'))  return 'admin_panel_settings';
    if (cat.includes('Conflict'))        return 'warning_amber';
    if (cat.includes('Neuro'))           return 'psychology';
    if (cat.includes('Coach'))           return 'psychology_alt';
    if (cat.includes('Succession'))      return 'trending_up';
    if (cat.includes('Communication'))   return 'forum';
    return 'category';
  };

  // ── Custom roles ──────────────────────────────────────────────

  loadCustomRoles(): void {
    this.loadingCustom.set(true);
    this.api.get<CustomRole[]>('/roles').subscribe({
      next: (roles) => { this.customRoles.set(roles); this.loadingCustom.set(false); },
      error: () => this.loadingCustom.set(false),
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(RoleDialogComponent, {
      data: null, minWidth: '600px', maxWidth: '720px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((result) => {
      if (result) this.customRoles.update((list) => [...list, result]);
    });
  }

  openEdit(role: CustomRole): void {
    const ref = this.dialog.open(RoleDialogComponent, {
      data: role, minWidth: '600px', maxWidth: '720px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((result) => {
      if (result) this.customRoles.update((list) => list.map((r) => r._id === result._id ? result : r));
    });
  }

  deleteRole(role: CustomRole): void {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    this.api.delete(`/roles/${role._id}`).subscribe({
      next: () => this.customRoles.update((list) => list.filter((r) => r._id !== role._id)),
    });
  }

  baseLabel = (key: string) => this.BASE_ROLE_META[key]?.label ?? key;
  baseColor = (key: string) => this.BASE_ROLE_META[key]?.color ?? '#9aa5b4';
}

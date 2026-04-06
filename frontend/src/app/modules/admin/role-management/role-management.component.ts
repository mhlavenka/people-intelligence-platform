import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/api.service';
import { RoleDialogComponent, CustomRole } from '../role-dialog/role-dialog.component';

interface Permission {
  feature: string;
  category: string;
  admin: boolean;
  hr_manager: boolean;
  manager: boolean;
  coach: boolean;
  coachee: boolean;
}

const PERMISSIONS: Permission[] = [
  // Administration
  { category: 'Administration', feature: 'Manage Users',               admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Manage Organization',        admin: true,  hr_manager: false, manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Manage Intake Templates',    admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'View All Users',             admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Org Chart',                  admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Billing & Subscription',     admin: true,  hr_manager: false, manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Manage Roles',               admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  // Conflict Intelligence
  { category: 'Conflict Intelligence', feature: 'View Dashboard',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Run AI Analysis',     admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Escalate to HR',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'View Responses',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Take Survey',         admin: false, hr_manager: false, manager: false, coach: false, coachee: true  },
  // Neuro-Inclusion
  { category: 'Neuro-Inclusion', feature: 'Run Assessment',            admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Neuro-Inclusion', feature: 'View Results',              admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  // Coach & Interviews
  { category: 'Coach & Interviews', feature: 'Conduct Interviews',     admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: false },
  { category: 'Coach & Interviews', feature: 'View Templates (read)',  admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: false },
  // Leadership & Succession
  { category: 'Leadership & Succession', feature: 'View All IDPs',     admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: false },
  { category: 'Leadership & Succession', feature: 'Generate IDP (AI)', admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: false },
  { category: 'Leadership & Succession', feature: 'View Own IDP',      admin: false, hr_manager: false, manager: false, coach: false, coachee: true  },
  { category: 'Leadership & Succession', feature: 'Update Milestones', admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: true  },
  // Communication
  { category: 'Communication', feature: 'Message Hub',                 admin: true,  hr_manager: true,  manager: true,  coach: true,  coachee: true  },
];

const ROLES = [
  { key: 'admin',      label: 'Admin',      color: '#1B2A47', icon: 'shield' },
  { key: 'hr_manager', label: 'HR Manager', color: '#2080b0', icon: 'manage_accounts' },
  { key: 'manager',    label: 'Manager',    color: '#b07800', icon: 'supervisor_account' },
  { key: 'coach',      label: 'Coach',      color: '#1a9678', icon: 'psychology_alt' },
  { key: 'coachee',    label: 'Employee',   color: '#5a6a7e', icon: 'person' },
];

type RoleKey = 'admin' | 'hr_manager' | 'manager' | 'coach' | 'coachee';

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
  ],
  template: `
    <div class="roles-page">
      <div class="page-header">
        <div>
          <h1>Role Permissions</h1>
          <p>System role capabilities and custom roles for your organisation</p>
        </div>
      </div>

      <!-- ── Custom Roles ─────────────────────────────────── -->
      <div class="section-header">
        <div class="section-title">
          <mat-icon>manage_accounts</mat-icon>
          Custom Roles
        </div>
        <button mat-raised-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New Role
        </button>
      </div>

      @if (loadingCustom()) {
        <div class="loading-row"><mat-spinner diameter="28" /></div>
      } @else if (customRoles().length === 0) {
        <div class="empty-custom">
          <mat-icon>manage_accounts</mat-icon>
          <p>No custom roles yet. Create one to assign fine-grained permissions to users.</p>
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
                      <mat-icon>edit</mat-icon> Edit
                    </button>
                    <button mat-menu-item class="delete-item" (click)="deleteRole(cr)">
                      <mat-icon>delete</mat-icon> Delete
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
      <div class="section-title" style="margin-bottom: 16px">
        <mat-icon>table_chart</mat-icon>
        System Role Permissions
      </div>

      <!-- Role summary cards -->
      <div class="role-cards">
        @for (role of roles; track role.key) {
          <div class="role-card">
            <div class="role-icon" [style.background]="role.color + '18'"
                                   [style.color]="role.color">
              <mat-icon>{{ role.icon }}</mat-icon>
            </div>
            <div class="role-name">{{ role.label }}</div>
            <div class="role-count">{{ permissionCount(role.key) }} permissions</div>
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
                  <th class="feature-col">Feature</th>
                  @for (role of roles; track role.key) {
                    <th class="role-col">
                      <span [style.color]="role.color">{{ role.label }}</span>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (perm of permsForCategory(category); track perm.feature) {
                  <tr>
                    <td class="feature-cell">{{ perm.feature }}</td>
                    @for (role of roles; track role.key) {
                      <td class="check-cell">
                        @if (hasPermission(perm, role.key)) {
                          <span class="check" [style.color]="role.color"
                                [matTooltip]="role.label + ' can: ' + perm.feature">
                            <mat-icon>check_circle</mat-icon>
                          </span>
                        } @else {
                          <span class="cross">
                            <mat-icon>remove</mat-icon>
                          </span>
                        }
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

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item">
          <mat-icon class="check-icon">check_circle</mat-icon> Has permission
        </span>
        <span class="legend-item">
          <mat-icon class="cross-icon">remove</mat-icon> No access
        </span>
        <span class="legend-note">System role permissions are fixed and cannot be changed.</span>
      </div>
    </div>
  `,
  styles: [`
    .roles-page { padding: 32px; max-width: 1100px; }

    .page-header {
      margin-bottom: 24px;
      h1 { font-size: 28px; color: #1B2A47; margin: 0 0 4px; }
      p  { color: #5a6a7e; margin: 0; }
    }

    .section-header {
      display: flex; align-items: center; margin-bottom: 16px;
    }

    .section-title {
      display: flex; align-items: center; gap: 8px; flex: 1;
      font-size: 16px; font-weight: 700; color: #1B2A47;
      mat-icon { color: #3A9FD6; font-size: 20px; }
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
      font-size: 14px; font-weight: 700; color: #1B2A47; flex: 1; min-width: 0;
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
      font-size: 10px; background: #EBF5FB; color: #3A9FD6;
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

    .role-name  { font-size: 13px; font-weight: 600; color: #1B2A47; }
    .role-count { font-size: 11px; color: #9aa5b4; }

    .matrix-card {
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden;
    }

    .category-block { padding: 0; }

    .category-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 20px; background: #f8fafc;
      font-size: 13px; font-weight: 600; color: #1B2A47;
      mat-icon { font-size: 18px; color: #3A9FD6; }
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

    .legend-item { display: flex; align-items: center; gap: 6px; }
    .check-icon  { font-size: 18px; color: #27C4A0; }
    .cross-icon  { font-size: 18px; color: #d1d5db; }
    .legend-note { margin-left: auto; font-size: 12px; color: #b4bec8; font-style: italic; }
  `],
})
export class RoleManagementComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  roles = ROLES;
  categories = [...new Set(PERMISSIONS.map((p) => p.category))];

  customRoles = signal<CustomRole[]>([]);
  loadingCustom = signal(true);

  private readonly BASE_ROLE_META: Record<string, { label: string; color: string }> = {
    admin:      { label: 'Admin',      color: '#1B2A47' },
    hr_manager: { label: 'HR Manager', color: '#2080b0' },
    manager:    { label: 'Manager',    color: '#b07800' },
    coach:      { label: 'Coach',      color: '#1a9678' },
    coachee:    { label: 'Employee',   color: '#5a6a7e' },
  };

  ngOnInit(): void {
    this.loadCustomRoles();
  }

  loadCustomRoles(): void {
    this.loadingCustom.set(true);
    this.api.get<CustomRole[]>('/roles').subscribe({
      next: (roles) => { this.customRoles.set(roles); this.loadingCustom.set(false); },
      error: () => this.loadingCustom.set(false),
    });
  }

  openCreate(): void {
    const ref = this.dialog.open(RoleDialogComponent, {
      data: null,
      minWidth: '600px', maxWidth: '720px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((result) => {
      if (result) { this.customRoles.update((list) => [...list, result]); }
    });
  }

  openEdit(role: CustomRole): void {
    const ref = this.dialog.open(RoleDialogComponent, {
      data: role,
      minWidth: '600px', maxWidth: '720px', maxHeight: '92vh',
    });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.customRoles.update((list) =>
          list.map((r) => (r._id === result._id ? result : r))
        );
      }
    });
  }

  deleteRole(role: CustomRole): void {
    if (!confirm(`Delete role "${role.name}"? Users assigned to it will revert to their base role.`)) { return; }
    this.api.delete(`/roles/${role._id}`).subscribe({
      next: () => { this.customRoles.update((list) => list.filter((r) => r._id !== role._id)); },
    });
  }

  baseLabel = (key: string) => this.BASE_ROLE_META[key]?.label ?? key;
  baseColor = (key: string) => this.BASE_ROLE_META[key]?.color ?? '#9aa5b4';

  permsForCategory = (cat: string) => PERMISSIONS.filter((p) => p.category === cat);

  hasPermission = (perm: Permission, roleKey: string) => perm[roleKey as RoleKey] === true;

  permissionCount = (roleKey: string) =>
    PERMISSIONS.filter((p) => p[roleKey as RoleKey]).length;

  categoryIcon = (cat: string): string => {
    if (cat.includes('Administration'))  return 'admin_panel_settings';
    if (cat.includes('Conflict'))        return 'warning_amber';
    if (cat.includes('Neuro'))           return 'psychology';
    if (cat.includes('Coach'))           return 'psychology_alt';
    if (cat.includes('Succession'))      return 'trending_up';
    if (cat.includes('Communication'))   return 'forum';
    return 'category';
  };
}

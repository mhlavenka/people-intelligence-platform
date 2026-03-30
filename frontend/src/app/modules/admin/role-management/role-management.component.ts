import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  // User & org management
  { category: 'Administration', feature: 'Manage Users',               admin: true,  hr_manager: false, manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Manage Organization',        admin: true,  hr_manager: false, manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'Manage Survey Templates',    admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Administration', feature: 'View All Users',             admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  // Conflict Intelligence
  { category: 'Conflict Intelligence', feature: 'View Dashboard',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Run AI Analysis',     admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Escalate to HR',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'View Responses',      admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Conflict Intelligence', feature: 'Take Survey',         admin: false, hr_manager: false, manager: false, coach: false, coachee: true  },
  // Neuro-Inclusion
  { category: 'Neuro-Inclusion', feature: 'Run Assessment',            admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  { category: 'Neuro-Inclusion', feature: 'View Results',              admin: true,  hr_manager: true,  manager: true,  coach: false, coachee: false },
  // Succession & IDP
  { category: 'Leadership & Succession', feature: 'View All IDPs',     admin: true,  hr_manager: true,  manager: false, coach: false, coachee: false },
  { category: 'Leadership & Succession', feature: 'Generate IDP (AI)', admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: false },
  { category: 'Leadership & Succession', feature: 'View Own IDP',      admin: false, hr_manager: false, manager: false, coach: false, coachee: true  },
  { category: 'Leadership & Succession', feature: 'Update Milestones', admin: true,  hr_manager: true,  manager: false, coach: true,  coachee: true  },
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
  imports: [CommonModule, MatIconModule, MatDividerModule, MatTooltipModule],
  template: `
    <div class="roles-page">
      <div class="page-header">
        <div>
          <h1>Role Permissions</h1>
          <p>Overview of capabilities for each role across all modules</p>
        </div>
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
            <div class="role-count">
              {{ permissionCount(role.key) }} permissions
            </div>
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
      display: flex; gap: 24px; padding: 16px 0; margin-top: 8px;
      font-size: 13px; color: #5a6a7e;
    }

    .legend-item { display: flex; align-items: center; gap: 6px; }
    .check-icon  { font-size: 18px; color: #27C4A0; }
    .cross-icon  { font-size: 18px; color: #d1d5db; }
  `],
})
export class RoleManagementComponent {
  roles = ROLES;

  categories = [...new Set(PERMISSIONS.map((p) => p.category))];

  permsForCategory = (cat: string) => PERMISSIONS.filter((p) => p.category === cat);

  hasPermission = (perm: Permission, roleKey: string) =>
    perm[roleKey as RoleKey] === true;

  permissionCount = (roleKey: string) =>
    PERMISSIONS.filter((p) => p[roleKey as RoleKey]).length;

  categoryIcon = (cat: string): string => {
    if (cat.includes('Administration'))  return 'admin_panel_settings';
    if (cat.includes('Conflict'))        return 'warning_amber';
    if (cat.includes('Neuro'))           return 'psychology';
    if (cat.includes('Succession'))      return 'trending_up';
    return 'category';
  };
}

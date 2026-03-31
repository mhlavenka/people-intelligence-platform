import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { systemAdminGuard } from './core/system-admin.guard';
import { roleGuard } from './core/role.guard';

const ADMIN_HR   = ['admin', 'hr_manager']                     as const;
const ADMIN_ONLY = ['admin']                                    as const;
const OPS        = ['admin', 'hr_manager', 'manager']          as const;
const SUCCESSION = ['admin', 'hr_manager', 'coach', 'coachee'] as const;

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./modules/dashboard/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ── Visible to all authenticated non-system-admin users ───────────────
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./modules/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },

      // ── Operations modules: admin, hr_manager, manager ────────────────────
      {
        path: 'conflict',
        canActivate: [roleGuard([...OPS])],
        loadComponent: () =>
          import('./modules/conflict/conflict-dashboard/conflict-dashboard.component').then(
            (m) => m.ConflictDashboardComponent
          ),
      },
      {
        path: 'neuroinclusion',
        canActivate: [roleGuard([...OPS])],
        loadComponent: () =>
          import('./modules/neuroinclusion/assessment/neuroinclusion-assessment.component').then(
            (m) => m.NeuroinclustionAssessmentComponent
          ),
      },

      // ── Leadership & Succession: admin, hr_manager, coach, coachee ────────
      {
        path: 'succession',
        canActivate: [roleGuard([...SUCCESSION])],
        loadComponent: () =>
          import('./modules/succession/idp-view/idp-view.component').then(
            (m) => m.IDPViewComponent
          ),
      },

      // ── Survey take: coachees (and managers who assign them) ──────────────
      {
        path: 'survey/:id',
        loadComponent: () =>
          import('./modules/survey/survey-take/survey-take.component').then(
            (m) => m.SurveyTakeComponent
          ),
      },

      // ── Administration: admin & hr_manager ───────────────────────────────
      {
        path: 'surveys',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/admin/user-management/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
      },
      {
        path: 'admin/roles',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/admin/role-management/role-management.component').then(
            (m) => m.RoleManagementComponent
          ),
      },

      // ── Administration: admin only ────────────────────────────────────────
      {
        path: 'admin/organization',
        canActivate: [roleGuard([...ADMIN_ONLY])],
        loadComponent: () =>
          import('./modules/admin/organization-settings/organization-settings.component').then(
            (m) => m.OrganizationSettingsComponent
          ),
      },
      {
        path: 'billing',
        canActivate: [roleGuard([...ADMIN_ONLY])],
        loadComponent: () =>
          import('./modules/billing/billing.component').then(
            (m) => m.BillingComponent
          ),
      },
    ],
  },
  {
    path: 'system-admin',
    canActivate: [systemAdminGuard],
    loadComponent: () =>
      import('./modules/system-admin/system-admin-shell/system-admin-shell.component').then(
        (m) => m.SystemAdminShellComponent
      ),
    children: [
      { path: '', redirectTo: 'organizations', pathMatch: 'full' },
      {
        path: 'organizations',
        loadComponent: () =>
          import('./modules/system-admin/organizations/organizations.component').then(
            (m) => m.OrganizationsComponent
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./modules/system-admin/invoices/invoices.component').then(
            (m) => m.InvoicesComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

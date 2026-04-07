import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { systemAdminGuard } from './core/system-admin.guard';
import { roleGuard } from './core/role.guard';

const ADMIN_HR   = ['admin', 'hr_manager']                              as const;
const ADMIN_ONLY = ['admin']                                             as const;
const OPS        = ['admin', 'hr_manager', 'manager']                   as const;
const SUCCESSION = ['admin', 'hr_manager', 'coach', 'coachee']          as const;
const COACH_ROLE = ['coach']                                             as const;
const INTAKES    = ['admin', 'hr_manager', 'coach']                     as const;

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
          import('./modules/conflict/conflict-shell/conflict-shell.component').then(
            (m) => m.ConflictShellComponent
          ),
        children: [
          { path: '', redirectTo: 'analysis', pathMatch: 'full' },
          {
            path: 'analysis',
            loadComponent: () =>
              import('./modules/conflict/conflict-analysis/conflict-analysis.component').then(
                (m) => m.ConflictAnalysisComponent
              ),
          },
          {
            path: 'skill-development',
            loadComponent: () =>
              import('./modules/conflict/conflict-skill-dev/conflict-skill-dev.component').then(
                (m) => m.ConflictSkillDevComponent
              ),
          },
          {
            path: 'skill-building',
            loadComponent: () =>
              import('./modules/conflict/conflict-skill-building/conflict-skill-building.component').then(
                (m) => m.ConflictSkillBuildingComponent
              ),
          },
        ],
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
        path: 'intake/:id',
        loadComponent: () =>
          import('./modules/survey/survey-take/survey-take.component').then(
            (m) => m.SurveyTakeComponent
          ),
      },
      // Legacy redirect: keep old /survey/:id links working
      { path: 'survey/:id', redirectTo: 'intake/:id', pathMatch: 'full' },

      // ── Administration: admin & hr_manager ───────────────────────────────
      {
        path: 'org-chart',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/org-chart/org-chart.component').then(
            (m) => m.OrgChartComponent
          ),
      },
      {
        path: 'coach/interview',
        canActivate: [roleGuard([...COACH_ROLE])],
        loadComponent: () =>
          import('./modules/coach/coach-interview.component').then(
            (m) => m.CoachInterviewComponent
          ),
      },
      {
        path: 'intakes',
        canActivate: [roleGuard([...INTAKES])],
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      // Legacy redirect
      { path: 'surveys', redirectTo: 'intakes', pathMatch: 'full' },
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

      // ── Coaching ────────────────────────────────────────────────────────────
      {
        path: 'coaching',
        canActivate: [roleGuard([...ADMIN_HR, 'coach', 'coachee'])],
        loadComponent: () =>
          import('./modules/coaching/coaching-dashboard/coaching-dashboard.component').then(
            (m) => m.CoachingDashboardComponent
          ),
      },
      {
        path: 'coaching/:id',
        canActivate: [roleGuard([...ADMIN_HR, 'coach', 'coachee'])],
        loadComponent: () =>
          import('./modules/coaching/engagement-detail/engagement-detail.component').then(
            (m) => m.EngagementDetailComponent
          ),
      },

      // ── EQi Import ─────────────────────────────────────────────────────────
      {
        path: 'eq-import',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/eq-import/eq-import-wizard/eq-import-wizard.component').then(
            (m) => m.EqImportWizardComponent
          ),
      },
      {
        path: 'eq-import/records',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/eq-import/eq-records/eq-records.component').then(
            (m) => m.EqRecordsComponent
          ),
      },
      {
        path: 'eq-import/audit',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/eq-import/eq-import-audit/eq-import-audit.component').then(
            (m) => m.EqImportAuditComponent
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
        path: 'admin/reports',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/admin/reports/reports.component').then(
            (m) => m.OrgReportsComponent
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
      {
        path: 'plans',
        loadComponent: () =>
          import('./modules/system-admin/plans/plans.component').then(
            (m) => m.PlansComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./modules/system-admin/reports/reports.component').then(
            (m) => m.SaReportsComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/system-admin/app-settings/app-settings.component').then(
            (m) => m.AppSettingsComponent
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./modules/profile/profile.component').then(
            (m) => m.ProfileComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

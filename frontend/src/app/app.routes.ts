import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

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
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/dashboard/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'conflict',
        loadComponent: () =>
          import('./modules/conflict/conflict-dashboard/conflict-dashboard.component').then(
            (m) => m.ConflictDashboardComponent
          ),
      },
      {
        path: 'neuroinclusion',
        loadComponent: () =>
          import('./modules/neuroinclusion/assessment/neuroinclusion-assessment.component').then(
            (m) => m.NeuroinclustionAssessmentComponent
          ),
      },
      {
        path: 'succession',
        loadComponent: () =>
          import('./modules/succession/idp-view/idp-view.component').then(
            (m) => m.IDPViewComponent
          ),
      },
      {
        path: 'admin/organization',
        loadComponent: () =>
          import('./modules/admin/organization-settings/organization-settings.component').then(
            (m) => m.OrganizationSettingsComponent
          ),
      },
      {
        path: 'admin/roles',
        loadComponent: () =>
          import('./modules/admin/role-management/role-management.component').then(
            (m) => m.RoleManagementComponent
          ),
      },
      {
        path: 'admin/users',
        loadComponent: () =>
          import('./modules/admin/user-management/user-management.component').then(
            (m) => m.UserManagementComponent
          ),
      },
      {
        path: 'surveys',
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      {
        path: 'survey/:id',
        loadComponent: () =>
          import('./modules/survey/survey-take/survey-take.component').then(
            (m) => m.SurveyTakeComponent
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
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];

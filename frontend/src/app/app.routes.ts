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
          import('./modules/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'My Profile', icon: 'person' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/dashboard/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent
          ),
        data: { title: 'Settings', icon: 'settings' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];

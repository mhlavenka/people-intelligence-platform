import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./pages/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    loadComponent: () =>
      import('./tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [authGuard],
    children: [
      {
        path: 'sessions',
        loadComponent: () =>
          import('./pages/sessions/session-list.page').then((m) => m.SessionListPage),
      },
      {
        path: 'sessions/:id',
        loadComponent: () =>
          import('./pages/sessions/session-detail.page').then((m) => m.SessionDetailPage),
      },
      {
        path: 'surveys',
        loadComponent: () =>
          import('./pages/surveys/survey-list.page').then((m) => m.SurveyListPage),
      },
      {
        path: 'surveys/:id',
        loadComponent: () =>
          import('./pages/surveys/survey-take.page').then((m) => m.SurveyTakePage),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./pages/bookings/booking-list.page').then((m) => m.BookingListPage),
      },
      {
        path: 'bookings/new',
        loadComponent: () =>
          import('./pages/bookings/booking-new.page').then((m) => m.BookingNewPage),
      },
      {
        path: 'idp',
        loadComponent: () =>
          import('./pages/idp/idp-view.page').then((m) => m.IdpViewPage),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications/notification-list.page').then(
            (m) => m.NotificationListPage
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile.page').then((m) => m.ProfilePage),
      },
      { path: '', redirectTo: 'sessions', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
];

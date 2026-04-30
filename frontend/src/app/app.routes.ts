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
        canActivate: [roleGuard([...OPS, 'coach'])],
        loadComponent: () =>
          import('./modules/conflict/conflict-shell/conflict-shell.component').then(
            (m) => m.ConflictShellComponent
          ),
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          {
            path: 'dashboard',
            loadComponent: () =>
              import('./modules/conflict/conflict-dashboard-home/conflict-dashboard-home.component').then(
                (m) => m.ConflictDashboardHomeComponent
              ),
          },
          {
            path: 'analysis',
            loadComponent: () =>
              import('./modules/conflict/conflict-analysis/conflict-analysis.component').then(
                (m) => m.ConflictAnalysisComponent
              ),
          },
          {
            path: 'analysis/:id',
            loadComponent: () =>
              import('./modules/conflict/conflict-detail/conflict-detail.component').then(
                (m) => m.ConflictDetailComponent
              ),
          },
          {
            path: 'skill-development',
            loadComponent: () =>
              import('./modules/conflict/conflict-skill-dev/conflict-skill-dev.component').then(
                (m) => m.ConflictSkillDevComponent
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
        path: 'intakes/take',
        loadComponent: () =>
          import('./modules/survey/take-survey-list/take-survey-list.component').then(
            (m) => m.TakeSurveyListComponent
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
      {
        path: 'intakes/surveys',
        canActivate: [roleGuard([...INTAKES])],
        data: { typeFilter: 'survey' },
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      {
        path: 'intakes/interviews',
        canActivate: [roleGuard([...INTAKES])],
        data: { typeFilter: 'interview' },
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      {
        path: 'intakes/assessments',
        canActivate: [roleGuard([...INTAKES])],
        data: { typeFilter: 'assessment' },
        loadComponent: () =>
          import('./modules/survey/survey-management/survey-management.component').then(
            (m) => m.SurveyManagementComponent
          ),
      },
      {
        path: 'intakes/ai-generated',
        canActivate: [roleGuard([...INTAKES])],
        data: { typeFilter: 'ai_generated' },
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
        path: 'coaching/calendar',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/coaching/coaching-calendar/coaching-calendar.component').then(
            (m) => m.CoachingCalendarComponent
          ),
      },
      {
        path: 'coaching/billing/:coacheeId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/coaching/coachee-billing/coachee-billing.component').then(
            (m) => m.CoacheeBillingComponent
          ),
      },
      {
        path: 'coaching/coachees',
        canActivate: [roleGuard(['coach'])],
        loadComponent: () =>
          import('./modules/coaching/coachees-list/coachees-list.component').then(
            (m) => m.CoacheesListComponent
          ),
      },
      {
        path: 'coaching/icf-hours',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/coaching/icf-hours/icf-hours-dashboard.component').then(
            (m) => m.IcfHoursDashboardComponent
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

      // ── Sponsors ──────────────────────────────────────────────────────────
      {
        path: 'sponsors',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/sponsor/sponsor-list/sponsor-list.component').then(
            (m) => m.SponsorListComponent
          ),
      },
      {
        path: 'billing/sponsors/:id',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/sponsor/sponsor-billing/sponsor-billing.component').then(
            (m) => m.SponsorBillingComponent
          ),
      },
      {
        path: 'billing/sponsors/:sponsorId/invoices/:invoiceId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/sponsor/sponsor-invoice-view/sponsor-invoice-view.component').then(
            (m) => m.SponsorInvoiceViewComponent
          ),
      },

      // ── Coaching Journal ──────────────────────────────────────────────────
      {
        path: 'journal',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/journal-dashboard/journal-dashboard.component').then(
            (m) => m.JournalDashboardComponent
          ),
      },
      // Coachee-facing journal — pre + post notes per session
      {
        path: 'my-journal/engagement/:engagementId',
        canActivate: [roleGuard(['coachee'])],
        loadComponent: () =>
          import('./modules/journal/coachee-journal/coachee-journal.component').then(
            (m) => m.CoacheeJournalComponent
          ),
      },
      {
        path: 'journal/engagement/:engagementId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/engagement-notes/engagement-notes.component').then(
            (m) => m.EngagementNotesComponent
          ),
      },
      {
        path: 'journal/note/new/:engagementId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/session-note-editor/session-note-editor.component').then(
            (m) => m.SessionNoteEditorComponent
          ),
      },
      {
        path: 'journal/note/:noteId/edit',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/session-note-editor/session-note-editor.component').then(
            (m) => m.SessionNoteEditorComponent
          ),
      },
      {
        path: 'journal/note/:noteId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/session-note-view/session-note-view.component').then(
            (m) => m.SessionNoteViewComponent
          ),
      },
      {
        path: 'journal/reflective',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/reflective-journal/reflective-journal.component').then(
            (m) => m.ReflectiveJournalComponent
          ),
      },
      {
        path: 'journal/reflective/new',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/reflective-editor/reflective-editor.component').then(
            (m) => m.ReflectiveEditorComponent
          ),
      },
      {
        path: 'journal/reflective/:entryId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/reflective-editor/reflective-editor.component').then(
            (m) => m.ReflectiveEditorComponent
          ),
      },
      {
        path: 'journal/insights/:engagementId',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/engagement-insights/engagement-insights.component').then(
            (m) => m.EngagementInsightsComponent
          ),
      },
      {
        path: 'journal/supervision',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/journal/supervision-digest/supervision-digest.component').then(
            (m) => m.SupervisionDigestComponent
          ),
      },

      // ── Booking (coach admin) ──────────────────────────────────────────────
      {
        path: 'booking',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/booking/booking-dashboard/booking-dashboard.component').then(
            (m) => m.BookingDashboardComponent
          ),
      },
      {
        path: 'booking/settings',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/booking/booking-settings/booking-settings.component').then(
            (m) => m.BookingSettingsComponent
          ),
      },
      {
        path: 'booking/global-settings',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/booking/booking-global-settings/booking-global-settings.component').then(
            (m) => m.BookingGlobalSettingsComponent
          ),
      },
      {
        path: 'booking/event-types/:id',
        canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
        loadComponent: () =>
          import('./modules/booking/event-type-editor/event-type-editor.component').then(
            (m) => m.EventTypeEditorComponent
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
        path: 'admin/login-sessions',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/admin/login-sessions/login-sessions.component').then(
            (m) => m.LoginSessionsAdminComponent
          ),
      },
      {
        path: 'admin/activity',
        canActivate: [roleGuard([...ADMIN_HR])],
        loadComponent: () =>
          import('./modules/admin/activity-log/activity-log.component').then(
            (m) => m.ActivityLogComponent
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
        path: 'assessment-hub',
        loadComponent: () =>
          import('./modules/system-admin/assessment-hub/assessment-hub.component').then(
            (m) => m.AssessmentHubComponent
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
  // ── Public booking (no auth) ──────────────────────────────────────────────
  {
    path: 'c/:slug',
    loadComponent: () =>
      import('./modules/booking/coach-landing/coach-landing.component').then(
        (m) => m.CoachLandingComponent
      ),
  },
  {
    path: 'book/:coachSlug',
    loadComponent: () =>
      import('./modules/booking/public-booking/public-booking.component').then(
        (m) => m.PublicBookingComponent
      ),
  },
  {
    path: 'book/:coachSlug/confirmed/:bookingId',
    loadComponent: () =>
      import('./modules/booking/booking-confirm/booking-confirm.component').then(
        (m) => m.BookingConfirmComponent
      ),
  },
  {
    path: 'book/:coachSlug/cancel/:bookingId/:token',
    loadComponent: () =>
      import('./modules/booking/public-booking/public-booking.component').then(
        (m) => m.PublicBookingComponent
      ),
  },
  // ── Legal pages (public, no auth) ──────────────────────────────────────────
  {
    path: 'termsofservice',
    loadComponent: () =>
      import('./modules/legal/terms-of-service.component').then(
        (m) => m.TermsOfServiceComponent
      ),
  },
  {
    path: 'privacystatement',
    loadComponent: () =>
      import('./modules/legal/privacy-statement.component').then(
        (m) => m.PrivacyStatementComponent
      ),
  },
  {
    path: 'eula',
    loadComponent: () =>
      import('./modules/legal/eula.component').then(
        (m) => m.EulaComponent
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  category: string;
  icon: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: 'Administration',
    icon: 'admin_panel_settings',
    permissions: [
      { key: 'MANAGE_USERS',            label: 'Manage Users',            description: 'Create, edit, and deactivate users' },
      { key: 'MANAGE_ORGANIZATION',     label: 'Organization Settings',   description: 'Edit org name, industry, departments' },
      { key: 'MANAGE_INTAKE_TEMPLATES', label: 'Manage Intake Templates', description: 'Create and edit survey/interview templates' },
      { key: 'VIEW_ALL_USERS',          label: 'View All Users',          description: 'See the full user directory' },
      { key: 'VIEW_ORG_CHART',          label: 'Org Chart',               description: 'View and edit the organizational chart' },
      { key: 'MANAGE_BILLING',          label: 'Billing & Subscription',  description: 'View invoices and change plan' },
      { key: 'MANAGE_ROLES',            label: 'Manage Roles',            description: 'Create and edit custom roles' },
      { key: 'VIEW_REPORTS',            label: 'View Reports',            description: 'Access organizational reports and analytics' },
    ],
  },
  {
    category: 'Conflict Intelligence',
    icon: 'warning_amber',
    permissions: [
      { key: 'VIEW_CONFLICT_DASHBOARD', label: 'Conflict Dashboard',    description: 'View analyses and risk scores' },
      { key: 'RUN_CONFLICT_ANALYSIS',   label: 'Run AI Analysis',       description: 'Trigger new AI conflict analysis' },
      { key: 'ESCALATE_CONFLICT',       label: 'Escalate to HR',        description: 'Request HR/coach intervention' },
      { key: 'VIEW_CONFLICT_RESPONSES', label: 'View Responses',        description: 'See aggregated survey responses' },
      { key: 'TAKE_SURVEY',             label: 'Take Surveys',          description: 'Complete self-service surveys' },
    ],
  },
  {
    category: 'Neuro-Inclusion',
    icon: 'psychology',
    permissions: [
      { key: 'RUN_NEUROINCLUSION',           label: 'Run Assessment', description: 'Conduct neuro-inclusion assessments' },
      { key: 'VIEW_NEUROINCLUSION_RESULTS',  label: 'View Results',   description: 'View neuro-inclusion results' },
    ],
  },
  {
    category: 'Coaching',
    icon: 'psychology_alt',
    permissions: [
      { key: 'MANAGE_COACHING',       label: 'Manage Coaching',       description: 'Create and manage coaching engagements and sessions' },
      { key: 'CONDUCT_INTERVIEWS',    label: 'Conduct Interviews',    description: 'Lead coach-led interview sessions' },
      { key: 'VIEW_INTAKE_TEMPLATES', label: 'View Templates (read)', description: 'Browse intake templates without editing' },
      { key: 'MANAGE_SPONSORS',       label: 'Manage Sponsors',       description: 'Create and manage coaching sponsors and contracts' },
      { key: 'MANAGE_JOURNAL',        label: 'Manage Journal',        description: 'Create and edit coaching journal entries' },
      { key: 'VIEW_JOURNAL',          label: 'View Journal',          description: 'View coaching journal entries (own only for coachees)' },
      { key: 'IMPORT_EQI',            label: 'Import EQ-i',           description: 'Import and manage EQ-i assessment PDFs' },
    ],
  },
  {
    category: 'Booking & Calendar',
    icon: 'calendar_month',
    permissions: [
      { key: 'MANAGE_BOOKING',    label: 'Manage Booking',    description: 'Manage booking settings, event types, schedules, and import' },
      { key: 'VIEW_BOOKINGS',     label: 'View Bookings',     description: 'View and list bookings' },
      { key: 'MANAGE_CALENDAR',   label: 'Google Calendar',   description: 'Connect and manage Google Calendar integration' },
    ],
  },
  {
    category: 'Leadership & Succession',
    icon: 'trending_up',
    permissions: [
      { key: 'VIEW_ALL_IDPS',         label: 'View All IDPs',       description: 'Access all individual development plans' },
      { key: 'GENERATE_IDP',          label: 'Generate IDP (AI)',   description: 'Create GROW model IDPs with AI' },
      { key: 'VIEW_OWN_IDP',          label: 'View Own IDP',        description: 'See own development plan only' },
      { key: 'UPDATE_IDP_MILESTONES', label: 'Update Milestones',   description: 'Mark milestones complete, add notes' },
    ],
  },
  {
    category: 'Communication',
    icon: 'forum',
    permissions: [
      { key: 'VIEW_HUB', label: 'Message Hub', description: 'Access the internal message hub' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

// Permissions assigned to each system role
export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  system_admin: [...ALL_PERMISSION_KEYS],
  admin: [
    'MANAGE_USERS', 'MANAGE_ORGANIZATION', 'MANAGE_INTAKE_TEMPLATES',
    'VIEW_ALL_USERS', 'VIEW_ORG_CHART', 'MANAGE_BILLING', 'MANAGE_ROLES', 'VIEW_REPORTS',
    'VIEW_CONFLICT_DASHBOARD', 'RUN_CONFLICT_ANALYSIS', 'ESCALATE_CONFLICT', 'VIEW_CONFLICT_RESPONSES',
    'RUN_NEUROINCLUSION', 'VIEW_NEUROINCLUSION_RESULTS',
    'MANAGE_COACHING', 'CONDUCT_INTERVIEWS', 'VIEW_INTAKE_TEMPLATES',
    'MANAGE_SPONSORS', 'MANAGE_JOURNAL', 'VIEW_JOURNAL', 'IMPORT_EQI',
    'MANAGE_BOOKING', 'VIEW_BOOKINGS', 'MANAGE_CALENDAR',
    'VIEW_ALL_IDPS', 'GENERATE_IDP', 'UPDATE_IDP_MILESTONES',
    'VIEW_HUB',
  ],
  hr_manager: [
    'MANAGE_USERS', 'MANAGE_INTAKE_TEMPLATES', 'VIEW_ALL_USERS', 'VIEW_ORG_CHART', 'VIEW_REPORTS',
    'VIEW_CONFLICT_DASHBOARD', 'RUN_CONFLICT_ANALYSIS', 'ESCALATE_CONFLICT', 'VIEW_CONFLICT_RESPONSES',
    'RUN_NEUROINCLUSION', 'VIEW_NEUROINCLUSION_RESULTS',
    'MANAGE_COACHING', 'VIEW_INTAKE_TEMPLATES',
    'MANAGE_SPONSORS', 'MANAGE_JOURNAL', 'VIEW_JOURNAL', 'IMPORT_EQI',
    'VIEW_BOOKINGS',
    'VIEW_ALL_IDPS', 'GENERATE_IDP', 'UPDATE_IDP_MILESTONES',
    'VIEW_HUB',
  ],
  manager: [
    'VIEW_CONFLICT_DASHBOARD', 'ESCALATE_CONFLICT', 'VIEW_CONFLICT_RESPONSES',
    'RUN_NEUROINCLUSION', 'VIEW_NEUROINCLUSION_RESULTS',
    'VIEW_HUB',
  ],
  coach: [
    'RUN_CONFLICT_ANALYSIS', 'VIEW_CONFLICT_DASHBOARD',
    'MANAGE_COACHING', 'CONDUCT_INTERVIEWS',
    'VIEW_INTAKE_TEMPLATES', 'MANAGE_INTAKE_TEMPLATES', 'VIEW_ALL_USERS',
    'MANAGE_SPONSORS', 'MANAGE_JOURNAL', 'VIEW_JOURNAL', 'IMPORT_EQI',
    'MANAGE_BOOKING', 'VIEW_BOOKINGS', 'MANAGE_CALENDAR',
    'VIEW_ALL_IDPS', 'GENERATE_IDP', 'UPDATE_IDP_MILESTONES',
    'VIEW_HUB',
  ],
  coachee: [
    'TAKE_SURVEY', 'VIEW_OWN_IDP', 'VIEW_JOURNAL',
    'VIEW_BOOKINGS',
    'VIEW_HUB',
  ],
  // Default workforce member. Mirrors coachee — coaching-specific surfaces
  // (own IDP / journal) gate themselves on whether a record exists for the
  // user, so an employee with isCoachee=false simply sees empty states.
  employee: [
    'TAKE_SURVEY', 'VIEW_OWN_IDP', 'VIEW_JOURNAL',
    'VIEW_BOOKINGS',
    'VIEW_HUB',
  ],
};

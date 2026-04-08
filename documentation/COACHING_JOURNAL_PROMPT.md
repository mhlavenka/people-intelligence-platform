# Claude Code Prompt — Coaching Journal Feature Module (ARTES Integration)

## Context

This is **not a standalone app**. You are adding a **Coaching Journal** feature to the existing **ARTES** platform — a multi-tenant B2B SaaS built on Node.js / Express / MongoDB / Angular. Do not create a new project, new server, new auth system, or new `.env`. All additions must integrate into the existing codebase following its established patterns.

The journal serves professional coaches (ICF PCC/MCC level). It supports two journal tracks — structured session notes tied to a specific coaching engagement/coachee, and freeform reflective entries for the coach's own professional development — plus AI-powered insights across both.

The journal is a **separate module** but will first be used **within the coaching module**, scoped to a coachee and engagement.

---

## Existing Stack (do not change)

- **Backend**: Node.js 20 + Express + TypeScript strict mode — entry point `backend/src/app.ts`, modular route files in `backend/src/routes/`
- **Database**: MongoDB Atlas via Mongoose — models in `backend/src/models/`, multi-tenant via `organizationId` field on every document
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`) already wired — use existing `ANTHROPIC_API_KEY` from `.env` and existing `backend/src/services/ai.service.ts` with `callClaude(prompt, systemPrompt?, maxTokens?)` (3-retry with exponential backoff)
- **Frontend**: Angular 17+ with standalone components, signals API, lazy-loaded routes in `frontend/src/app/app.routes.ts`
- **Auth**: JWT already implemented — `req.user` is available in all protected routes via `AuthRequest` with `{ userId, organizationId, role }`. The coach's identity is `req.user.userId`. Do not add or modify auth middleware.
- **Middleware**: All routes use `authenticateToken` + `tenantResolver` applied at router level. Role-gating via `requireRole(...roles)` on individual routes.
- **Frontend HTTP**: All API calls go through `ApiService` (`api.get<T>('/path')`, `api.post<T>('/path', body)`) — do not use raw `HttpClient`
- **SCSS**: Global variables in `_variables.scss`. CSS custom properties on `:root`:
  - `--artes-primary: #1B2A47` (navy)
  - `--artes-accent: #3A9FD6` (blue)
  - Green: `#27C4A0`
  - `--artes-bg: #EBF5FB`
  - `--artes-surface: #ffffff`

---

## Existing Coaching Models (do not duplicate)

The coaching module already has these models — the journal builds on top of them:

| Model | Key fields |
|-------|-----------|
| `CoachingEngagement` | organizationId, coacheeId (ref: User), coachId (ref: User), status, sessionsPurchased, sessionsUsed, goals[], startDate, targetEndDate, rebillCoachee, hourlyRate |
| `CoachingSession` | organizationId, engagementId, coacheeId, coachId, date, duration, format ('video'\|'phone'\|'in_person'), coachNotes, sharedNotes, status ('scheduled'\|'completed'\|'cancelled'\|'no_show'), googleEventId |
| `User` | organizationId, firstName, lastName, email, role, department |

**Important**: There is no separate "CoachingClient" model. Coachees are `User` documents with `role: 'coachee'`. Engagements link coach ↔ coachee.

---

## What to Add

### 1. Backend — Two new Mongoose models

Place in `backend/src/models/` alongside existing models. Use TypeScript with Mongoose typed schemas following the same pattern as `CoachingEngagement.model.ts`.

#### `JournalSessionNote.model.ts`

Structured session notes tied to a coaching engagement (and optionally a specific CoachingSession).

```ts
{
  organizationId: ObjectId,         // ref: Organization — multi-tenancy
  coachId: ObjectId,                // ref: User — the logged-in coach
  engagementId: ObjectId,           // ref: CoachingEngagement
  coacheeId: ObjectId,              // ref: User — for quick lookups
  sessionId?: ObjectId,             // ref: CoachingSession — optional link to a scheduled session
  sessionNumber: Number,            // auto-incremented per engagementId
  sessionDate: Date,
  durationMinutes: Number,
  format: enum['in_person', 'video', 'phone'],
  status: enum['draft', 'complete'],  default: 'draft'

  preSession: {
    agenda: String,
    hypotheses: String,
    coachIntention: String
  },

  inSession: {
    openingState: String,
    keyThemes: [String],
    observations: String,
    notableQuotes: [String],
    coachInterventions: String,
    energyShifts: String
  },

  postSession: {
    coachReflection: String,
    whatWorked: String,
    whatToExplore: String,
    clientGrowthEdge: String,
    accountabilityItems: [
      { item: String, dueDate: Date, completed: Boolean }
    ]
  },

  aiSummary: String,
  aiThemes: [String],
  aiGeneratedAt: Date,

  timestamps: true   // createdAt, updatedAt
}
```

#### `JournalReflectiveEntry.model.ts`

Freeform reflective entries for the coach's professional development.

```ts
{
  organizationId: ObjectId,         // ref: Organization
  coachId: ObjectId,                // ref: User
  entryDate: Date,
  title: String,
  body: String,
  mood: enum['energized', 'reflective', 'challenged', 'inspired', 'depleted'],
  tags: [String],
  linkedEngagementIds: [ObjectId],  // ref: CoachingEngagement — soft-link, optional
  isSupervisionReady: Boolean,      default: false

  timestamps: true
}
```

---

### 2. Backend — New route file

Create `backend/src/routes/journal.routes.ts` and register it in `backend/src/app.ts` under the prefix `/api/journal`:

```ts
import journalRoutes from './routes/journal.routes';
app.use('/api/journal', journalRoutes);
```

The route file must follow the existing pattern:
```ts
const router = Router();
router.use(authenticateToken, tenantResolver);
```

All routes require `requireRole('admin', 'hr_manager', 'coach')` — only coaches (and admins/HR who oversee them) can access journal data.

```
// Session Notes (scoped to engagement)
GET    /api/journal/engagements/:engagementId/notes
POST   /api/journal/engagements/:engagementId/notes
GET    /api/journal/notes/:noteId
PUT    /api/journal/notes/:noteId
DELETE /api/journal/notes/:noteId

// AI on session notes
POST   /api/journal/notes/:noteId/ai-summary         // generate or regenerate

// Reflective Journal
GET    /api/journal/reflective
POST   /api/journal/reflective
GET    /api/journal/reflective/:entryId
PUT    /api/journal/reflective/:entryId
DELETE /api/journal/reflective/:entryId

// AI Insights
GET    /api/journal/insights/engagement/:engagementId  // cross-session pattern report
GET    /api/journal/insights/supervision               // supervision prep digest
```

**All queries must be scoped by `organizationId: req.user!.organizationId`.**
Coach-owned data (notes, reflective entries) must also filter by `coachId: req.user!.userId`.

`sessionNumber` auto-increment: on POST to create a note, query `JournalSessionNote.findOne({ engagementId }).sort({ sessionNumber: -1 })` and increment by 1. Default to 1 if none exist.

---

### 3. Backend — AI Service additions

Add coaching journal AI methods to the existing `backend/src/services/ai.service.ts`. Follow the pattern of existing `build*Prompt()` + `callClaude()` methods. Do not create a new service file.

**`buildSessionSummaryPrompt(sessionNote)`**
- Input: all pre/in/post session fields from the note
- Instruct Claude to return JSON: `{ summary: string, themes: string[], growthEdgeMoment: string }`
- `summary`: 3-5 sentence narrative synthesis
- `themes`: 3-6 coaching-relevant tags (e.g. "self-doubt", "boundary-setting", "leadership identity")
- `growthEdgeMoment`: the single most significant shift or insight from the session

**`buildEngagementInsightPrompt(sessionNotes[])`**
- Input: all completed session notes for an engagement
- Return JSON: `{ recurringThemes, growthArc, coachObservations, openThreads, suggestedNextFocus }`

**`buildSupervisionDigestPrompt(reflectiveEntries[], sessionNotes[])`**
- Input: reflective entries with `isSupervisionReady: true` + session notes where `postSession.coachReflection` is non-empty
- Return JSON: `{ coachThemes, crossEngagementPatterns, questionsForSupervisor, developmentAreas }`

All prompts should be coaching-aware — reference ICF core competencies where relevant (presence, active listening, evoking awareness, facilitating growth).

The route handlers call `callClaude()` with the built prompt, parse with `extractJson()`, and cache AI results on the document (`aiSummary`, `aiThemes`, `aiGeneratedAt`).

---

### 4. Frontend — Routes

Register journal routes in `frontend/src/app/app.routes.ts` within the existing authenticated shell, alongside other coaching routes:

```ts
{
  path: 'journal',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/journal-dashboard/journal-dashboard.component')
      .then(m => m.JournalDashboardComponent),
},
{
  path: 'journal/engagement/:engagementId',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/engagement-notes/engagement-notes.component')
      .then(m => m.EngagementNotesComponent),
},
{
  path: 'journal/note/new/:engagementId',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/session-note-editor/session-note-editor.component')
      .then(m => m.SessionNoteEditorComponent),
},
{
  path: 'journal/note/:noteId',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/session-note-view/session-note-view.component')
      .then(m => m.SessionNoteViewComponent),
},
{
  path: 'journal/note/:noteId/edit',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/session-note-editor/session-note-editor.component')
      .then(m => m.SessionNoteEditorComponent),
},
{
  path: 'journal/reflective',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/reflective-journal/reflective-journal.component')
      .then(m => m.ReflectiveJournalComponent),
},
{
  path: 'journal/reflective/new',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/reflective-editor/reflective-editor.component')
      .then(m => m.ReflectiveEditorComponent),
},
{
  path: 'journal/reflective/:entryId',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/reflective-editor/reflective-editor.component')
      .then(m => m.ReflectiveEditorComponent),
},
{
  path: 'journal/insights/:engagementId',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/engagement-insights/engagement-insights.component')
      .then(m => m.EngagementInsightsComponent),
},
{
  path: 'journal/supervision',
  canActivate: [roleGuard([...ADMIN_HR, 'coach'])],
  loadComponent: () =>
    import('./modules/journal/supervision-digest/supervision-digest.component')
      .then(m => m.SupervisionDigestComponent),
},
```

---

### 5. Frontend — Components

All components are standalone. Place in `frontend/src/app/modules/journal/`. Use Angular signals (`signal()`, `computed()`), `ApiService` for HTTP, and existing Angular Material components.

#### `JournalDashboardComponent`
- Summary cards: active engagements with notes, total session notes this month, open accountability items, entries awaiting AI summary
- Recent activity feed: last 5 session notes + reflective entries, mixed, newest first
- Each feed item links to its respective view
- Quick links to reflective journal and supervision digest

#### `EngagementNotesComponent`
Central hub for a coaching engagement's journal:
- Header: coachee name, engagement status, session count
- **Vertical session timeline**: each node shows session number, date, format, status badge, and one-line AI summary (or first 100 chars of observations). Click to navigate to note view.
- **AI Insights panel** (collapsible section): cross-session report rendered when available; "Generate / Regenerate" button
- **Accountability tracker**: all open `accountabilityItems` across all notes, grouped by session, with checkbox to mark complete (PATCH to note)
- "New Session Note" button

#### `SessionNoteEditorComponent` (create + edit)
Tabbed layout — three tabs:

**Tab: Before**
- Agenda, Hypotheses, Coach Intention (textareas)

**Tab: During**
- Opening State (textarea)
- Key Themes (chip/tag input — add on enter, remove by click)
- Observations (large textarea)
- Notable Quotes (repeatable single-line inputs — add/remove rows)
- Coach Interventions, Energy Shifts (textareas)

**Tab: After**
- Coach Reflection, What Worked, What to Explore Next, Client's Growth Edge (textareas)
- Accountability Items (repeatable rows: text input + optional date picker + checkbox)

**Action bar (sticky bottom):**
- Save Draft | Mark Complete | Generate AI Summary (disabled until status = complete)

#### `SessionNoteViewComponent` (read-only)
- Clean two-column layout: all session fields left, AI Summary panel right (green-tinted highlight using `#27C4A0`, shown only if `aiSummary` exists)
- Print-friendly (CSS `@media print`)
- "Edit" button top right

#### `ReflectiveJournalComponent`
- Feed of reflective entries, newest first
- Filter bar: mood selector, tag filter, supervision-ready toggle, date range
- Entry card: date, title, mood icon + label, first 150 chars of body, tags, supervision flag badge
- FAB "New Entry" button (bottom right)

#### `ReflectiveEditorComponent` (create + edit)
- Date picker (defaults today)
- Title input
- Mood selector: five options with icon + label (energized / reflective / challenged / inspired / depleted)
- Body (large textarea, auto-grow)
- Tag chip input
- Engagement soft-link (multi-select dropdown from coach's engagements, optional)
- "Flag for Supervision" toggle
- Save / Delete buttons

#### `EngagementInsightsComponent`
- Structured report layout with sections: Recurring Themes, Growth Arc, Coach Observations, Open Threads, Suggested Next Focus
- "Generate / Regenerate" button calls the insight API
- Loading state while generating
- Print-friendly

#### `SupervisionDigestComponent`
- Shows count of supervision-ready entries and qualifying session reflections being included
- "Generate Digest" button
- Rendered digest with sections: Coach Themes, Cross-Engagement Patterns, Questions for Supervisor, Development Areas
- Print-friendly

---

### 6. Frontend — Integration with Coaching Module

The journal is accessed from within the coaching engagement detail view:
- Add a "Journal" tab or section in `EngagementDetailComponent` linking to `/journal/engagement/:engagementId`
- The engagement detail's session list can have a "Add Note" action on each completed session, linking to the note editor with the session pre-linked

Add a **"Coaching Journal"** nav item to the sidebar in `app-shell.component.ts`:
```ts
{ label: 'Coaching Journal', icon: 'auto_stories', route: '/journal', roles: ['admin', 'hr_manager', 'coach'], module: 'coaching' }
```

---

### 7. Frontend — Services

Create a single service at `frontend/src/app/modules/journal/journal.service.ts` using `ApiService`:

```ts
// Session Notes
getEngagementNotes(engagementId: string)        → api.get<T>(`/journal/engagements/${engagementId}/notes`)
createNote(engagementId: string, data)           → api.post(...)
getNote(noteId: string)                          → api.get(...)
updateNote(noteId: string, data)                 → api.put(...)
deleteNote(noteId: string)                       → api.delete(...)
generateAiSummary(noteId: string)                → api.post(...)

// Reflective Entries
getReflectiveEntries(params?)                    → api.get('/journal/reflective', { params })
createReflectiveEntry(data)                      → api.post(...)
getReflectiveEntry(entryId: string)              → api.get(...)
updateReflectiveEntry(entryId: string, data)     → api.put(...)
deleteReflectiveEntry(entryId: string)           → api.delete(...)

// AI Insights
getEngagementInsights(engagementId: string)      → api.get(...)
getSupervisionDigest()                           → api.get(...)
```

---

## UI/UX Design Directives

Inherit the existing ARTES shell, navigation, and global SCSS variables. Do not introduce new brand colors or override global styles. Extend only within the component styles.

Within the module:
- Journal entry backgrounds: use a warm off-white `#F8F6F1` to create a paper-like feel distinct from the standard app background, scoped to journal views only
- AI-generated content: always wrapped in a panel with a left border in `#27C4A0` (green) and a subtle green-tinted background
- Session timeline: vertical line with circular nodes — use pure CSS, no third-party timeline library
- Textareas for narrative fields (observations, body, reflections) should be generously sized — minimum 8 rows, auto-grow on content
- Mood selector: horizontal icon row with label beneath each, selected state uses `--artes-accent` border + fill
- Empty states: contextual, coaching-aware copy (e.g. "No session notes yet — capture your first session when you're ready." not "No records found.")
- Responsive to 1024px tablet minimum; mobile not required for v1
- Component styles use SCSS nesting — keep styles co-located in the component file (inline `styles: [...]`)

---

## Implementation Order

1. Create two Mongoose models (`JournalSessionNote`, `JournalReflectiveEntry`)
2. Create `backend/src/routes/journal.routes.ts` and register in `app.ts`
3. Add three AI prompt builder methods to existing `ai.service.ts`
4. Scaffold Angular components in `frontend/src/app/modules/journal/`
5. Create `journal.service.ts` wrapping all API endpoints
6. Register routes in `app.routes.ts` and add sidebar nav item
7. Build `EngagementNotesComponent` with session timeline
8. Build `SessionNoteEditorComponent` (tabbed, all fields, save/complete)
9. Build `SessionNoteViewComponent` with AI panel
10. Build `ReflectiveJournalComponent` + `ReflectiveEditorComponent`
11. Build `JournalDashboardComponent`
12. Build `EngagementInsightsComponent` + `SupervisionDigestComponent`
13. Add journal link/tab to existing `EngagementDetailComponent`

---

## Rules for Claude Code

- **Do not modify existing models, middleware, or auth** — only add new files and register them
- **Do not create a new Express server or Angular app** — integrate into what exists
- **Do not add a new `.env`** — `ANTHROPIC_API_KEY` is already there
- **All backend queries must include `organizationId: req.user!.organizationId`** — the tenantFilterPlugin logs warnings if missing
- Coach-owned journal data must also filter by `coachId: req.user!.userId`
- AI summary fields (`aiSummary`, `aiThemes`, `aiGeneratedAt`) are read-only in the UI — coach can regenerate but not manually edit
- `sessionNumber` must auto-increment per `engagementId`, not globally
- Use Angular signals (`signal()`, `computed()`) — avoid `BehaviorSubject`
- Use `ApiService` for all HTTP calls — never raw `HttpClient`
- All timestamps stored in UTC; display in the user's local timezone using Angular's `DatePipe`
- Follow existing Angular standalone component pattern — no NgModules
- Use existing Angular Material components (MatIcon, MatButton, MatChips, MatTabs, MatDivider, etc.)
- TypeScript strict mode on both backend and frontend

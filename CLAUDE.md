# ARTES — Claude Code Instructions

Multi-tenant B2B SaaS built by HeadSoft Tech × Helena Coaching.
Hosted at https://pip.helenacoaching.com — EC2 (13.218.6.173), served via Nginx + PM2.

---

## Deploy

```bash
bash deploy.sh all        # build + upload frontend + backend + restart PM2
bash deploy.sh frontend   # frontend only (Angular build → SCP to EC2)
bash deploy.sh backend    # backend only (tsc → SCP dist/ → npm install → pm2 restart)
```

The PEM key is at `C:/Users/marek/OneDrive/Desktop/HeadSoft/headsoft-aws.pem`.
Always commit + push **before** deploying so git and production stay in sync.

---

## Tech Stack

| Layer      | Choice |
|------------|--------|
| Frontend   | Angular 17+ standalone components, Angular Material, signals API |
| Backend    | Node.js 20, Express, TypeScript strict mode |
| Database   | MongoDB Atlas — multi-tenant via `organizationId` field |
| AI         | Anthropic Claude API (`claude-sonnet-4-6`) via `backend/src/services/ai.service.ts` |
| Auth       | JWT 15 min access + 7 day refresh tokens, proactive refresh in `auth.service.ts` |
| Email      | AWS SES via `email.service.ts` |
| Payments   | Stripe (webhook at `/api/billing/webhook`) |

---

## Project Structure

```
backend/src/
  app.ts                  — Express entry, all routes wired
  config/env.ts           — All env vars with typed config object
  middleware/             — auth, tenantResolver, error, rateLimiter
  models/                 — Mongoose models (see below)
  controllers/            — conflict.controller.ts (AI analysis logic)
  routes/                 — one file per domain
  services/               — ai.service.ts, email.service.ts
  scripts/                — seed-admin.ts, seed-surveys.ts, seed-plans.ts

frontend/src/app/
  core/                   — auth.service, api.service, interceptors, guards
  modules/
    auth/                 — login, register, forgot-password
    dashboard/            — app-shell (sidebar nav), dashboard home
    conflict/             — conflict-dashboard, conflict-detail-dialog, conflict-analyze-dialog
    neuroinclusion/       — neuroinclusion-assessment
    succession/           — idp-view (GROW model)
    survey/               — survey-management (admin), survey-take (self-service), survey-template-dialog
    coach/                — coach-interview (3-step: template → setup → questions)
    admin/                — user-management, role-management, organization-settings, org-chart
    billing/              — billing (org-level plan view)
    system-admin/         — organizations, invoices, plans (system_admin only)
    hub/                  — message hub dialog
```

---

## Database Models

| Model | Key fields |
|-------|-----------|
| `Organization` | name, slug, billingEmail, industry, employeeCount, plan, department[] |
| `User` | organizationId, email, passwordHash, role, department, twoFactorEnabled |
| `SurveyTemplate` | organizationId, title, moduleType, **intakeType** ('survey'\|'interview'\|'assessment'), questions[], isActive |
| `SurveyResponse` | organizationId, templateId, respondentId?, coachId?, **sessionFormat**, **targetName**, submissionToken (unique), isAnonymous |
| `ConflictAnalysis` | organizationId, riskScore, riskLevel, conflictTypes[], aiNarrative, managerScript, **parentId?**, **focusConflictType?**, escalationRequested |
| `Plan` | key (unique), name, priceMonthly (cents), maxUsers, features[], isActive |
| `Invoice` | organizationId, amount, status, planKey |

---

## Multi-Tenancy Rules

**Never skip these:**
- Every DB query must include `organizationId` — the `tenantFilterPlugin` logs a warning if missing
- `Plans` are global (no `organizationId`) — skip `tenantResolver` on those routes
- `SurveyTemplate` uses `setOptions({ bypassTenantCheck: true })` when `isGlobal: true`
- Min group size = **5** responses before aggregation is exposed

---

## Roles & Access

```
system_admin   — cross-org system administration only (separate shell at /system-admin)
admin          — full org access
hr_manager     — all operational modules, no billing/org settings
manager        — read access to conflict/neuro-inclusion analytics, can escalate
coach          — conduct interviews, view intake templates (read-only), succession/IDP
coachee        — take surveys, view own IDP
```

Role-guard pattern: `canActivate: [roleGuard([...ROLE_CONST])]` in `app.routes.ts`.
Nav items use `roles?: AppRole[]` — undefined means visible to all authenticated users.

---

## Intake Types (SurveyTemplate.intakeType)

- `survey` — self-service, completed anonymously by respondents via public link
- `interview` — coach-led, conducted via `/coach/interview` on behalf of a coachee
- `assessment` — coach-led assessment, same flow as interview

Coach interview flow: template → setup (format: individual/team/group + target name + optional coachee) → questions → submit.
`POST /api/surveys/respond` accepts `coacheeId`, `sessionFormat`, `targetName` for coach-led sessions.

---

## AI Service (`backend/src/services/ai.service.ts`)

- `callClaude(prompt, systemPrompt?, maxTokens?)` — 3-retry with exponential backoff
- `buildConflictAnalysisPrompt()` — aggregated survey → conflict risk JSON
- `buildConflictSubAnalysisPrompt()` — focused deep-dive per conflict type
- `buildNeuroinclustionGapPrompt()` — neuroinclusion maturity gap analysis
- `buildIDPPrompt()` — GROW model IDP generation

All prompts instruct Claude to respond with **only valid JSON** — no markdown fences.
Parse pattern: strip fences, slice `{...}`, `JSON.parse`, fallback on error.

---

## Frontend Conventions

- **Signals everywhere**: `signal()`, `computed()`, `update()` — avoid `BehaviorSubject`
- **Standalone components only** — no NgModules
- **`ApiService`** for all HTTP: `api.get<T>('/path')`, `api.post<T>('/path', body)`
- **`AuthService.scheduleTokenRefresh()`** — called on login and app-shell init; silently refreshes JWT 60s before expiry
- Inactivity logout: 30 min, with 2 min warning via `inactivityWarning` signal
- Brand colors defined in `_variables.scss`: Navy `#1B2A47`, Blue `#3A9FD6`, Green `#27C4A0`
- Angular Material theme: `styles.scss`
- Component styles use SCSS nesting — keep styles co-located in the component file

---

## Backend Conventions

- All routes: `router.use(authenticateToken, tenantResolver)` — except Plans (global) and auth endpoints
- `requireRole(...roles)` middleware for role-gating individual routes
- `AuthRequest` extends `Request` with `user: { userId, organizationId, role }`
- Error handling: throw, let `errorHandler` middleware catch — don't swallow errors with empty catch blocks
- Seed scripts run via `ts-node` locally; on server compile first (`npm run build`) and run `node dist/scripts/seed-*.js`

---

## API Routes Summary

```
/api/auth/*              — login, register, refresh, 2FA
/api/users/*             — CRUD (admin/hr), /me (self), /coachees (coach+)
/api/surveys/*           — templates CRUD, /respond, /check/:id, /responses/:id
/api/conflict/*          — /analyze, /analyses, /analyses/:id/sub-analyses, /escalate/:id
/api/neuroinclusion/*    — assessment CRUD + AI gap analysis
/api/succession/*        — IDP CRUD + AI generation
/api/org-chart/*         — org chart data
/api/dashboard/*         — summary stats
/api/hub/*               — messaging
/api/billing/*           — Stripe integration (org-level)
/api/plans/*             — plan catalog (GET public, admin CRUD)
/api/system-admin/*      — cross-org admin
/api/system-admin/billing/* — invoice generation
```

---

## Seeding (local dev / first deploy)

```bash
npm run seed:admin    # creates system_admin + first org + admin user
npm run seed:surveys  # seeds default intake templates
npm run seed:plans    # seeds 12 subscription plans (drops existing)
```

On server (compiled JS only — no ts-node):
```bash
node dist/scripts/seed-plans.js
```

---

## Known Gotchas

- `${{ }}` in Angular templates is parsed as a JS template literal — use `{{ formatAmount(val) }}` helper methods instead of inline expressions starting with `$`
- Angular build warns on unnecessary `??` when the type doesn't include `null | undefined` — safe to ignore but clean up when convenient
- `scroll` events inside MatDialog overlays don't bubble to `document` — activity tracking uses `mousemove`/`keydown`/`mousedown`/`touchstart` which work fine
- The `tenantFilterPlugin` only warns on missing `organizationId` in development — don't rely on it as a hard guard in production
- `SurveyResponse.submissionToken` has a unique DB index — duplicate submissions fail at DB level; always handle the 409 response in the frontend

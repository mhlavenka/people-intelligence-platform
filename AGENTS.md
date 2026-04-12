# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview
- Product: ARTES (multi-tenant B2B SaaS for organizational intelligence).
- Stack:
  - Frontend: Angular 17 standalone components + Angular Material (`frontend/`)
  - Backend: Node.js 20, Express, TypeScript (`backend/`)
  - Database: MongoDB (tenant-scoped data with `organizationId`)
  - AI: Anthropic Claude via `backend/src/services/ai.service.ts`
- Deployment target is EC2/Nginx/PM2; deployment automation is via `deploy.sh`.

## Essential development commands

### Docker local environment (recommended)
- Initialize backend environment file first:
  - `cp backend/.env.example backend/.env`
- Start full stack:
  - `docker-compose up -d`
- Services exposed:
  - MongoDB: `localhost:27017`
  - Backend API: `localhost:3030`
  - Frontend: `localhost:4200`

### Backend (`backend/`)
- Install dependencies:
  - `npm ci`
- Run in dev mode:
  - `npm run dev`
- Build:
  - `npm run build`
- Start built app:
  - `npm start`
- Lint:
  - `npm run lint`
- Test:
  - `npm test`
- Run a single Jest test file:
  - `npm test -- path/to/test-file.test.ts`
- Seed data:
  - `npm run seed:admin`
  - `npm run seed:surveys`
  - `npm run seed:plans`

### Frontend (`frontend/`)
- Install dependencies:
  - `npm ci`
- Run dev server:
  - `npm start`
- Build:
  - `npm run build`
- Lint:
  - `npm run lint`
- Test:
  - `npm test -- --watch=false --browsers=ChromeHeadless`
- Run a single Angular spec file:
  - `npm test -- --watch=false --include src/app/path/to/file.spec.ts`

### CI parity checks
- Backend CI sequence: `npm run lint` → `npm run build` → `npm test`
- Frontend CI sequence: `npm run lint` → `npm run build` → `npm test -- --watch=false --browsers=ChromeHeadless`
- Current repository state: there are no committed `*.test.*`/`*.spec.*` files in `backend/` or `frontend/src/` yet, so test commands may report zero discovered tests.

## High-level architecture

### Backend request flow
- `backend/src/app.ts` is the composition root:
  - Initializes security middleware (`helmet`, CORS), JSON parsing, rate limiting, and all domain routes under `/api/*`.
  - Stripe webhook uses raw body parsing on `/api/billing/webhook` before JSON middleware.
  - Connects MongoDB and starts reminder jobs in `bootstrap()`.
- Route files in `backend/src/routes/` are domain-oriented (auth, surveys, conflict, neuroinclusion, succession, coaching, booking, journal, billing, plans, system-admin, etc.).
- Cross-cutting middleware lives in `backend/src/middleware/`:
  - Auth + role checks
  - Tenant context resolution
  - Error handling
  - Rate limiting

### Multi-tenancy and auth model
- Tenant safety is central:
  - Most data models are expected to filter by `organizationId`.
  - `tenantFilterPlugin` (`backend/src/models/plugins/tenantFilter.plugin.ts`) warns in development when queries/aggregations omit tenant filters.
  - `tenantResolver` (`backend/src/middleware/tenant.middleware.ts`) enforces organization context and blocks mismatched token/header org IDs.
- Global exceptions exist:
  - Plans are global (see `backend/src/routes/plans.routes.ts`), so they intentionally do not require tenant filtering.
- Auth model:
  - JWT access token + refresh token flow
  - Role-based route protection via middleware (`requireRole(...)`)

### AI integration pattern
- Centralized AI client and prompt builders are in `backend/src/services/ai.service.ts`.
- `callClaude(...)` wraps Anthropic API calls with 3-attempt retry + exponential backoff.
- Prompt builders are domain-specific (conflict analysis, neuroinclusion gaps, IDP generation, coaching journal insights).
- Prompts require strict JSON responses; parsing is handled with JSON extraction helpers.

### Frontend composition model
- Routing is centralized in `frontend/src/app/app.routes.ts`:
  - Main authenticated shell (`/`) with lazy-loaded standalone components per domain.
  - Separate `system-admin` shell protected by `systemAdminGuard`.
  - Role gates use `roleGuard([...roles])` constants grouped by business capability.
  - Public booking routes (`/book/...`) are intentionally unauthenticated.
- Shared client-side infrastructure in `frontend/src/app/core/`:
  - `ApiService` standardizes HTTP calls to `environment.apiUrl`.
  - `AuthService` owns token storage, silent refresh scheduling, and inactivity logout/warning behavior.

### Domain structure (big picture)
- Product capabilities are split across parallel backend routes/models and frontend modules:
  - Conflict intelligence
  - Neuroinclusion assessments
  - Succession/IDP generation
  - Survey/intake management and response capture
  - Coaching engagements + session booking/calendar
  - Coaching journal and AI-powered supervision insights
  - Org administration, billing, and system-admin cross-org operations

## Rules inherited from repository guidance
- Deploy script entry points:
  - `bash deploy.sh all`
  - `bash deploy.sh frontend`
  - `bash deploy.sh backend`
- Keep repository and deployed state aligned: commit and push before deployment.
- For tenant-scoped features, treat missing `organizationId` filters as a correctness/security issue, not a warning to ignore.

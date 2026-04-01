# People Intelligence Platform

**HeadSoft Tech × Helena Coaching**

An AI-powered multi-tenant B2B SaaS platform for organizational intelligence.

## Modules

| Module | Description |
|--------|-------------|
| **Conflict Intelligence™** | Workplace conflict detection, risk scoring, and mediation escalation |
| **Neuro-Inclusion Compass™** | Organizational neuroinclusion maturity assessment |
| **Leadership & Succession Hub™** | AI-generated IDPs using GROW methodology |

## Tech Stack

- **Frontend**: Angular 17+ (standalone components, Angular Material)
- **Backend**: Node.js 20 + Express.js + TypeScript
- **Database**: MongoDB Atlas (mongoose, multi-tenant)
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Auth**: JWT with refresh tokens
- **Cloud**: AWS (EC2 + S3 + SES)

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- MongoDB Atlas account (or local MongoDB via Docker)
- Anthropic API key

### 1. Clone & configure environment

```bash
cp backend/.env.example backend/.env
# Fill in MONGODB_URI and ANTHROPIC_API_KEY
```

### 2. Local development with Docker

```bash
docker-compose up -d
```

This starts:
- MongoDB on `localhost:27017`
- Backend API on `localhost:3030`
- Frontend on `localhost:4200`

### 3. Manual development

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## API Overview

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh

GET    /api/organizations/:orgId
GET    /api/users

POST   /api/surveys/templates
POST   /api/surveys/respond
GET    /api/surveys/responses/:templateId   # min 5 responses required

POST   /api/conflict/analyze                # triggers Claude AI
GET    /api/conflict/analyses
POST   /api/conflict/escalate/:id

POST   /api/neuroinclusion/assess           # triggers Claude AI
GET    /api/neuroinclusion/assessments

POST   /api/succession/idp/generate         # triggers Claude AI
GET    /api/succession/idps
PUT    /api/succession/idps/:id/milestone
```

## Key Design Decisions

- **Multi-tenancy**: Every DB query filters by `organizationId`. Enforced via Mongoose plugin.
- **Privacy**: Survey responses require minimum 5 respondents before results are viewable.
- **AI**: Single `callClaude()` function with 3-attempt exponential backoff retry.
- **Auth**: Short-lived JWT (15m) + refresh tokens (7d) with Angular interceptor handling auto-refresh.

## Project Structure

```
people-intelligence-platform/
├── backend/src/
│   ├── config/          env, database
│   ├── middleware/       auth, tenant, error, rateLimiter
│   ├── models/          Mongoose schemas + tenantFilter plugin
│   ├── routes/          Express routers
│   ├── controllers/     Business logic
│   └── services/        AI service, email service
├── frontend/src/app/
│   ├── core/            AuthService, ApiService, interceptors, guards
│   └── modules/         auth, dashboard, conflict, neuroinclusion, succession
├── shared/types/        Shared TypeScript interfaces
└── .github/workflows/   CI pipeline
```

---
*Built with [Claude Code](https://claude.ai/claude-code) — Anthropic*

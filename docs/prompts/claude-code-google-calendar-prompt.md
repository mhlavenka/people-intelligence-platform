# Claude Code Prompt — Google Calendar Integration (Coaching Module)

---

## Context

You are working on **ARTES** — a multi-tenant B2B SaaS application.

**Module in scope:** Coaching Module — specifically the **Session Management** feature where coaches schedule sessions with coachees.

A `Coach` is a user with role `coach` belonging to a `Tenant` (organization). Each coach may connect their own **Google Calendar** to sync coaching sessions automatically.

---

## Task

Build a **Google Calendar integration** for the Coaching Module. This includes:

1. **Backend** — OAuth 2.0 flow, token management, calendar sync service
2. **Frontend** — Angular settings widget for each coach to connect/disconnect their calendar and pick which calendar to use
3. **Session lifecycle hooks** — auto-create/update/delete Google Calendar events when sessions change

---

## Assumptions / Conventions to Follow

- Use `googleapis` npm package (official Google client) on the backend
- Store OAuth tokens **per coach** in MongoDB (not per tenant — each coach connects independently)
- Use `.env` for all secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
- All new files must follow existing project naming conventions (camelCase services, kebab-case Angular files)
- Do not break any existing session CRUD — only add hooks alongside existing logic
- Timezone must be respected — use the coach's stored timezone preference if available, else `America/Toronto`
- Scope to request: `https://www.googleapis.com/auth/calendar.events` (narrower than full calendar access)

---

## Files to Create

### Backend

#### 1. `src/services/googleCalendarService.js`

Responsibilities:
- Build and return an authenticated OAuth2 client for a given coach (using stored tokens)
- Auto-refresh access token using refresh token if expired, and save updated token back to MongoDB
- `listCoachCalendars(coach)` — returns array of `{ id, summary }` for calendar picker
- `createCalendarEvent(coach, session)` — creates event, returns `googleEventId`
- `updateCalendarEvent(coach, session)` — updates existing event by `googleEventId`
- `deleteCalendarEvent(coach, googleEventId)` — deletes event

Event mapping from session:
```
summary:     "Coaching Session – {coacheeName}"
description: "Module: {module}\nNotes: {sessionNotes}"
start:       session.startTime (ISO)
end:         session.endTime (ISO)
attendees:   [{ email: coachee.email }]
reminders:   email 1440 min + popup 30 min before
location:    session.meetingLink (if present)
```

Store `googleEventId` on the session document after creation.

#### 2. `src/controllers/calendarIntegrationController.js`

Routes (all protected by `authMiddleware` + `requireRole('coach')`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/calendar/auth/google` | Generate Google OAuth URL and return it as JSON `{ url }` |
| GET | `/api/calendar/auth/google/callback` | Exchange code for tokens, save to coach document, redirect to frontend settings page |
| GET | `/api/calendar/calendars` | List coach's Google calendars (for picker) |
| POST | `/api/calendar/select` | Save selected `calendarId` to coach document |
| DELETE | `/api/calendar/disconnect` | Remove tokens and calendarId from coach document |
| GET | `/api/calendar/status` | Return `{ connected: bool, calendarId, calendarName }` |

#### 3. `src/routes/calendarRoutes.js`

Wire up the controller routes above. Export and register in `app.js` under `/api/calendar`.

#### 4. Mongoose Schema Update — `Coach` model

Add the following subdocument to the existing Coach/User schema (do not replace existing fields):

```javascript
googleCalendar: {
  connected:     { type: Boolean, default: false },
  calendarId:    { type: String },
  calendarName:  { type: String },
  accessToken:   { type: String },
  refreshToken:  { type: String },
  tokenExpiry:   { type: Date }
}
```

#### 5. Session lifecycle hooks in existing Session service

In `src/services/sessionService.js` (or equivalent), add calls to `googleCalendarService` alongside existing CRUD:
- After `createSession` → `createCalendarEvent`, save `googleEventId` to session
- After `updateSession` → `updateCalendarEvent`
- After `cancelSession` / `deleteSession` → `deleteCalendarEvent`

Only call these if `coach.googleCalendar.connected === true`.

---

### Frontend (Angular)

#### 6. `calendar-integration/` — Angular feature module or standalone component set

**`calendar-integration.component.ts` / `.html` / `.scss`**

A settings widget (to be embedded inside the coach's Settings page) that shows:

**State A — Not Connected:**
- Heading: "Google Calendar Sync"
- Description: "Connect your Google Calendar to automatically sync coaching sessions."
- Button: **"Connect Google Calendar"** (Navy `#1B2A47` with Blue `#3A9FD6` accent)
- Clicking the button calls `GET /api/calendar/auth/google` and redirects to the returned URL

**State B — Connected, no calendar selected:**
- Green checkmark badge: "Google Account Connected"
- Dropdown: "Select a calendar to sync" — populated from `GET /api/calendar/calendars`
- Button: **"Save Calendar"** — calls `POST /api/calendar/select`

**State C — Fully configured:**
- Green badge: "Syncing to: {calendarName}"
- Small text: "New sessions will automatically appear in this calendar."
- Link: "Change calendar" — returns to dropdown
- Link: "Disconnect" (red, subtle) — calls `DELETE /api/calendar/disconnect` with confirmation dialog

**Loading and error states** must be handled for all API calls.

#### 7. `calendar-integration.service.ts`

Angular service to wrap all `/api/calendar/*` HTTP calls:
- `getAuthUrl()` → GET `/api/calendar/auth/google`
- `listCalendars()` → GET `/api/calendar/calendars`
- `selectCalendar(calendarId, calendarName)` → POST `/api/calendar/select`
- `disconnect()` → DELETE `/api/calendar/disconnect`
- `getStatus()` → GET `/api/calendar/status`

---

## Environment Variables Required

Add to `.env` (and document in `.env.example`):

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/calendar/auth/google/callback
```

---

## Google Cloud Console Setup (include as `GOOGLE_CALENDAR_SETUP.md`)

Create a markdown file at the project root documenting these steps for Marek:

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable **Google Calendar API** under APIs & Services → Library
4. Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: **Web Application**
6. Authorized redirect URIs: add `GOOGLE_REDIRECT_URI` from `.env`
7. Copy Client ID and Client Secret into `.env`
8. Configure OAuth Consent Screen:
   - App name: ARTES
   - Scopes: `calendar.events`
   - Add test users during development; submit for verification before production

---

## npm Dependencies to Install

```bash
npm install googleapis
```

---

## Quality Checklist

Before finishing, verify:
- [ ] Token refresh logic handles expired access tokens silently
- [ ] `googleEventId` is stored on the session document and used for update/delete
- [ ] All routes are protected — a coach cannot access another coach's calendar data
- [ ] Disconnect clears tokens AND `googleEventId` references from future sessions (past sessions keep their IDs for reference)
- [ ] Angular widget handles all three states cleanly with loading spinners
- [ ] `.env.example` is updated with the three new variables
- [ ] `GOOGLE_CALENDAR_SETUP.md` is created at project root

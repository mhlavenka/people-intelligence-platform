# Office 365 Calendar Integration — Change Document

**Date:** 2026-04-17
**Author:** Marek (HeadSoft Tech)
**Status:** Draft / Proposal

---

## 1. Objective

Add Microsoft Office 365 (Outlook) as a second calendar provider alongside Google Calendar. Coaches should be able to connect either Google Calendar **or** Microsoft 365 — not both simultaneously. The integration must support the same sync behaviors already implemented for Google Calendar (see `CLAUDE.md` sync table).

---

## 2. Scope

| In scope | Out of scope |
|----------|-------------|
| Microsoft OAuth2 (MSAL) for calendar access | Dual-provider (connecting both at once) |
| Read/write events on Outlook calendar | Migration tool from Google → Microsoft |
| Freebusy conflict checking via Microsoft Graph | Microsoft Teams meeting auto-creation (phase 2) |
| Webhook subscriptions (change notifications) | Shared/delegated mailbox calendars |
| Cancel / reschedule sync from Outlook → system | Room/resource calendar support |
| ICS email attachments (already works, provider-agnostic) | |

---

## 3. Existing Infrastructure to Leverage

The codebase already has several hooks for Microsoft integration:

| What | Where | Status |
|------|-------|--------|
| Microsoft OAuth env vars | `backend/src/config/env.ts` lines 35–39 | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` already defined |
| OAuth provider type on User | `User.model.ts` → `IOAuthAccount.provider` | Accepts `'google' \| 'microsoft'` |
| OAuth login routes | `backend/src/routes/auth-oauth.routes.ts` | Microsoft SSO login flow exists |
| Booking model | `Booking.model.ts` → `googleEventId` | Needs renaming / generalizing to `calendarEventId` + `calendarProvider` |

---

## 4. Microsoft Graph API Mapping

Every Google Calendar API call has a Microsoft Graph equivalent:

| Operation | Google Calendar API | Microsoft Graph API |
|-----------|-------------------|-------------------|
| **OAuth consent** | `OAuth2Client.generateAuthUrl()` | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize` |
| **Token exchange** | `OAuth2Client.getToken()` | `POST /oauth2/v2.0/token` |
| **Token refresh** | `client.setCredentials(); client.refreshAccessToken()` | `POST /oauth2/v2.0/token` with `grant_type=refresh_token` |
| **List calendars** | `calendar.calendarList.list()` | `GET /me/calendars` |
| **Create event** | `calendar.events.insert()` | `POST /me/calendars/{id}/events` |
| **Update event** | `calendar.events.patch()` | `PATCH /me/events/{id}` |
| **Delete event** | `calendar.events.delete()` | `DELETE /me/events/{id}` |
| **Freebusy query** | `calendar.freebusy.query()` | `POST /me/calendar/getSchedule` |
| **Watch for changes** | `calendar.events.watch()` (push channel) | `POST /subscriptions` (change notifications) |
| **Stop watching** | `calendar.channels.stop()` | `DELETE /subscriptions/{id}` |
| **List changed events** | `calendar.events.list({ updatedMin, showDeleted })` | `GET /me/calendarView/delta` (delta query) |

### Microsoft Graph Scopes Required

```
Calendars.ReadWrite     — create/update/delete events
Calendars.Read          — list calendars, freebusy
offline_access          — refresh token
User.Read               — basic profile (email, name)
```

---

## 5. Data Model Changes

### 5.1 User Model — Generalized Calendar Connection

Replace `IGoogleCalendar` with a provider-agnostic `ICalendarConnection`:

```typescript
// NEW
export type CalendarProvider = 'google' | 'microsoft';

export interface ICalendarConnection {
  provider: CalendarProvider;
  connected: boolean;
  calendarId?: string;       // selected calendar ID
  calendarName?: string;     // display name
  accessToken?: string;      // select: false
  refreshToken?: string;     // select: false
  tokenExpiry?: Date;
  // Microsoft-specific: subscription ID for change notifications
  subscriptionId?: string;
  subscriptionExpiry?: Date;
}
```

**Migration:** Rename `user.googleCalendar` → `user.calendarConnection` with a one-time migration script. Existing Google-connected users get `provider: 'google'` set automatically.

### 5.2 Booking Model

```typescript
// RENAME googleEventId → calendarEventId
// ADD calendarProvider field
calendarEventId?: string;       // was: googleEventId
calendarProvider?: CalendarProvider;  // 'google' | 'microsoft'
googleMeetLink?: string;        // KEEP — only populated for Google; Microsoft equiv is teamsLink
teamsLink?: string;             // NEW — populated when Microsoft + Teams meeting enabled
```

**Migration:** Rename field in MongoDB, set `calendarProvider: 'google'` on all existing bookings with a `googleEventId`.

### 5.3 WebhookState Model

```typescript
// ADD provider field
provider: CalendarProvider;      // 'google' | 'microsoft'
subscriptionId?: string;         // Microsoft Graph subscription ID (replaces channelId for MS)
```

Microsoft change notification subscriptions have a max lifetime of **4230 minutes (~3 days)** vs Google's ~30 days, so renewal frequency increases.

### 5.4 BookingSettings Model

No structural changes needed — `targetCalendarId` and `conflictCalendarIds` are already provider-agnostic strings. The calendar list endpoint will return IDs from whichever provider is connected.

---

## 6. Backend Service Architecture

### 6.1 Provider Abstraction Layer

Create a `CalendarProvider` interface and two implementations:

```
backend/src/services/
  calendar/
    calendar.interface.ts        — shared interface
    googleCalendar.provider.ts   — existing logic, extracted
    microsoftCalendar.provider.ts — new Microsoft Graph implementation
    calendarFactory.ts           — returns correct provider based on user's connection
```

**Interface:**

```typescript
export interface ICalendarProvider {
  getAuthUrl(userId: string): string;
  exchangeCodeForTokens(code: string, userId: string): Promise<void>;
  getAuthenticatedClient(coachId: string): Promise<any>;
  listCalendars(coachId: string): Promise<{ id: string; name: string }[]>;
  createEvent(coachId: string, params: CreateEventParams): Promise<{ eventId: string; meetLink?: string }>;
  updateEvent(coachId: string, eventId: string, params: UpdateEventParams): Promise<void>;
  deleteEvent(coachId: string, eventId: string): Promise<void>;
  queryFreebusy(coachId: string, calendarIds: string[], timeMin: Date, timeMax: Date): Promise<BusyPeriod[]>;
  registerWebhook(coachId: string, calendarId: string): Promise<void>;
  stopWebhook(coachId: string): Promise<void>;
  handleNotification(headers: Record<string, string>, body?: any): Promise<WebhookResult>;
}

export function getCalendarProvider(provider: CalendarProvider): ICalendarProvider;
```

**Factory pattern:** `booking.service.ts` and `availability.service.ts` call `getCalendarProvider(coach.calendarConnection.provider)` instead of importing Google-specific functions directly.

### 6.2 Microsoft Calendar Provider — Key Differences

| Aspect | Google | Microsoft | Impact |
|--------|--------|-----------|--------|
| **Auth library** | `google-auth-library` | `@azure/msal-node` | New dependency |
| **API client** | `@googleapis/calendar` | `@microsoft/microsoft-graph-client` | New dependency |
| **Token refresh** | Via OAuth2Client built-in | Manual `POST /oauth2/v2.0/token` or MSAL `acquireTokenByRefreshToken` | Implement in provider |
| **Freebusy** | `calendar.freebusy.query()` returns busy blocks | `POST /me/calendar/getSchedule` returns availability view | Different response shape, normalize in provider |
| **Webhooks** | Push channels, 30-day TTL | Subscriptions, **max 3-day TTL** | Renewal cron must run more frequently |
| **Webhook validation** | Custom `X-Goog-*` headers | Microsoft sends validation request first (`validationToken` query param) | New validation endpoint logic |
| **Webhook payload** | Headers only; must call `events.list()` to get changes | Body contains `resourceData` with change type | Can extract change type from notification directly, but still need to fetch full event |
| **Delta sync** | `events.list(updatedMin, showDeleted)` | `GET /me/calendarView/delta` with `deltaToken` | Store `deltaToken` in WebhookState |
| **Video meetings** | Google Meet (`conferenceData`) | Microsoft Teams (`isOnlineMeeting: true`) | Different field mapping |
| **Event delete detection** | `event.status === 'cancelled'` | Delta returns `@removed` annotation | Different detection pattern |

### 6.3 Microsoft Webhook Subscription Flow

```
1. POST /subscriptions
   {
     changeType: "created,updated,deleted",
     notificationUrl: "https://artes.helenacoaching.com/api/webhooks/outlook",
     resource: "me/calendars/{calendarId}/events",
     expirationDateTime: "2026-04-20T00:00:00Z",  // max ~3 days
     clientState: "{secret}"
   }

2. Microsoft sends validation GET with ?validationToken=xxx
   → respond 200 with the token as plain text body

3. Change notifications POST to /api/webhooks/outlook
   → validate clientState, process changes via delta query
```

### 6.4 Webhook Route Changes

```typescript
// webhook.routes.ts — add Microsoft endpoint
router.post('/outlook', handleOutlookNotification);    // NEW
router.post('/outlook', handleOutlookValidation);      // GET-style validation via POST with validationToken

// Or combine into single handler that checks for validationToken query param
```

---

## 7. Frontend Changes

### 7.1 Booking Settings — Calendar Connection UI

Replace the current "Connect Google Calendar" single button with a provider picker:

```
┌─────────────────────────────────────────────┐
│  Connect your calendar                       │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 🔵 Google    │  │ 🔷 Microsoft 365     │  │
│  │  Calendar    │  │    Outlook           │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  Choose your calendar provider to enable     │
│  automatic scheduling and conflict checking  │
└─────────────────────────────────────────────┘
```

Once connected, show the connected provider with a "Disconnect" option (same as current Google flow).

### 7.2 Calendar Integration Service

Extend `CalendarIntegrationService`:

```typescript
// Current
getAuthUrl(): Observable<{ url: string }>

// New — pass provider
getAuthUrl(provider: 'google' | 'microsoft'): Observable<{ url: string }>
getConnectionStatus(): Observable<{ connected: boolean; provider?: string; calendarName?: string }>
```

### 7.3 Booking Confirmation Page

Already shows "Outlook / Apple (.ics)" download — no changes needed. If Microsoft Teams link is available, show it alongside/instead of Google Meet link.

---

## 8. Route Changes Summary

### New Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/calendar/auth/microsoft` | JWT | Get Microsoft OAuth consent URL |
| `GET` | `/api/calendar/auth/microsoft/callback` | Public | OAuth callback from Microsoft |
| `POST` | `/api/webhooks/outlook` | Public | Microsoft change notifications |

### Modified Routes

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/calendar/auth/google` | No change (backward compatible) |
| `GET` | `/api/calendar/calendars` | Returns calendars from whichever provider is connected |
| `POST` | `/api/calendar/select` | Works with either provider's calendar IDs |
| `DELETE` | `/api/calendar/disconnect` | Stops webhooks for whichever provider is active |
| `GET` | `/api/calendar/status` | Returns `provider` field in response |

---

## 9. Environment Variables

### New Variables

```env
# Microsoft identity platform (Azure AD app registration)
MICROSOFT_CLIENT_ID=           # Already in env.ts
MICROSOFT_CLIENT_SECRET=       # Already in env.ts
MICROSOFT_TENANT_ID=common     # Already in env.ts — 'common' allows any Microsoft account
MICROSOFT_CALENDAR_REDIRECT_URI=https://artes.helenacoaching.com/api/calendar/auth/microsoft/callback

# Webhook secret for Microsoft change notifications
MICROSOFT_WEBHOOK_SECRET=      # random string, validated in clientState
```

### Azure AD App Registration

Required setup in Azure Portal:
1. Register app at `portal.azure.com` → Azure Active Directory → App registrations
2. Add redirect URI: `https://artes.helenacoaching.com/api/calendar/auth/microsoft/callback`
3. Add API permissions: `Calendars.ReadWrite`, `Calendars.Read`, `User.Read`, `offline_access`
4. Generate client secret
5. Set `Supported account types` to "Accounts in any organizational directory and personal Microsoft accounts" (multi-tenant + personal)

---

## 10. Migration Plan

### Phase 1: Data Model + Abstraction (no user-facing changes)

1. Add `ICalendarConnection` interface to User model, keeping `googleCalendar` field as-is temporarily
2. Create `calendar/` service directory with interface and Google provider (extract from existing `googleCalendar.service.ts`)
3. Create Microsoft provider (stubbed, non-functional)
4. Update `booking.service.ts` and `availability.service.ts` to use factory pattern
5. Add `calendarProvider` field to Booking model (default `'google'` for backward compat)
6. All existing tests must pass — this is pure refactoring

### Phase 2: Microsoft Implementation

1. Implement `microsoftCalendar.provider.ts` with full CRUD + freebusy
2. Add Microsoft OAuth routes (consent URL + callback)
3. Add Microsoft webhook endpoint with validation handshake
4. Store Microsoft tokens in `user.calendarConnection`
5. Update webhook renewal cron for 3-day Microsoft subscription TTL
6. Frontend: provider picker in booking settings

### Phase 3: Migration + Cleanup

1. Run migration script: `googleCalendar` → `calendarConnection` with `provider: 'google'`
2. Rename `googleEventId` → `calendarEventId` in Booking documents
3. Remove deprecated `googleCalendar` field from User model
4. Update webhook.routes.ts to handle both `/gcal` and `/outlook` endpoints
5. Deploy with `BOOKING_WEBHOOKS_ENABLED=true` for both providers

### Phase 4: Teams Meeting Integration (optional, future)

1. Add `isOnlineMeeting: true` to Microsoft event creation
2. Extract Teams join URL from response
3. Store in `Booking.teamsLink`
4. Display in booking confirmation and email notifications

---

## 11. New Dependencies

```json
{
  "@azure/msal-node": "^2.x",
  "@microsoft/microsoft-graph-client": "^3.x"
}
```

Both are official Microsoft SDKs with active maintenance.

---

## 12. Webhook Infrastructure — Apache Config

Microsoft requires the notification URL to:
- Be HTTPS (already the case)
- Respond to validation requests within 10 seconds
- Return the `validationToken` as plain-text body

Add to Apache vhost:

```apache
ProxyPass /api/webhooks/outlook http://localhost:3030/api/webhooks/outlook
ProxyPassReverse /api/webhooks/outlook http://localhost:3030/api/webhooks/outlook
```

---

## 13. Testing Strategy

| Test type | What | How |
|-----------|------|-----|
| Unit | Microsoft provider methods | Mock `@microsoft/microsoft-graph-client` responses |
| Unit | Factory returns correct provider | Assert provider type based on user's connection |
| Integration | Webhook validation handshake | Simulated `validationToken` request → expect echo response |
| Integration | Change notification → booking cancel | Mock Graph delta response with deleted event → verify booking cancelled |
| Integration | Change notification → booking reschedule | Mock delta response with moved event → verify booking rescheduled |
| Integration | Freebusy conflict detection | Mock `getSchedule` response → verify slots excluded |
| E2E | Connect Microsoft → select calendar → book → cancel | Manual (requires real Microsoft account) |

Extend existing `backend/tests/behavior-*.test.ts` pattern — add Microsoft variants of all 8 sync behaviors.

---

## 14. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Microsoft subscription 3-day TTL causes missed events | Medium | High | Aggressive renewal (every 12 hours), delta tokens catch up on missed notifications |
| Token refresh failure (Microsoft tokens expire in 1 hour) | Low | High | Same proactive refresh pattern as Google (refresh 60s before expiry), plus retry on 401 |
| Azure AD app registration rejected for tenant | Low | Medium | Use `common` tenant + request only calendar scopes (minimal permissions) |
| Microsoft Graph API rate limiting | Low | Low | Existing exponential backoff pattern applies; Graph limits are generous (10,000 req/10min) |
| Breaking change to `googleCalendar` field on User | Medium | High | Phase 1 is pure additive; migration script runs in Phase 3 after validation |

---

## 15. Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Abstraction layer | 3–4 days | None |
| Phase 2: Microsoft implementation | 5–7 days | Azure AD app registration |
| Phase 3: Migration + cleanup | 1–2 days | Phase 1 + 2 complete |
| Phase 4: Teams meetings | 1–2 days | Phase 2 complete |
| **Total** | **10–15 days** | |

---

## 16. Decision Log

| Decision | Rationale |
|----------|-----------|
| One provider at a time (not both) | Simplifies conflict checking, avoids event duplication, matches Calendly/Cal.com behavior |
| Provider abstraction via interface + factory | Clean separation, no `if google/else microsoft` scattered through booking code |
| Keep `googleMeetLink` field, add `teamsLink` | Different video providers, both may be needed; no reason to generalize into one field |
| 12-hour webhook renewal for Microsoft | 3-day TTL is short; renewing at 50% lifetime balances API calls vs risk of expiry |
| Delta tokens for Microsoft change sync | More efficient than timestamp-based `updatedMin`; Microsoft's recommended pattern |
| `common` tenant ID | Allows both organizational (work/school) and personal Microsoft accounts |

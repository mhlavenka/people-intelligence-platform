# Booking Sync Audit — 2026-04-12

Audit scope: verify the Coaching Booking Module against the 8 Calendly ↔ Google Calendar
sync behaviors described in the upstream prompt. The TypeScript codebase does not map
1:1 to the filenames in the prompt (we use `.ts`, service-based layout, no controllers/
folder). File mapping applied:

| Prompt path | Actual path |
|-------------|-------------|
| `src/services/booking.service.js` | `backend/src/services/booking.service.ts` |
| `src/services/availability.service.js` | `backend/src/services/availability.service.ts` |
| `src/controllers/booking-webhook.controller.js` | **DOES NOT EXIST** (no GCal webhook handler in this codebase) |
| `src/jobs/reminder.job.js` | `backend/src/jobs/reminder.job.ts` |
| `src/services/notification.service.js` | `backend/src/services/bookingNotification.service.ts` |
| `src/routes/booking.routes.js` | `backend/src/routes/booking.routes.ts` |

---

## Per-file audit

### `backend/src/services/booking.service.ts`
- **B1 Create booking → GCal event — PASS.** `createBooking` (lines 110–243) calls
  `calendar.events.insert` with correct `calendarId`, `start`, `end`, attendees, optional
  `hangoutsMeet` conference. Persists `googleEventId` and `googleMeetLink`. Sends
  confirmation via `sendBookingConfirmation`.
- **B6 Cancel in system → GCal event removed — PARTIAL.**
  - `cancelBooking` (lines 245–304) attempts `calendar.events.delete` when
    `booking.googleEventId` is set.
  - **Gap:** the `catch` at line 276 logs the error but does **not** distinguish 404
    (already deleted) from other failures. Prompt requires: swallow 404 with INFO log,
    log other errors at ERROR level, always proceed to MongoDB update.
  - **Gap:** no explicit guard for missing `googleEventId` (currently the whole GCal
    block is skipped when missing — functionally fine, but missing the required
    `logger.warn` trace).
  - **Gap:** still cancels MongoDB booking on Google failure — good — but relies on
    the current try/catch swallow. Behavior is correct, only logging is sub-standard.

### `backend/src/services/availability.service.ts`
- **B5 FREE events ignored — PASS.** `fetchGoogleBusyPeriods` (lines 79–116) uses
  `calendar.freebusy.query` with only `timeMin`, `timeMax`, `items`. No options that
  would include FREE periods. Google's default returns BUSY only.
  - **Gap (docs only):** missing the required inline comment documenting this
    contract so future maintainers don't alter the call signature.
- **B7 Past events have no effect — PARTIAL.**
  - `getAvailableSlots` clamps `rangeStart` to `minNotice.startOf('day')` (line 195–197),
    and per-slot filter at line 248 (`if (slotStart >= minNotice)`). That correctly
    excludes past slots from output.
  - **Gap:** `timeMin` of the freebusy query at line 266 is `rangeStart.toUTC().toISO()`,
    which is clamped against `minNotice.startOf('day')`, but not against raw `now`. In
    practice this is fine (minNotice is always ≥ now), but the prompt asks for an
    explicit `DateTime.max(fromDate, now + minNoticeHours)` to be obvious in code review.
- **B8 Multiple sub-calendars checked — PARTIAL.**
  - Line 262–265 already unions `shared.targetCalendarId` with `shared.conflictCalendarIds`,
    so the target is always included. Good.
  - **Gap:** no dedup (`new Set`) — if admin saves the target id inside
    `conflictCalendarIds`, freebusy gets it twice. Google tolerates this but it's wasteful.
  - **Gap:** no server-side enforcement at save time. PUT of `BookingSettings` /
    `AvailabilityConfig` does not ensure `conflictCalendarIds` contains the target.
  - Same checks in `booking.service.ts#isSlotFree` (lines 143–146): same behavior, same
    gap.

### `backend/src/controllers/booking-webhook.controller.ts`
- **B2 Coach deletes/declines GCal event → cancel booking — FAIL (not implemented).**
- **B3 Coach reschedules GCal event → update booking — FAIL (not implemented).**
- **B4 Client deletes GCal event → no effect — PASS by accident.** We have no webhook
  at all, but conceptually we only hold `targetCalendarId` (the coach's calendar), so
  even after implementing the webhook, invitee-side deletions would not reach us.
- There is no Google Calendar webhook receiver, no `calendar.events.watch()` subscription,
  no `WebhookState` model, and no channel-renewal cron. `grep -rln "events\.watch\|channel.*watch"`
  returns zero matches across the backend.

### `backend/src/jobs/reminder.job.ts`
- **B7 Past bookings skipped — PASS.** Line 16–19 filters `startTime: { $gte: now }`
  at the Mongo layer; loop has no further processing of past bookings.
  - **Gap (defense-in-depth):** no inner `if (booking.startTime <= new Date()) continue;`
    guard inside the loop, which the prompt requests for the edge case where a booking's
    start moves into the past between fetch and processing. Low risk (job runs every 15m),
    but the prompt asks for it explicitly.

### `backend/src/services/bookingNotification.service.ts`
- **B2/B3 Reschedule email — FAIL (not implemented).** Only
  `sendBookingConfirmation`, `sendCancellationEmail`, `sendReminder` exist. No
  `sendRescheduleConfirmation`.
- **B6 Cancellation email — PASS.** `sendCancellationEmail` is invoked from
  `cancelBooking` (line 298).

### `backend/src/routes/booking.routes.ts`
- **Rate limiting — PASS.** `publicLimiter` (lines 43–47): 30 req / 15 min per IP on
  `/api/public/booking` and `/api/public/coach`.
- **Reschedule endpoint — FAIL (not implemented).** No
  `PATCH /api/booking/bookings/:id/reschedule` route.
- Admin router (line 210+) requires JWT + tenantResolver — good.

---

## Gaps Found

| # | Behavior | File(s) | Status | Description |
|---|----------|---------|--------|-------------|
| G1 | B2 — Coach deletes GCal event | `controllers/booking-webhook.controller.ts` (new), `services/googleCalendar.service.ts`, jobs for channel renewal | **FAIL** | No webhook receiver, no `calendar.events.watch()` subscription, no `WebhookState` model. Whole subsystem missing. |
| G2 | B3 — Coach reschedules GCal event | same as G1 + `services/booking.service.ts`, `services/bookingNotification.service.ts`, `models/Booking.model.ts` | **FAIL** | Depends on G1. Also requires `rescheduleBooking()`, reschedule email, schema fields `rescheduledAt` / `rescheduledBy` / `rescheduleHistory`. |
| G3 | B6 — cancel handling of missing GCal event | `services/booking.service.ts` | **PARTIAL** | Catch block does not distinguish 404 from other errors; no `logger.warn` when `googleEventId` is null. |
| G4 | B5 — freebusy documentation | `services/availability.service.ts` | **PARTIAL (docs)** | Behavior is correct; only the inline contract comment is missing. |
| G5 | B7 — explicit `timeMin ≥ now + minNotice` | `services/availability.service.ts` | **PARTIAL** | Currently correct via chained clamp, but not obvious. Add explicit `DateTime.max` before freebusy call. |
| G6 | B7 — inner guard in reminder cron | `jobs/reminder.job.ts` | **PARTIAL** | Mongo filter is correct; add defensive per-loop guard. |
| G7 | B8 — target id always in freebusy items + dedup | `services/availability.service.ts`, `services/booking.service.ts`, `routes/booking.routes.ts` (PUT settings) | **PARTIAL** | Target is already included in union; missing `new Set` dedup and server-side default when admin saves empty array. |
| G8 | Admin reschedule UI + endpoint | `routes/booking.routes.ts`, `frontend/src/app/modules/booking/booking-dashboard` | **FAIL** | No reschedule button, dialog, or PATCH endpoint. |
| G9 | Regression test suite | `tests/` — directory does not exist | **FAIL** | Project has no Jest setup. Phase D requires introducing a full test harness. |
| G10 | Project memory entry | `CLAUDE.md` | **FAIL** | Sync-model table not yet documented. |

## Confirmed Passing

| # | Behavior | Notes |
|---|----------|-------|
| P1 | B1 — create booking writes GCal event | `booking.service.ts#createBooking` lines 150–200 |
| P2 | B4 — client deletes GCal event has no effect | We only watch coach calendar; invitee-side actions are invisible. |
| P3 | B5 — freebusy excludes FREE events | Google default behavior; we don't override. |
| P4 | B6 — cancel path emails client | `cancelBooking` calls `sendCancellationEmail`. |
| P5 | B7 — reminder cron uses `startTime: { $gte: now }` | `reminder.job.ts` line 18. |

---

## Implementation Plan

Dependency-ordered. S = small (< 50 LOC), M = medium (50–200 LOC), L = large (> 200 LOC or
touches infra).

| # | Task | Size | Blocker for |
|---|------|------|-------------|
| 1 | G3: harden `cancelBooking` 404 handling + null-guard logging | S | — |
| 2 | G4: add documenting comment above `calendar.freebusy.query` | S | — |
| 3 | G5: explicit `DateTime.max` for freebusy `timeMin` | S | — |
| 4 | G6: inner-loop `startTime <= now` guard in reminder cron | S | — |
| 5 | G7: dedup with `new Set`; server-side default of `conflictCalendarIds` on save | S | — |
| 6 | G2 schema: add `rescheduledAt`, `rescheduledBy`, `rescheduleHistory` to Booking | S | 7, 8 |
| 7 | G2 service: `rescheduleBooking(id, newStart, newEnd, triggeredBy)` | M | 8, 12, 13 |
| 8 | G2 email: `sendRescheduleConfirmation(booking, oldStart, triggeredBy)` | M | 7 |
| 9 | G1 infra: `WebhookState` model + `calendar.events.watch()` + channel-renewal cron | L | 10 |
| 10 | G1 controller: `/api/webhooks/gcal` receiver + diff logic via `events.list(updatedMin, showDeleted)` | L | — |
| 11 | G8 admin endpoint: `PATCH /api/booking/bookings/:id/reschedule` | S | 13 |
| 12 | G8 admin dialog: reschedule dialog in booking-dashboard | M | — |
| 13 | G9 tests: bootstrap Jest + `mongodb-memory-server` + integration tests for all 8 behaviors | L | — |
| 14 | G10 docs: append sync-model section to CLAUDE.md | S | — |

### Scope notes / decisions required

1. **Webhook infrastructure (items 9 + 10) is the heaviest piece.** It requires:
   - A publicly reachable HTTPS endpoint (we're behind Apache on EC2 — need vhost routing;
     per existing memory, user manages Apache config manually).
   - Google push-notification channel registration per coach, with 7-day TTL renewal.
   - A persistent store (`WebhookState`) for channel id / resource id / lastProcessedAt.
   - This adds a non-trivial operational surface (dead channels, token rotation, etc.).
2. **Test harness (item 13) does not exist yet.** The backend has no `jest.config`, no
   `tests/` directory, no `mongodb-memory-server`. Setting this up is its own ~200 LOC
   scaffolding task before the first sync test can run.
3. **Items 1–8 + 11–12 + 14 are self-contained and can ship independently.** They
   cover the real correctness gaps (cancel 404, reschedule, admin UI) without requiring
   webhook infra.

Recommended phasing:
- **Phase B.1 (ship now):** items 1–8, 11, 12, 14 — closes the correctness gaps the
  admin/client can hit today; adds reschedule support end-to-end.
- **Phase B.2 (separate iteration):** items 9–10 — webhook infra once Apache + channel
  lifecycle are agreed.
- **Phase B.3 (separate iteration):** item 13 — Jest + tests harness.

---

## Implementation Log — B.1 (2026-04-12)

| # | Task | Status | Files changed |
|---|------|--------|---------------|
| 1 | G3: cancelBooking 404/410 handling + null-guard | IMPLEMENTED | `backend/src/services/booking.service.ts` |
| 2 | G4: freebusy doc comment | IMPLEMENTED | `backend/src/services/availability.service.ts` |
| 3 | G5: explicit `DateTime.max(rangeStart, minNotice)` | IMPLEMENTED | `backend/src/services/availability.service.ts` |
| 4 | G6: inner-loop `startTime <= now` guard | IMPLEMENTED | `backend/src/jobs/reminder.job.ts` |
| 5 | G7: `new Set` dedup at both call sites + default on save | IMPLEMENTED | `availability.service.ts`, `booking.service.ts`, `routes/booking.routes.ts` |
| 6 | Booking schema: reschedule fields | IMPLEMENTED | `backend/src/models/Booking.model.ts` |
| 7 | `rescheduleBooking` service | IMPLEMENTED | `backend/src/services/booking.service.ts` |
| 8 | `sendRescheduleConfirmation` email | IMPLEMENTED | `backend/src/services/bookingNotification.service.ts` |
| 11 | PATCH `/api/booking/bookings/:id/reschedule` | IMPLEMENTED | `backend/src/routes/booking.routes.ts` |
| 12 | Reschedule dialog + action in booking dashboard | IMPLEMENTED | `frontend/src/app/modules/booking/reschedule-dialog/*`, `booking-dashboard.component.ts`, `booking.service.ts`, `api.service.ts` |
| 14 | CLAUDE.md sync-model table | IMPLEMENTED | `CLAUDE.md` |

Outstanding (deferred to B.2 / B.3):
- G1/G2 — webhook infrastructure: `events.watch()` subscription, webhook receiver
  endpoint, `WebhookState` model, channel-renewal cron. Requires Apache vhost
  coordination (public HTTPS path for Google push notifications).
- G9 — Jest + `mongodb-memory-server` harness and all 8 behavior tests.

---

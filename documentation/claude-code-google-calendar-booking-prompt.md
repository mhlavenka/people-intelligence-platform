# Claude Code Prompt — Google Calendar Appointment Scheduling & Booking (Coaching Module)

---

## Context

You are working on the **People Intelligence Platform (PIP)** — a multi-tenant B2B SaaS.

**Module in scope:** Coaching Module — **Appointment Scheduling & Booking flow.**

This prompt adds the ability for coaches to publish availability and for coachees to self-book sessions — all synced through Google Calendar.

---

## What to Build

### Overview of the Booking Flow

```
Coach sets availability windows (recurring or one-off)
    ↓
Coachee visits booking page (public or authenticated)
    ↓
Coachee picks a time slot + session type
    ↓
System creates:
  - PIP Session document (MongoDB)
  - Google Calendar event on coach's calendar (via existing googleCalendarService)
  - Confirmation email sent to both parties
    ↓
Coach sees the booking in their PIP dashboard + Google Calendar
Coachee receives confirmation + calendar invite (.ics attachment)
```

---

## Files to Create

---

### BACKEND

---

#### 1. `src/models/CoachAvailability.js` — Mongoose Model

Stores a coach's recurring or one-off availability windows.

```javascript
{
  coachId:       ObjectId (ref: 'User'),
  tenantId:      ObjectId (ref: 'Tenant'),
  type:          String enum ['recurring', 'specific'],  // recurring = weekly pattern, specific = exact date
  
  // For recurring availability
  dayOfWeek:     Number (0=Sun, 6=Sat),   // used when type = 'recurring'
  startTime:     String ('09:00'),         // 24h format, local to coach timezone
  endTime:       String ('17:00'),
  
  // For specific date availability
  date:          Date,                     // used when type = 'specific'
  specificStart: Date,                     // full datetime
  specificEnd:   Date,

  sessionDuration:  Number (default: 60),  // minutes
  bufferTime:       Number (default: 15),  // minutes between sessions
  timezone:         String (default: 'America/Toronto'),
  isActive:         Boolean (default: true),
  
  // Optional Google Calendar Free/Busy integration
  googleBlockBusy:  Boolean (default: true),  // if true, respect coach's Google Calendar busy blocks
  
  createdAt: Date,
  updatedAt: Date
}
```

---

#### 2. `src/models/BookingPage.js` — Mongoose Model

Each coach can configure one public-facing booking page.

```javascript
{
  coachId:          ObjectId (ref: 'User'),
  tenantId:         ObjectId (ref: 'Tenant'),
  slug:             String (unique),     // e.g. "helena-coaching" → /book/helena-coaching
  title:            String,              // "Book a Session with Helena"
  description:      String,
  sessionTypes: [
    {
      id:           String (uuid),
      name:         String,              // e.g. "Discovery Call", "60-min Coaching Session"
      duration:     Number,              // minutes
      price:        Number,              // 0 = free
      currency:     String (default: 'CAD'),
      description:  String,
      color:        String               // hex, for calendar event color coding
    }
  ],
  requiresAuth:     Boolean (default: false),  // true = coachee must be logged in to book
  confirmationType: String enum ['auto', 'manual'],  // auto = instant confirm, manual = coach approves
  isPublished:      Boolean (default: false),
  customQuestions: [
    {
      question:   String,
      required:   Boolean,
      type:       String enum ['text', 'textarea', 'select'],
      options:    [String]              // for select type
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

#### 3. `src/services/availabilityService.js`

Responsibilities:
- `getAvailableSlots(coachId, dateRangeStart, dateRangeEnd, sessionDuration)` — main function
  - Load coach's `CoachAvailability` windows for the requested date range
  - Generate all possible time slots from those windows
  - Remove slots that overlap with existing `Session` documents (already booked)
  - If `googleBlockBusy === true` AND coach has Google Calendar connected:
    - Call Google Calendar **Freebusy API** (`calendar.freebusy.query`) to get busy periods
    - Remove slots that overlap with Google Calendar busy blocks
  - Return array of available slots: `[{ start: ISO, end: ISO, available: bool }]`
- `isSlotAvailable(coachId, start, end)` — validates a specific slot at booking time (prevent race conditions)
- `generateRecurringSlots(availability, dateRangeStart, dateRangeEnd)` — helper
- `subtractBusyPeriods(slots, busyPeriods)` — helper

**Freebusy API call example:**
```javascript
const freebusyResponse = await calendar.freebusy.query({
  requestBody: {
    timeMin: dateRangeStart.toISOString(),
    timeMax: dateRangeEnd.toISOString(),
    items: [{ id: coach.googleCalendar.calendarId }]
  }
});
// Returns busy[] array of { start, end } periods
```

---

#### 4. `src/services/bookingService.js`

- `createBooking(coachId, coacheeId, sessionTypeId, slotStart, slotEnd, customAnswers)`
  1. Validate slot is still available (`isSlotAvailable`)
  2. Create `Session` document in MongoDB
  3. Call `googleCalendarService.createCalendarEvent` — store returned `googleEventId` on session
  4. Send confirmation emails via existing email service (or stub if not yet built)
  5. Return created session
- `confirmBooking(sessionId)` — for manual confirmation flow (coach approves)
- `cancelBooking(sessionId, cancelledBy, reason)` — deletes Google event, updates session status
- `rescheduleBooking(sessionId, newStart, newEnd)` — validates new slot, updates Google event

---

#### 5. `src/controllers/bookingController.js`

Public and authenticated routes:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/booking/:slug` | Public | Get booking page config + coach info |
| GET | `/api/booking/:slug/slots` | Public | Get available slots (query: `?start=&end=&sessionTypeId=`) |
| POST | `/api/booking/:slug/book` | Optional | Create a booking |
| GET | `/api/booking/session/:id/confirm` | Coach JWT | Confirm a pending booking |
| POST | `/api/booking/session/:id/cancel` | JWT | Cancel a booking |
| POST | `/api/booking/session/:id/reschedule` | JWT | Reschedule a booking |

Coach management routes (protected — coach JWT):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coach/availability` | Get coach's availability windows |
| POST | `/api/coach/availability` | Create availability window |
| PUT | `/api/coach/availability/:id` | Update availability window |
| DELETE | `/api/coach/availability/:id` | Delete availability window |
| GET | `/api/coach/booking-page` | Get coach's booking page config |
| POST | `/api/coach/booking-page` | Create/update booking page |
| POST | `/api/coach/booking-page/publish` | Toggle publish status |

---

#### 6. `src/routes/bookingRoutes.js`

Wire up all routes above. Register in `app.js` under `/api/booking` and `/api/coach`.

---

#### 7. `.ics` Calendar Invite Generator — add to `bookingService.js`

When a booking is confirmed, generate an `.ics` file attachment for the confirmation email.

Use the `ical-generator` npm package:
```bash
npm install ical-generator
```

Generate an event with:
- `ORGANIZER` = coach email
- `ATTENDEE` = coachee email
- `SUMMARY` = "Coaching Session – {coachName}"
- `DTSTART` / `DTEND` = session times
- `DESCRIPTION` = session type + any meeting link
- `STATUS` = CONFIRMED
- `METHOD` = REQUEST (so it shows as an invite in Gmail/Outlook)

Attach to confirmation email as `invite.ics` with `Content-Type: text/calendar`.

---

### FRONTEND (Angular)

---

#### 8. `booking-page/` — Public-Facing Booking Widget

**Route:** `/book/:slug` (no auth required by default)

**`booking-page.component.ts` / `.html` / `.scss`**

A clean, multi-step booking flow:

**Step 1 — Select Session Type**
- Cards for each session type (name, duration, price, description)
- Color accent from `sessionType.color`
- Selected card highlights in Blue `#3A9FD6`

**Step 2 — Pick a Date & Time**
- Mini calendar (month view) showing days that have at least one available slot
  - Days with availability: clickable, highlighted in Green `#27C4A0`
  - Days fully booked or in the past: greyed out
- When a day is selected, show time slots as pill buttons (e.g. "10:00 AM", "11:00 AM")
- Call `GET /api/booking/:slug/slots?start=&end=&sessionTypeId=` to populate
- Loading spinner while fetching slots

**Step 3 — Coachee Details**
- Name, email (required)
- Any custom questions defined on the booking page
- Optional: "Add to my calendar" checkbox (triggers .ics download on confirm)

**Step 4 — Confirmation Screen**
- Green checkmark + "Your session is booked!"
- Summary: date, time, session type, coach name
- "Add to Google Calendar" button (links to Google Calendar event URL if auto-confirmed)
- "Download .ics" button

Handle `confirmationType === 'manual'` — show "Your booking request has been sent. The coach will confirm shortly." instead.

---

#### 9. `availability-manager/` — Coach Availability Settings

**Route:** `/coach/settings/availability` (authenticated)

**`availability-manager.component.ts` / `.html` / `.scss`**

Two tabs:

**Tab 1 — Weekly Schedule**
- 7-day grid (Sun–Sat), each day has toggle on/off + time range inputs (start/end)
- "Session duration" and "Buffer time" inputs (shared across all days)
- "Block times I'm busy in Google Calendar" toggle (maps to `googleBlockBusy`)
- Save button calls `POST /api/coach/availability`

**Tab 2 — Specific Dates**
- Date picker to add a one-off availability or block (override)
- List of upcoming specific-date overrides with delete option

---

#### 10. `booking-page-editor/` — Coach Booking Page Setup

**Route:** `/coach/settings/booking-page` (authenticated)

**`booking-page-editor.component.ts` / `.html` / `.scss`**

- Form fields: Page title, description, slug (with live preview of URL: `app.pip.com/book/{slug}`)
- Session types manager: add/edit/delete session type cards inline
- Custom questions builder: add question, set type (text/textarea/select), mark required
- Confirmation type toggle: "Auto-confirm" vs "Manual approval"
- Require login toggle
- **"Publish / Unpublish"** button (prominent, top right)
- **"Copy booking link"** button (copies public URL to clipboard)
- Live preview panel (right side on desktop, tab on mobile) — renders how the booking page will look

---

#### 11. `booking.service.ts` — Angular Service

Wraps all HTTP calls:
- `getBookingPage(slug)`
- `getAvailableSlots(slug, start, end, sessionTypeId)`
- `createBooking(slug, payload)`
- `getAvailability()` — coach's own availability windows
- `saveAvailability(windows)`
- `getBookingPageConfig()`
- `saveBookingPageConfig(config)`
- `publishBookingPage()`
- `confirmBooking(sessionId)`
- `cancelBooking(sessionId, reason)`
- `rescheduleBooking(sessionId, newStart, newEnd)`

---

## npm Dependencies to Install

```bash
npm install ical-generator
```

(`googleapis` already installed from previous integration)

---

## Environment Variables

No new variables required — uses same Google OAuth credentials from previous integration.

---

## Quality Checklist

Before finishing, verify:
- [ ] `getAvailableSlots` correctly removes already-booked slots and Google Calendar busy blocks
- [ ] `isSlotAvailable` is called again at booking time to handle race conditions (two coachees booking same slot simultaneously)
- [ ] `.ics` file is generated and attached to confirmation emails
- [ ] Public booking routes do NOT require auth (coachee may be external)
- [ ] Coach cannot see or edit another coach's availability or booking page
- [ ] `slug` is validated as URL-safe (lowercase, hyphens only) on creation
- [ ] Booking page returns 404 if not published and accessed by non-coach
- [ ] All time slot logic respects the coach's `timezone` field
- [ ] Angular booking widget is fully responsive (mobile-first — coachees often book on phone)
- [ ] Step-back navigation works in multi-step booking flow without losing state
- [ ] "Manual approval" flow sends notification to coach and holds the slot for 24h

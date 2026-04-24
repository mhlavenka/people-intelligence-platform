# Conflict Intelligence — Escalation-to-Pro Approval Process

**Status:** Proposal for review
**Owner:** HeadSoft Tech × Helena Coaching
**Date:** 2026-04-23

---

## 1. Problem statement

Today, an HR manager or coach who runs a Conflict Intelligence analysis can click a single **Escalate** button. That flips a flag, fires an email to HR, and displays a "Helena is notified" banner. There is no real authorization workflow.

In practice, engaging a professional mediator is a **new cost to the organization** — hourly fees, multiple sessions, travel, reporting. The person who runs the analysis rarely has standalone authority to spend that money. Today's one-click path creates three risks:

1. **Budget exposure** — someone can trigger an engagement that accrues thousands of dollars in pro fees without a budget owner signing off.
2. **Governance gap** — larger organisations need traceable approvals for HR/legal audit.
3. **No multi-party accountability** — if the mediation fails or is disputed, there is no record of who authorised what.

We need a structured **request → approval → engagement** workflow where the requester proposes, an authorised approver decides, and only then is the professional engaged and billed.

---

## 2. Current state

| Component | Today |
|---|---|
| Trigger | `POST /api/conflict/escalate/:id` (single button) |
| Effect | Sets `ConflictAnalysis.escalationRequested = true`, sends email to `BOOKING_ADMIN_EMAIL` and mailto link to `helena@helenacoaching.com` |
| Notification | Informal — email, UI banner |
| Cost awareness | None — no quote, no PO, no spend cap |
| Audit | Only the boolean on the analysis doc |
| Who can trigger | Anyone with Conflict module access (`admin`, `hr_manager`, `manager`, `coach`) |

---

## 3. Actors

| Role | Description | Typical real-world title |
|---|---|---|
| **Requester** | Ran the analysis, wants to bring a pro in | HR Manager, People Partner, Manager |
| **Approver(s)** | Authorises the spend | HR Director, VP People, CFO, Org Admin |
| **Finance witness** | Optional — records the PO / cost centre | Finance lead |
| **Professional (Pro)** | External mediator or coach | Helena, or panel member |
| **Coachee(s) / parties** | Employees whose conflict is being mediated | — |
| **Auditor** | Retrospective reviewer | Legal, compliance, external audit |

The **coachees/parties** are deliberately **not participants in the approval flow**. They join later, once the engagement is scheduled, to preserve psychological safety: an employee shouldn't know they are being "escalated about" before the organisation has committed to act.

---

## 4. Process overview — recommended flow

```
                 ┌───────────────┐
                 │  ANALYSIS      │
                 │  exists in      │
                 │  Conflict mod.  │
                 └───────┬───────┘
                         │
              [Requester clicks "Request Pro Mediation"]
                         │
                         ▼
                 ┌───────────────┐
                 │  DRAFT         │ ← Requester fills in scope, rationale, pro, cost
                 └───────┬───────┘
                         │ submit
                         ▼
                 ┌───────────────┐
                 │  SUBMITTED     │
                 │  (in_review)   │
                 └───────┬───────┘
                         │ routed by Org policy
                         ▼
                 ┌───────────────┐          ┌─────────────────────────┐
                 │  LEVEL 1       │───→ OK →│  LEVEL 2 (if required)   │───→ OK →┐
                 │  approver      │          │  approver                 │         │
                 └───────┬───────┘          └─────────────────────────┘         │
                         │ Reject / clarify                                       │
                         │                                                        ▼
                         │                                              ┌───────────────┐
                         │                                              │   APPROVED     │
                         │                                              └───────┬───────┘
                         ▼                                                      │ auto
                 ┌───────────────┐                                              ▼
                 │  REJECTED or   │                                  ┌───────────────┐
                 │  NEEDS_CLARIF. │                                  │  SCHEDULING    │ ← Pro notified, booking flow
                 └───────┬───────┘                                  └───────┬───────┘
                         │                                                    │
                         │  revise                                            ▼
                         │                                          ┌───────────────┐
                         └───→ back to DRAFT                        │  IN_PROGRESS   │ ← sessions underway
                                                                    └───────┬───────┘
                                                                            │
                                                                            ▼
                                                                    ┌───────────────┐
                                                                    │   COMPLETED    │
                                                                    │    or           │
                                                                    │   WITHDRAWN     │
                                                                    └───────────────┘
```

Terminal states: `REJECTED`, `COMPLETED`, `WITHDRAWN`, `EXPIRED`.

---

## 5. Step-by-step walkthrough

### 5.1 Request (Requester)

When the requester opens an analysis in a high/critical risk band, they see **"Request Professional Mediation"** instead of the old Escalate button. Clicking opens a modal:

| Field | Purpose | Example |
|---|---|---|
| **Mediator** | Pick from org's approved panel (default: Helena) | *Helena Coaching* |
| **Proposed scope** | Sessions × duration | 3 × 90 min |
| **Hourly / session rate** | Prefilled from Pro's record | $250 / hour |
| **Estimated total cost** | Auto-calculated (sessions × duration × rate) | $1,125 |
| **Cost centre / PO** *(optional)* | For finance | `HR-CONFL-2026-Q2` |
| **Urgency** | Low / Medium / High / Critical | Medium |
| **Justification** | Why a pro is needed vs. in-house action | Free text, required |
| **Parties involved** | Who will participate (team name, not individuals) | "Engineering – Backend squad" |
| **Linked analysis** | Auto-attached | read-only |

Saving without submitting keeps the request in `draft` — the requester can come back later.

Submitting changes state to `submitted` and kicks off routing.

### 5.2 Approval routing (System)

The org defines a policy. Three sensible variants, in order of complexity:

**(a) Single approver — MVP**
Every request routes to a single role (e.g. `admin`). First approver in that role to respond, decides.

**(b) Tiered by amount — V2 recommended default**
```
if estimatedTotal <= $1,000    → HR Director / admin
if estimatedTotal <= $5,000    → admin + finance sign-off (parallel)
if estimatedTotal >  $5,000    → admin + finance + VP-level (sequential)
```

**(c) Fully configurable — V3**
Per-org matrix of thresholds × roles. Sequential / parallel. Delegates. Quorums. Out-of-office fallbacks.

For all three, the approver gets:
- In-app notification badge (red dot on "Conflict Intelligence")
- Email with deep link to the approval screen
- Optional: reminder after 48 h, auto-escalate to alternate approver after 72 h (V2)

### 5.3 Review (Approver)

The approver lands on a dedicated screen showing:

- **The analysis**: risk score, narrative, conflict types, recommended actions already taken
- **The request**: scope, pro, cost, justification, urgency
- **Requester context**: who they are, their escalation history
- **Budget context**: current YTD spend on pro mediation for this org, remaining budget if configured

Three actions:

| Action | Effect |
|---|---|
| **Approve** | State → `approved`. If multi-level, next level notified. If last level, state → `scheduling`. |
| **Reject** | State → `rejected`. Requester notified with reason. Terminal. |
| **Request clarification** | State → `needs_clarification`. Requester notified and can edit. Loops back to `submitted` on resubmit. |

Every decision requires a text comment (audit requirement).

### 5.4 Engagement (Pro + coordinator)

Once terminal-approved:

- Pro receives an email with the engagement brief (analysis summary sans PII, scope, contact).
- System creates a **CoachingEngagement** record (the existing coaching module) linked to the escalation so bookings, notes, invoices flow through the usual pipeline.
- Requester gets a confirmation and the engagement URL.
- State transitions to `scheduling` → `in_progress` → `completed` as the Pro runs the sessions.

### 5.5 Withdrawal

The requester can withdraw any request before it reaches `approved`. If already approved but sessions have not started, the requester plus any approver can cancel (state → `withdrawn`, optional small cancellation fee flag).

---

## 6. Data model

### 6.1 New collection: `ConflictEscalationRequest`

```ts
{
  _id: ObjectId,
  organizationId: ObjectId,          // tenant scoping
  analysisId: ObjectId,              // ref ConflictAnalysis
  requesterId: ObjectId,             // ref User

  // Scope
  mediatorId: ObjectId | null,       // ref User (coach) — null if external-only
  externalMediatorName?: string,     // when not a platform user
  proposedSessions: number,
  proposedDurationMinutes: number,
  proposedRateCents: number,
  estimatedTotalCents: number,
  costCentre?: string,
  poNumber?: string,

  urgency: 'low' | 'medium' | 'high' | 'critical',
  justification: string,             // required on submit
  partiesDescription: string,

  // Lifecycle
  status:
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'needs_clarification'
    | 'approved'
    | 'rejected'
    | 'scheduling'
    | 'in_progress'
    | 'completed'
    | 'withdrawn'
    | 'expired',

  // Approval chain (snapshot of policy at submit time)
  approvalChain: [
    {
      level: number,
      approverUserId?: ObjectId,     // either a specific user
      approverRole?: string,         // or a role (any member of role can decide)
      decision: 'pending' | 'approved' | 'rejected',
      decidedAt?: Date,
      comment?: string
    }
  ],
  currentApprovalLevel: number,      // index into approvalChain

  // Post-approval link
  engagementId?: ObjectId,           // ref CoachingEngagement once scheduled

  // Audit trail
  history: [
    { at: Date, byUserId: ObjectId, event: string, detail?: string }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### 6.2 Additions to `Organization`

```ts
{
  // ... existing fields
  escalationPolicy: {
    enabled: boolean,
    tiers: [
      {
        maxAmountCents: number,      // use Number.MAX_SAFE_INTEGER for top tier
        approverRoles: string[],     // e.g. ['admin']
        approverUserIds?: ObjectId[], // specific users override role
        requireFinanceSignoff: boolean,
        sequential: boolean          // false = parallel (all must approve)
      }
    ],
    defaultMediatorIds: ObjectId[],
    notificationEmails: string[],
    slaHours: number                  // auto-remind approvers after N hours
  }
}
```

### 6.3 Additions to `ConflictAnalysis`

Keep `escalationRequested: boolean` for backwards compat (= "is there any non-terminal escalation for this analysis"). Optionally add `currentEscalationId` as a denormalised pointer for UI.

### 6.4 Additions to `User`

Optional new role: `escalation_approver` — used when approvers are distinct from org admins. Not required for MVP if we route to `admin`.

---

## 7. API surface (proposed)

| Method & Path | Purpose | Who can call |
|---|---|---|
| `POST /api/conflict/escalations` | Create draft | analysis access roles |
| `GET /api/conflict/escalations` | List (own org) | analysis access roles |
| `GET /api/conflict/escalations/:id` | Read one | requester, approver, admin |
| `PUT /api/conflict/escalations/:id` | Edit draft / clarify | requester only |
| `POST /api/conflict/escalations/:id/submit` | Draft → submitted | requester |
| `POST /api/conflict/escalations/:id/decision` | Approve / reject / ask-clarif | current approver |
| `POST /api/conflict/escalations/:id/withdraw` | Cancel before engagement | requester or admin |
| `POST /api/conflict/escalations/:id/engage` | Trigger engagement creation after approval | system or admin |

All routes enforce `organizationId` tenant scoping per the existing `tenantResolver` pattern.

---

## 8. UI touchpoints

1. **Analysis detail page** — existing "Escalate" button replaced by **"Request Professional Mediation"**. Opens the request modal (§5.1).
2. **New list page**: `/conflict/escalations` — filterable by status + role (requester sees own, approver sees pending-their-decision, admin sees all). Cards grouped by state.
3. **Approval detail page**: `/conflict/escalations/:id` — analysis context + request form + decision buttons.
4. **Sidebar badge**: red dot on the Conflict Intelligence nav group when the current user has a pending-approval item.
5. **Org settings → Escalation policy** (admin only): configure tiers, default mediators, SLA.
6. **Dashboard widget** *(future)*: "Escalations — in review: 2 · approved this quarter: 5 · YTD spend: $12,450".

---

## 9. Notifications

| Event | In-app | Email | To |
|---|---|---|---|
| Draft created | — | — | — |
| Submitted | ✓ | ✓ | Approver(s) at current level |
| Clarification requested | ✓ | ✓ | Requester |
| Resubmitted | ✓ | ✓ | Approver(s) |
| Approved (interim level) | ✓ | ✓ | Approver(s) at next level |
| Fully approved | ✓ | ✓ | Requester, Pro, admin |
| Rejected | ✓ | ✓ | Requester |
| Withdrawn | ✓ | ✓ | All previous actors |
| SLA reminder (every `slaHours`) | ✓ | ✓ | Current approver |
| Auto-escalated | ✓ | ✓ | Next-tier approver, requester |

Keep notifications plain — link to the app, show requester name, risk level, and cost summary. **Do not include analysis narratives** in emails (sensitive + GDPR).

---

## 10. Permissions matrix

| Role | Create | Submit | Edit own | Approve | Withdraw | View all (org) | Config policy |
|---|---|---|---|---|---|---|---|
| coach | ✓ | ✓ | ✓ | — | own | — | — |
| manager | ✓ | ✓ | ✓ | — | own | — | — |
| hr_manager | ✓ | ✓ | ✓ | policy | own | ✓ | — |
| admin | ✓ | ✓ | ✓ | ✓ | any | ✓ | ✓ |
| system_admin | — | — | — | — | — | cross-org | — |

---

## 11. Audit & compliance

- Every state change and every decision writes a `history` entry with user + timestamp + free-text comment.
- The full chain is append-only — no edits, no deletes.
- Exportable as PDF for legal / audit requests (re-use the existing PDF generator used for invoices).
- Retained for 7 years (or per org's retention policy once that feature exists).

---

## 12. Integration with the existing ARTES ecosystem

ARTES already has Conflict Intelligence, Coaching, Booking, Billing, Sponsors, Hub, and Admin modules. This workflow plugs into them rather than introducing a parallel stack. The table below maps each concern to the module that owns it.

| Concern | Existing module / file | How it's reused |
|---|---|---|
| Origin of the request | Conflict Intelligence | Escalation references `ConflictAnalysis._id` |
| Running the mediation | Coaching (`CoachingEngagement`, `CoachingSession`) | Approved request auto-creates an engagement |
| Session scheduling | Booking + Google Calendar sync | Bookings → sessions via `bookingCoachingSync.service.ts` |
| Invoicing the org | Billing (`Invoice`, Stripe) | `Invoice { sourceType: 'conflict_escalation' }` |
| External provider contracts | Sponsors module | Mediator's rate pre-fills from `Sponsor` when applicable |
| In-app conversation | Hub | Threaded messages scoped to the escalation |
| Email notifications | `email.service.ts` (SES + i18next) | New template keys in `locales/{lang}/emails.json` |
| AI-drafted justification / scope | `ai.service.ts` (Claude) | New `buildEscalationJustificationPrompt()` |
| Activity timeline | Admin → Activity Log | Writes one entry per state transition |
| Permission model | Custom Roles + `requirePermission` | New permission `MANAGE_CONFLICT_ESCALATIONS` |
| Translations | `assets/i18n/{en,fr,es,sk}.json` + `scripts/check-translations.js` | Same pipeline as everything else |

### 12.1 Conflict Intelligence module (origin)

- The **"Request Professional Mediation"** button replaces the current `POST /api/conflict/escalate/:id` single-click Escalate on the analysis detail page (`/conflict/analysis/:id`). The existing endpoint stays for backwards-compat, but the UI no longer exposes it.
- The marketing-style **Escalation Pathway** block on `/conflict/dashboard` (already implemented) becomes the "why / when" explainer; the actual trigger sits on the analysis page.
- A new sibling route `/conflict/escalations` (list) plus `/conflict/escalations/:id` (detail) sits under the existing Conflict group in the sidebar — same role visibility as the rest of the module.

### 12.2 Coaching module (execution)

- On final approval, `escalation.service.ts` calls into the existing coaching service to create a `CoachingEngagement`:
  - `coachId` = the approved mediator user
  - `sourceType: 'conflict_escalation'`, `sourceId: <escalationId>` (new fields, additive)
  - `coacheeIds` deliberately **empty at creation** — the Pro adds parties during scheduling, preserving confidentiality until the org has committed.
- From here, the coach runs sessions exactly like any other engagement: Session Notes, Reflections, Post-Session Forms, IDPs all work unchanged.
- The escalation detail page links directly into `/coaching/:engagementId` once the engagement is live.

### 12.3 Booking & calendar

- The Pro's availability, freebusy conflict check, GCal sync, reminders, and reschedule flow are **unchanged**. An approved escalation just adds another `CoachingSession` to the same pipeline.
- Client-facing public booking URL (coach-slug based) is available if the org wants parties to self-schedule; otherwise an admin creates sessions directly in `/coaching`.

### 12.4 Billing — two paths depending on who pays

**Path A — Org pays directly (most common).**
On engagement completion (or periodically per policy), the platform auto-generates an `Invoice`:

```
Invoice {
  organizationId: <requesting org>,
  sourceType: 'conflict_escalation',
  sourceId: <escalationId>,
  planKey: null,                   // not subscription-derived
  lineItems: [                      // actual delivered sessions, not the estimate
    { description: 'Mediation session 2026-05-12 (90 min)', amountCents: 37500 },
    ...
  ],
  status: 'sent',
  ...
}
```

Flows through the existing invoice lifecycle, Stripe webhook at `/api/billing/webhook`, reminder cadence, overdue handling, and PDF generation. The Org Admin's **Billing** page adds a filter tab **"Conflict Mediation"** that lists these invoices alongside the approval trail.

**Path B — Sponsor-billed.**
If the mediator is a coach attached to an external sponsor (e.g. an EAP provider), the existing `Sponsor` + `SponsorInvoice` flow handles cross-charging. The escalation record just references the sponsor engagement; no duplicate invoice is generated on the org side.

### 12.5 Sponsors module

- The escalation request modal's **Mediator** dropdown is populated from: (a) internal coaches in the org + (b) coaches attached to approved sponsors of the org.
- When a sponsor-attached coach is selected, the hourly rate and currency pre-fill from the `Sponsor` contract; the requester can see the contract terms inline before submitting.

### 12.6 Hub (in-app messaging)

- The existing Hub is scoped to a thread per escalation — requester ↔ approver(s) exchange clarifying messages without leaving the app.
- Post-approval, the Pro joins the thread and uses it for org-facing updates. Employee/party communication stays outside the Hub (direct Pro ↔ coachee via booking / session notes).
- Hub message timestamps feed the audit history (pointers, not copies, to keep message volume out of the history array).

### 12.7 Email templates (SES via `email.service.ts`)

Six new template keys under `emails.escalation.*` in `backend/src/locales/{lang}/emails.json`:

- `submittedSubject`, `submittedBody` — to approver when request lands
- `clarificationSubject`, `clarificationBody` — to requester when approver asks for more info
- `approvedSubject`, `approvedBody` — to requester + Pro when final approval lands
- `rejectedSubject`, `rejectedBody` — to requester
- `withdrawnSubject`, `withdrawnBody` — to all prior actors
- `slaReminderSubject`, `slaReminderBody` — to current approver after `slaHours`

All rendered via `getEmailTranslator(language)` exactly like the booking and coaching email templates today. No new infra — same SES config, same formatter, same test harness.

**Content policy:** bodies contain name + risk level + cost summary + deep link only. No narrative, no conflict types, no respondent data. Sensitive content stays in-app.

### 12.8 AI service (Claude)

Two optional AI helpers that reuse the existing `callClaude()` retry loop and `claude-sonnet-4-6` model:

- `POST /api/conflict/escalations/:id/draft-justification` — given the analysis, Claude drafts a justification paragraph the requester edits. Prompt builder added to `ai.service.ts` alongside the existing conflict analysis prompts.
- `POST /api/conflict/escalations/suggest-scope` (Phase 3) — Claude suggests session count/duration from analysis severity.

No new provider, no new API keys, no budget line item.

### 12.9 Dashboards & reports

- **Conflict dashboard** (`/conflict/dashboard`): add a 5th risk tile "Pending Escalation — N" between the risk counts. Also a compact escalation activity strip showing the 3 most recent approvals/decisions for quick context.
- **Admin → Reports** (`/admin/reports`): new "Conflict Mediation" card — pending count, YTD approved spend, average time-to-decision, engagement outcomes. Reuses the existing chart components.
- **Main dashboard tile** (for `hr_manager` and `admin`): red badge "X escalations awaiting your decision" deep-linking to `/conflict/escalations?filter=pending`.
- **System Admin → Reports**: cross-org escalation volume (counts only, no PII) for platform observability.

### 12.10 Roles, permissions & custom roles

- **MVP:** no new built-in role. Approval permission is granted to the `admin` role by default; `hr_manager` can request but not approve.
- **Phase 2:** introduce a new permission `MANAGE_CONFLICT_ESCALATIONS` in `requirePermission`. Org admins can then assign it to any **Custom Role** via the existing Role Permissions UI (no code change per-org).
- **Tenant isolation:** every escalation query goes through the existing `tenantResolver` + `tenantFilterPlugin` — no custom multi-tenancy code.

### 12.11 Org-level configuration

The new `escalationPolicy` object on `Organization` is managed from the existing **Organization Settings** page (`/admin/organization-settings`) — we add a new section card "Escalation Policy" below the "Departments" card. Uses the same card/chips/form patterns as the rest of that page. Only `admin` role can edit.

### 12.12 Activity Log

Every state transition calls into the existing activity-logging helper, so escalations appear in the org's **Activity Log** (`/admin/activity-log`) alongside surveys, analyses, and coaching events. Type filters get a new "Conflict Escalation" option.

### 12.13 i18n pipeline

All new UI keys, email templates, and AI language instructions flow through the standard pipelines — `{{ 'KEY' \| translate }}`, `req.t('errors.xxx')`, `languageInstruction(language)`. The `scripts/check-translations.js` pre-deploy check blocks any missing key across en / fr / es / sk. No new pipeline.

### 12.14 Mobile

- Phase 1 / 2: mobile users (the existing Android / iOS wrappers) can **view** escalations and read the decision trail. **Create** and **approve** are desktop-only — most approvers are at a desk with email on their phone anyway.
- Phase 3 adds mobile approve/reject, useful for exec-level approvers who are travelling.

### 12.15 What is explicitly NOT reused

- **The existing `escalationRequested: boolean` field** on `ConflictAnalysis` — kept for backwards-compat but deprecated. A denormalised `currentEscalationId` pointer replaces it for UI purposes.
- **The `mailto:helena@helenacoaching.com` link** on the dashboard — retired once the approval workflow exists; it was a placeholder. The Escalation Pathway pillar keeps a "Learn more" link but no direct email CTA.

---

## 13. Phasing

### Phase 1 — MVP (target: ~2 weeks)

- `ConflictEscalationRequest` collection + API
- Single-level approval, routed to `admin` role (no per-org policy yet)
- Request modal, list page, approval page
- Basic notifications
- Link to existing CoachingEngagement on approval
- Audit history

### Phase 2 — Governance (~2 weeks)

- Per-org `escalationPolicy` with budget tiers
- Multi-level approval (sequential + parallel)
- SLA reminders, auto-escalate
- Finance sign-off checkbox
- Withdraw flow post-approval

### Phase 3 — Full workflow (~3 weeks)

- `escalation_approver` role + delegation
- Budget tracking widget (YTD spend)
- RFQ / multi-pro quote comparison
- PDF export of approval trail
- Retention policy

### Phase 4 — Nice-to-have

- Pro marketplace with ratings
- Integration with external finance systems (PO auto-creation in NetSuite / QuickBooks)
- SLA analytics per approver

---

## 14. Key design decisions — need your call before we build

These are the decisions that change the MVP scope. I've noted my recommendation after each.

1. **Default approver model** — single role (admin) vs. budget tiers from day one?
   **Recommend:** single-role for MVP. Tiers in Phase 2.

2. **Pro selection** — fixed to Helena, or pick from panel?
   **Recommend:** pick from panel, default = Helena. Same UI; just populate the list with one entry initially.

3. **Who can request** — everyone with Conflict access (hr_manager / manager / coach) or restricted to hr_manager + admin?
   **Recommend:** anyone who can see the analysis can request. Approval is the gate, not the request.

4. **Cost estimate** — required, or optional with "to be quoted"?
   **Recommend:** required. Quote can be revised during clarification, but an approver should never approve a blank cheque.

5. **Party confidentiality** — does the approver see which people/teams the mediation covers?
   **Recommend:** see the *team / department*, not individual names. Matches the min-5 aggregation rule of the analysis.

6. **Withdrawal after approval** — allowed? Fee?
   **Recommend:** allowed until the Pro starts the first session. No fee from the platform's side (Pro may have their own cancellation policy).

7. **Rejection — revise allowed?**
   **Recommend:** no. Rejection is terminal. "Request clarification" is the revise path. If the approver rejects outright, the requester must open a new request with a new case.

8. **Email notifications** — send narrative details, or just "a decision is pending, click to view"?
   **Recommend:** minimal. No sensitive detail in email body.

9. **Auto-escalate SLA** — timer from submission, or from entering a given approver's queue?
   **Recommend:** from entering the queue. Otherwise a slow approver cascades.

10. **System admin vs org admin** — does HeadSoft Tech's `system_admin` role see escalations across orgs?
    **Recommend:** yes, read-only, for platform-level support purposes. No decision authority.

---

## 15. Risks & open questions

- **Adversarial use** — requester submits repeated requests to pressure an approver. *Mitigation:* rate-limit (max 1 active request per analysis).
- **Approver bottleneck** — sole admin is on leave, nothing moves. *Mitigation:* SLA auto-escalate to admin delegate (Phase 2).
- **Budget drift** — many small approved requests add up. *Mitigation:* YTD spend widget, budget-tier gating (Phase 2).
- **Pro no-show after approval** — Pro accepts but then delays. *Mitigation:* Not in this doc — lives in the coaching/booking workflow that already handles engagement lifecycle.
- **Cross-region legal** — some jurisdictions require a works council sign-off before outside consultants can enter. *Open:* Does any current or target client need this? If yes, adds a non-budget approver type.
- **Currency / tax** — estimatedTotalCents assumes a single currency per org. Multi-currency orgs?
- **Can a request reference multiple analyses?** *Recommend:* no for MVP — one-to-one. If the same conflict appears in two analyses, merge them upstream.
- **Re-use of existing booking approval flow?** We already have org-level billing plans and invoice approvals. Should escalation fees flow through the same invoice object, or live separately? *Recommend:* separate `ConflictEscalationRequest` but emit a regular `Invoice` on completion, linked by `sourceType: 'conflict_escalation'`.

---

## 16. What I'm asking for

- **A 1-hour review call** to walk through §13 (Key design decisions) and converge on an MVP spec.
- **Your answer on #1 (single vs tiered approval)** — this is the single biggest scope driver.
- **A list of 2–3 real pilot orgs** we can use as the target shape for Phase 1.

Once those three are nailed, I can commit to a concrete implementation plan with estimates.

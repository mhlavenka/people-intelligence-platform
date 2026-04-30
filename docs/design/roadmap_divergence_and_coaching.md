# Roadmap — Conflict Intelligence Divergence + Coaching Module

**Date:** 2026-04-30
**Source documents reviewed:**
- `docs/design/survey_divergence_and_truth_signals.md`
- `docs/design/survey_divergence_phase1_howto.md`
- `docs/design/conflict_intelligence_implementation_status.md`
- `docs/design/coaching_15-1 and 15-2.md`

This roadmap lists **only the work that remains**, mixed across both projects and sorted by priority. Items already shipped (Divergence Phases 1 & 2, ICF Hours 15.2, the bulk of the Conflict Intelligence module) are not repeated.

---

## P0 — Next sprint(s)

### 1. ✅ DONE — Coaching 15.1 — AssessmentRecord foundation  *(shipped 2026-04-30)*
- New `AssessmentRecord` model (`backend/src/models/AssessmentRecord.model.ts`) — flat `Map<string, number>` scores, optional `scoresMeta` for unit/scaleMin/scaleMax/normGroup, S3 PDF fields, coach interpretation, optional sourceTemplateId for the future 360 → record bridge.
- New `routes/assessment.routes.ts` mounted at `/api/assessments`. Full CRUD + PDF attach/signed-URL/remove. Authorization: coach (own engagement), coachee, admin, hr_manager. Sponsor explicitly excluded. Multer + magic-byte validation matches the existing eqi-import / contract pattern; S3 key `org/{orgId}/assessments/{assessmentId}.pdf`.
- New `assessments-panel.component.ts` embedded in `engagement-detail.component.ts` below the sessions timeline. Cards grouped by phase (baseline / midpoint / final / ad-hoc). Click a card to edit; "+ New assessment" / per-type "Compare" CTAs in the header.
- New `assessment-dialog/` — generic key/value score editor (handles DISC, Hogan, Leadership Circle, MBTI, CliftonStrengths, TKI, 360, custom; EQ-i still has its dedicated PDF pipeline). PDF upload after first save.

### 2. ✅ DONE — Coaching 15.1 — Pre/post comparison dialog  *(shipped 2026-04-30)*
- New `assessment-comparison-dialog/`. Pickers default to earliest = baseline, latest = final; user can swap any two records of the same `assessmentType`. Per-dimension table with baseline / final / overlay bars / Δ column (green for up, red for down). Bar scaling honours `scoresMeta.scaleMin/Max` when set, otherwise uses empirical min/max.
- "Compare {{type}}" buttons appear in the panel header for every assessmentType where ≥2 records exist on the engagement.
- i18n: 60+ COACHING.* keys across en/fr/es/sk; backend `errors.recordNotFound` already existed.

### 3. ✅ DONE — Conflict Intelligence — Custom analysis prompts for external instruments
- Per-instrument `analysisPrompt` for TKI, ROCI-II, CDP-I, PSS-Edmondson.
- TKI → 5 conflict modes; ROCI-II → 5 handling styles with norm comparisons; CDP-I → constructive/destructive behaviours; PSS → Edmondson's team-safety bands.
- Implemented in `backend/src/scripts/external-instrument-prompts.ts` with a one-off migration `set-external-instrument-prompts.ts` that finds each by `instrumentId` and applies/updates the prompt. Idempotent. All four prompts include the divergence-aware appendix so they behave consistently with the Phase 1+ data blocks.
- Shipped on branch `feat/external-instrument-prompts` (2026-04-30).

### 4. ✅ DONE — Per-organization gating of global survey instruments (system-admin)
- Today: every global SurveyTemplate (`isGlobal: true`) is implicitly available to every org. With many global instruments shipped (HNP-PULSE, HNP-DEEP, HNP-CHS, TKI, ROCI-II, CDP-I, PSS-Edmondson, …), Helena needs a way to scope which instruments each customer can see and run.
- **Schema:** add `Organization.enabledGlobalTemplateIds: ObjectId[]` (allowlist semantics). Empty array vs absent field distinction matters — see "open question" below.
- **Endpoints:**
  - `GET  /api/system-admin/organizations/:id/instruments` — returns `{ enabled: ObjectId[], allGlobal: SurveyTemplate[] }`.
  - `PUT  /api/system-admin/organizations/:id/instruments` — replaces the allowlist; system-admin only.
- **Tenant-side filter:** `SurveyTemplate.find({ ... isGlobal: true })` calls become `find({ ..., $or: [{ organizationId }, { isGlobal: true, _id: { $in: org.enabledGlobalTemplateIds } }] })`. Centralise in a helper to avoid drift.
- **Default for new orgs:** seed `enabledGlobalTemplateIds` with a curated baseline (HNP-PULSE + HNP-DEEP) on `Organization.create`. Helena can broaden per-customer afterwards. *Open question — see below.*
- **System-admin UI:** a new tab on the Organization detail page listing global instruments grouped by module (conflict / neuroinclusion / coaching / succession), each with an enable/disable toggle. Bulk actions: "enable all conflict instruments" / "reset to default".
- **Why P0:** without this, any new global instrument we ship (TKI, CDP-I, future 360 templates) leaks to every existing customer immediately on deploy. The new external instruments are the trigger that makes this visible, and the Coaching 15.1 360 work (#5) ships more global templates.
- **Effort:** ≈1 session — schema + 2 endpoints + filter helper + small admin UI.
- **Decision (shipped):** option 1 — implicit-allow for legacy orgs. `enabledGlobalTemplateIds = undefined` means the org sees all global instruments (backwards compatible); setting the field — even to `[]` — switches the org to allowlist semantics.
- **Where it lives:**
  - `backend/src/models/Organization.model.ts` — new `enabledGlobalTemplateIds` field (default `undefined`).
  - `backend/src/services/templateAccess.service.ts` — `buildTemplateAccessOr(orgId)` returns the `$or` clause that gates global templates.
  - `backend/src/controllers/system-admin.controller.ts` — new `getOrgInstruments` / `setOrgInstruments`, plus a curated default (HNP-PULSE + HNP-DEEP) injected on org create.
  - `backend/src/routes/system-admin.routes.ts` — `GET/PUT /system-admin/organizations/:id/instruments`.
  - Tenant-side filter applied in `survey.routes.ts` (×7 spots), `dashboard.routes.ts`, `reports.routes.ts`.
  - `frontend/.../system-admin/org-instruments-dialog/` — new dialog with module-grouped checkboxes, bulk enable/disable per module, "Revert to default" CTA.
  - i18n: 15 new SYSADMIN.* keys across en / fr / es / sk; `errors.invalidPayload` in backend locales.

### 5. ✅ DONE — System-admin Assessment Hub + lock down org-side global edits  *(out-of-scope, shipped 2026-04-30)*
- Built on top of #4. Org users were still able to edit/delete global instruments through the per-org survey-management UI; that surface area is now read-only for non-system-admin roles.
- **Backend (`survey.routes.ts`):** PUT/DELETE/POST `/templates*` now branch on `req.user.role === 'system_admin'`. Org users get 403 (`errors.globalInstrumentReadOnly`) when targeting `isGlobal: true`. POST strips `isGlobal`/`organizationId` from non-system-admin payloads. GET `/templates` honours `?onlyGlobal=true` (system-admin only) to bypass the per-org allowlist filter.
- **Frontend org-side (`survey-management.component.ts`):** global templates now show a "Global" chip; edit, delete, toggle-active, and clear-responses are hidden. Copy / preview / assign / view-responses / copy-link still work.
- **Frontend system-admin Assessment Hub:** new sidebar item between Plans and Reports. New `assessment-hub/` component with filters (search, module, status), grid of cards, full CRUD via reused `SurveyTemplateDialogComponent`. The dialog now keys `isEdit()` on `_id` (not just truthy data) so the hub can pass `{ isGlobal: true }` as a create-mode hint, and forwards `isGlobal` through the save payload.
- **i18n:** `errors.globalInstrumentReadOnly` (backend ×4); `SURVEY.global` + `SURVEY.globalReadOnlyTooltip` + missing `SURVEY.module/status/active/inactive` + 8 SYSADMIN.* keys (frontend ×4).

### 6. ✅ DONE — System-admin settings page UX polish  *(out-of-scope, shipped 2026-04-30)*
- Page is now full-width (no 1400px cap) with a CSS-columns masonry layout (2/3/4 columns by viewport, `break-inside: avoid` per card) so short cards no longer strand whitespace.
- Card order: General → Address → Email → Session → Password → Login → Token.
- All `mat-form-field` controls in `.card-body` default to 100% width; inside `.field-row` they flex equally with a 200px min basis. Singletons stretch end-to-end. Email Delivery senderName/senderEmail stack on two full-width rows.
- `.sa-main` background changed from `#f0f4f8` to `gainsboro` for stronger card contrast.

### 7. Conflict Intelligence — Automated 30-60 day follow-up pulse scheduling
- Auto-schedule a follow-up pulse when an escalation review is marked complete, or when N% of recommended actions are checked.
- Reuse `SurveyAssignment.recurrence` (already implemented) plus the existing `surveyScheduler` cron.
- Per-org default interval (30 or 60 days), opt-out at the analysis level.
- **Why high:** closes Stage 5 of the module's data flow (the only remaining gap in the core pipeline).
- **Effort:** small — wiring existing primitives. Mostly the trigger logic + a banner on the analysis page showing the scheduled follow-up.

---

## P1 — Following sprints

### 8. Coaching 15.1 — 360 assignment extensions + per-category aggregation
- Extend `SurveyAssignment` with `raterCategory: 'self' | 'manager' | 'peer' | 'direct_report'` (assignment carries the lens; rater never picks).
- Extend `SurveyResponse.raterCategory` (copied from assignment at submit).
- Per-category min-group-size override of `MIN_GROUP_SIZE=5`: self=1, manager=1, peer≥3, direct_report≥3.
- New `assessment360.service.ts`: aggregates responses by category, materialises an AssessmentRecord on completion.
- New `360-setup-wizard/` (extends `survey-template-dialog`): base template → rater roster → dispatch.
- **Depends on:** #1.
- **Effort:** ≈2 sessions (the largest 15.1 phase).

### 9. Coaching 15.1 — 360 → AssessmentRecord + IDP bridge
- Adapter on `succession.routes.ts /idp/generate` to accept `assessmentRecordId` as alternative input to the existing `eqiScores` flat dict.
- Auto-write an `AssessmentRecord` of type `'360'` with category-averaged scores when a 360 completes.
- 360 report view: multi-rater radar with one ring per category.
- **Depends on:** #1, #8.
- **Effort:** ≈1 session.

### 10. Conflict Intelligence — Longitudinal per-department risk comparison
- Extend `reports.routes.ts` with department-scoped trend aggregation (the org-wide trend already exists).
- Per-department line chart on the admin reports page, with overlay for "before / after escalation resolution".
- **Why P1:** closes the "did the intervention work?" reporting gap — currently the only longitudinal view is org-wide.
- **Effort:** ≈1 session (server aggregation + a chart component).

---

## P2 — Lower priority / batch later

### 11. Conflict Intelligence — Toolkit worksheets
- Static or lightly-interactive content for: Interest Mapping Worksheet, BATNA Assessment Guide, Reframing Exercises, Manager Conversation Templates, Balcony Technique.
- **Recommendation:** ship as a single batch of downloadable PDFs first; convert to interactive in-app tools later if usage warrants. Helena's expertise is the bottleneck, not the engineering.
- **Effort:** depends entirely on content production cadence; engineering side is light.

### 12. Conflict Intelligence — Standalone Balcony Technique teaching module
- Currently encoded in the AI prompt only. Stand it up as user-facing educational content.
- **Why P2:** the AI guidance already lands the technique inside every analysis; the standalone module is "nice to have" for self-directed manager learning.

### 13. Divergence Phase 3 — Person-fit (IRT) statistics
- `lz` / `Zh` per respondent based on a calibrated item-response model.
- **Why P2:** requires IRT-calibrated item banks. Needs a psychometrician on the design and probably a research collaboration before going live.
- **Recommendation:** defer until the existing quality signals (straightlining, long-string, trap, speeding, consistency — all already in production) have been observed across enough orgs to justify the lift.

---

## P3 — Research / pilot only

### 14. Divergence Phase 4 — Bayesian Truth Serum on opt-in instruments
- Doubles instrument length per the master design doc.
- **Recommendation:** scope only after #13 has produced a season of operational quality data, and only with an academic collaborator. Leave as a research item until then.

### 15. Divergence Phase 4 — Longitudinal respondent calibration
- Requires persistent respondent linking across surveys, which conflicts with the current anonymous-by-design contract.
- **Recommendation:** flag only — re-evaluate if/when the platform offers an explicit opt-in for non-anonymous longitudinal panels.

### 16. Cross-module roll-out of divergence layers
- Apply quality filter + per-item / dimensional metrics to Neuro-Inclusion and Coaching intakes.
- **Why P3:** Layers 1-3 of the divergence design are module-agnostic; the lift is mostly enabling and i18n. But the conflict module is where polarisation matters most, so other modules can wait until P0-P1 is stable.

---

## What I'd actually ship next

If the goal is **maximum customer-visible value per week of work**, the order I'd lock in (✅ marks items already shipped from this list):

1. ✅ #3 (Custom prompts for external instruments) — shipped 2026-04-30.
2. ✅ #4 (Per-org instrument gating) — shipped 2026-04-30.
3. ✅ #5 (System-admin Assessment Hub + lock down org edits) — shipped 2026-04-30.
4. ✅ #1 (AssessmentRecord foundation) — shipped 2026-04-30.
5. ✅ #2 (Pre/post comparison) — shipped 2026-04-30.
6. #7 (30-60 day follow-up scheduling) — closes the loop the module already promises in the marketing copy.
7. #8–#9 (full 360 flow) — the larger coaching deliverable, now with AssessmentRecord in place.

Then move into divergence Phase 3 once the coaching backlog calms down.

---

## Open questions for review

1. **Default follow-up interval (#7):** 30 days, 60 days, or org-configurable with a default? The design doc says "30–60 day pulse" — preference?
2. **Toolkit worksheets (#11):** PDF-only first, or worth doing one as an in-app interactive module to validate format before scaling?
3. **AssessmentRecord roles (#1):** the 15.1 doc says "coach + coachee on the engagement, plus admin/hr_manager. Sponsor never." — confirm sponsor exclusion stays even when sponsor is paying for the engagement.
4. **15.1 phase 1 vs phase 2 split:** the design doc suggests #1 and #2 are separate phases. They could ship together as a single PR (~2.5 sessions) — preference?
5. **Instrument-gating default (#4):** for new orgs, do we enable HNP-PULSE + HNP-DEEP only, or a broader default? And for existing orgs without an allowlist set — implicit-allow (legacy compatible) or implicit-deny (with a one-time reconcile)? Decision shipped — see #4.

# ARTES todo list
-----------------

I. MODULES
----------

**Intakes/Assessments**
**Conflict Intelligence**
 - Conflict intelligence flow:
   - Plan based or org based selection for AI recommendations or professional recommendations 
   - How do recommendations flow into action items and IDPs?
   - employees are missing intake menu option


**DIVERGENCE TASK**
Shipped

- Layer 1 — quality scoring (straightlining + long-string), acceptedInAnalysis filter, response-quality
  card
- Layer 2 — per-item metrics (mean, sd, IQR, BC, entropy, r_wg, outlier count)
- Layer 3 — dimensional roll-up + Org Settings policy card
- Layer 4 — k=2/k=3 k-means with silhouette ≥0.5 and min-3 cluster guard
- Layer 5 — divergence-aware AI prompt blocks (parent + sub-analysis prompts)
- Layer 6 — Team Alignment dashboard tile + 0–100 banded score
- i18n in en / fr / es / sk and (now) the reader's-guide sidebar

Carried forward but only half-shipped

- Per-item timing capture — survey-take captures timingMsPerItem, the model stores it, but no speeding
  flag is enforced in computeQuality. Design said "conservative until baseline" — we still don't have a
  baseline mechanism.
- Re-run / strict-mode toggle (§8.4 in the design) — not built. Admins can't view the analysis
  with/without quality filtering.
- Cross-module roll-out — divergence is only applied in conflict.controller.ts.
  NeuroinclustionAssessment and any coaching intake analysis still aggregate the old way. Layers 1–3 were
  supposed to be cheap ports.

Phase 3 — not started

- Trap / attention items — SurveyTemplate.IQuestion has no isTrap / trapCorrectAnswer fields. trapFailed
  is in the dropped-reasons enum but never fires.
- Reverse-coded items + consistency pairs — no reverseCoded or correlatedItemIds on the question schema.
  Without these, the per-respondent inconsistency signal is unbuildable.
- Person-fit (IRT) — needs calibrated item banks, scoped in the design as "future / requires
  psychometrician."
- Timing-based speeding flag in production — pairs with the baseline question above.

Phase 4 — research

- Bayesian Truth Serum item on opt-in instruments
- Longitudinal respondent calibration — explicitly avoided so far (would require persistent respondent
  linking, conflicts with anonymity contract)

Open questions still on the design that haven't been answered in code

- §11.4 — should subgroups be visible to manager or only hr_manager+? Today it's whatever role can see
  the analysis (i.e. visible to managers). Consistent with the recommendation, but never explicitly
  confirmed with Helena.
- §11.9 — external ethics review of Phase 2 before general availability. Not done; Phase 2 is already
  live.

Loose ends visible in the Onkwe data

- The conflictTypes array on the parent stores long descriptive sentences rather than short labels (e.g.
  "Fragmented Experience of Psychological Safety — the dimension with the lowest mean (4.6) and near-zero
  agreement (rwg 0.067) signals…"). The divergence-aware prompt is encouraging Claude to embed rationale
  in the type name. If anything renders these in chips, table cells, or compact lists they'll overflow.
  Either tighten the prompt to keep conflictTypes short, or split into conflictType (label) +
  conflictTypeRationale (sentence).
- The sub-analysis documents (Pulse with Divergence rows that are children) don't re-persist the metric
  blocks. The divergence tab on those rows correctly hides itself today, but a one-line "see parent for
  the full divergence panel" link in the sub-analysis dialog would be friendlier than silence.

Suggested next slice

If picking the next phase to ship, the highest-value/lowest-risk item is the strict-mode toggle (§8.4).
It's small, it's the one transparency lever Helena specifically asked about, and it makes the quality
filter auditable. After that, the cross-module roll-out of Layers 1–3 to Neuro-Inclusion and Coaching
intakes is mostly mechanical work — the math primitives in surveyMetrics.service.ts are already
module-agnostic.

Trap items / reverse-coded items are a bigger commitment (template editor changes, copy review,
psychometric review, plus migrations across the existing 11 instruments) and probably want to be batched
as a single "Phase 3 instrument-side upgrade" once Helena has the bandwidth for content work.



**Coaching Module**
 - add mentoring to coaching module
 - repeating schedules for session creation by coach (weekly / monthly)
 1
**Booking**

**IDPs** 
- users need to have access to it and be able to print / follow thru with coach follow up - notifications, reminders, etc.

---------
**Leadership & Succession** 
 - IDP cards - how is the status changed from draft to active to completed?

II. SYSTEM
----------
**Organization setup** 
**Google Test Env**
 - need to switch to prod and have the app approved by google
**Multilingual**
 - missing translations: 
**Sysadmin**
**Placeholders**
 - Billing - contact us to upgrade - create form to send a contact us to system admin via SES. Alternatively let the organization admin upgrade / choose a plan

**Mobile App**

III. LOW
--------
IV. NICE TO HAVE
----------------
 - user guide + how tos

V. TO TEST
----------
 - login - google / microsoft / passkey; forgot password
 - 
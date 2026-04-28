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
Phase 3 — not started

- Trap / attention items — SurveyTemplate.IQuestion has no isTrap / trapCorrectAnswer fields. trapFailed
  is in the dropped-reasons enum but never fires.
- Reverse-coded items + consistency pairs — no reverseCoded or correlatedItemIds on the question schema.
  Without these, the per-respondent inconsistency signal is unbuildable.
- Person-fit (IRT) — needs calibrated item banks, scoped in the design as "future / requires
  psychometrician."
- Timing-based speeding flag in production — pairs with the baseline question above.

Metric pipeline issues observed during case-01-healthy review (2026-04-28):

- **rWG = 0 on uniformly positive distributions** — Communication / Trust / Mgmt Eff / Wellbeing on
  case-01 all returned rWG=0 even though means were 8.5/10 with σ≈0.52. Conventional rWG for that
  distribution should be ~0.97. The expected-variance σ²eu used in computeAllMetrics is likely
  under-sized (treating the scale as a small-band response set). The AI narrative correctly reframes
  these as "ceiling-effect paradox," but on borderline teams the false-positive divergence flag could
  mislead. Investigate computeAllMetrics in surveyMetrics.service.ts.

- **Psychological Safety dimension mean = 5.71** when the actual data is healthy (cp01=8.5, cp02≈9,
  cp03=0/no-incident). The boolean cp03 (0/1 scale) is being averaged with cp01/cp02 (0/10 scale),
  dragging the dimension mean down. Either reverse-score and rescale boolean items to 0-10 before
  averaging, or compute dimension means from continuous-only items.

Phase 4 — research
 groups 
- Bayesian Truth Serum item on opt-in instruments
- Longitudinal respondent calibration — explicitly avoided so far (would require persistent respondent
  linking, conflicts with anonymity contract)

admin@onkwe.com / ivb!6lgN

**Coaching Module**
 - add mentoring to coaching module
 - repeating schedules for session creation by coach (weekly / monthly)
 - **e-signature upgrade (later):** swap the click-to-accept contract flow for
   OpenSign self-hosted in Docker on the EC2 box (AWS Linux 2023). Integrate
   via REST API only — AGPL stays contained inside the container. Webhook
   to /api/coaching/contract/webhook on completion. Coach uploads contract
   template, coachee signs via embedded iframe.
 
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
 - missing translations: ADMIN.themeSaved
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
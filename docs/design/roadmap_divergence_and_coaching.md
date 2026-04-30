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

### 1. Coaching 15.1 — AssessmentRecord foundation
- Model + CRUD routes + S3 PDF attach (reuses `eqi-import.routes.ts` magic-byte validation pattern, key prefix `org/{orgId}/assessments/{assessmentId}.pdf`).
- "Assessments" panel on `engagement-detail.component.ts`, grouped by phase (baseline / midpoint / final / ad-hoc).
- Generic key/value score editor in a new `assessment-dialog/` (handles DISC, Hogan, Leadership Circle, MBTI, CliftonStrengths, custom — anything that isn't EQ-i, which keeps its dedicated PDF pipeline).
- **Why first:** largest unbuilt scope across both projects; unblocks 15.1 phases 2-4 and the IDP bridge. Without it, coaches have no place to record any non-EQ-i instrument.
- **Effort:** ≈1.5 design-doc sessions (smallest of the 15.1 phases).

### 2. Coaching 15.1 — Pre/post comparison dialog
- New `assessment-comparison-dialog/`: bar chart per dimension showing baseline vs final + delta column.
- "Compare" CTA on the Assessments panel, enabled when ≥2 records of the same `assessmentType` exist.
- **Why now:** directly produces the coaching-ROI artifact Helena needs for every engagement close-out.
- **Depends on:** #1.
- **Effort:** ≈1 session.

### 3. Conflict Intelligence — Custom analysis prompts for external instruments
- Per-instrument `analysisPrompt` for TKI, ROCI-II, CDP-I, PSS (currently all four use the default).
- TKI → 5 conflict modes; ROCI-II → 5 handling styles with norm comparisons; CDP-I → constructive/destructive behaviours; PSS → Edmondson's team-safety dimensions.
- **Why high:** instruments are already seeded and accepting responses, but the AI output is generic. Cheap (one prompt per instrument), high value, no schema work — `SurveyTemplate.analysisPrompt` already exists.
- **Effort:** ≈0.5 sessions per instrument; ship as separate small PRs to keep prompt review focused.

### 4. Conflict Intelligence — Automated 30-60 day follow-up pulse scheduling
- Auto-schedule a follow-up pulse when an escalation review is marked complete, or when N% of recommended actions are checked.
- Reuse `SurveyAssignment.recurrence` (already implemented) plus the existing `surveyScheduler` cron.
- Per-org default interval (30 or 60 days), opt-out at the analysis level.
- **Why high:** closes Stage 5 of the module's data flow (the only remaining gap in the core pipeline).
- **Effort:** small — wiring existing primitives. Mostly the trigger logic + a banner on the analysis page showing the scheduled follow-up.

---

## P1 — Following sprints

### 5. Coaching 15.1 — 360 assignment extensions + per-category aggregation
- Extend `SurveyAssignment` with `raterCategory: 'self' | 'manager' | 'peer' | 'direct_report'` (assignment carries the lens; rater never picks).
- Extend `SurveyResponse.raterCategory` (copied from assignment at submit).
- Per-category min-group-size override of `MIN_GROUP_SIZE=5`: self=1, manager=1, peer≥3, direct_report≥3.
- New `assessment360.service.ts`: aggregates responses by category, materialises an AssessmentRecord on completion.
- New `360-setup-wizard/` (extends `survey-template-dialog`): base template → rater roster → dispatch.
- **Depends on:** #1.
- **Effort:** ≈2 sessions (the largest 15.1 phase).

### 6. Coaching 15.1 — 360 → AssessmentRecord + IDP bridge
- Adapter on `succession.routes.ts /idp/generate` to accept `assessmentRecordId` as alternative input to the existing `eqiScores` flat dict.
- Auto-write an `AssessmentRecord` of type `'360'` with category-averaged scores when a 360 completes.
- 360 report view: multi-rater radar with one ring per category.
- **Depends on:** #1, #5.
- **Effort:** ≈1 session.

### 7. Conflict Intelligence — Longitudinal per-department risk comparison
- Extend `reports.routes.ts` with department-scoped trend aggregation (the org-wide trend already exists).
- Per-department line chart on the admin reports page, with overlay for "before / after escalation resolution".
- **Why P1:** closes the "did the intervention work?" reporting gap — currently the only longitudinal view is org-wide.
- **Effort:** ≈1 session (server aggregation + a chart component).

---

## P2 — Lower priority / batch later

### 8. Conflict Intelligence — Toolkit worksheets
- Static or lightly-interactive content for: Interest Mapping Worksheet, BATNA Assessment Guide, Reframing Exercises, Manager Conversation Templates, Balcony Technique.
- **Recommendation:** ship as a single batch of downloadable PDFs first; convert to interactive in-app tools later if usage warrants. Helena's expertise is the bottleneck, not the engineering.
- **Effort:** depends entirely on content production cadence; engineering side is light.

### 9. Conflict Intelligence — Standalone Balcony Technique teaching module
- Currently encoded in the AI prompt only. Stand it up as user-facing educational content.
- **Why P2:** the AI guidance already lands the technique inside every analysis; the standalone module is "nice to have" for self-directed manager learning.

### 10. Divergence Phase 3 — Person-fit (IRT) statistics
- `lz` / `Zh` per respondent based on a calibrated item-response model.
- **Why P2:** requires IRT-calibrated item banks. Needs a psychometrician on the design and probably a research collaboration before going live.
- **Recommendation:** defer until the existing quality signals (straightlining, long-string, trap, speeding, consistency — all already in production) have been observed across enough orgs to justify the lift.

---

## P3 — Research / pilot only

### 11. Divergence Phase 4 — Bayesian Truth Serum on opt-in instruments
- Doubles instrument length per the master design doc.
- **Recommendation:** scope only after #10 has produced a season of operational quality data, and only with an academic collaborator. Leave as a research item until then.

### 12. Divergence Phase 4 — Longitudinal respondent calibration
- Requires persistent respondent linking across surveys, which conflicts with the current anonymous-by-design contract.
- **Recommendation:** flag only — re-evaluate if/when the platform offers an explicit opt-in for non-anonymous longitudinal panels.

### 13. Cross-module roll-out of divergence layers
- Apply quality filter + per-item / dimensional metrics to Neuro-Inclusion and Coaching intakes.
- **Why P3:** Layers 1-3 of the divergence design are module-agnostic; the lift is mostly enabling and i18n. But the conflict module is where polarisation matters most, so other modules can wait until P0-P1 is stable.

---

## What I'd actually ship next

If the goal is **maximum customer-visible value per week of work**, the order I'd lock in:

1. #3 (Custom prompts for external instruments) — half-day work each, high signal for clients already using the seeded TKI/ROCI-II/CDP-I/PSS instruments.
2. #1 (AssessmentRecord foundation) — unblocks every other 15.1 phase and gives coaches an immediate place to drop their existing assessment PDFs.
3. #4 (30-60 day follow-up scheduling) — closes the loop the module already promises in the marketing copy.
4. #2 (Pre/post comparison) — first thing Helena will demo with #1 in place.
5. #5–#6 (full 360 flow) — the larger coaching deliverable, after AssessmentRecord is proven on simpler instruments.

Then move into divergence Phase 3 once the coaching backlog calms down.

---

## Open questions for review

1. **Default follow-up interval (#4):** 30 days, 60 days, or org-configurable with a default? The design doc says "30–60 day pulse" — preference?
2. **Toolkit worksheets (#8):** PDF-only first, or worth doing one as an in-app interactive module to validate format before scaling?
3. **AssessmentRecord roles (#1):** the 15.1 doc says "coach + coachee on the engagement, plus admin/hr_manager. Sponsor never." — confirm sponsor exclusion stays even when sponsor is paying for the engagement.
4. **15.1 phase 1 vs phase 2 split:** the design doc suggests #1 and #2 are separate phases. They could ship together as a single PR (~2.5 sessions) — preference?
5. **Phase 3 howto stale:** `survey_divergence_phase1_howto.md` §5 still lists trap items, consistency pairs, and speeding flag as not-yet-shipped — they are. Worth a doc refresh now or fold into the next divergence-related PR?

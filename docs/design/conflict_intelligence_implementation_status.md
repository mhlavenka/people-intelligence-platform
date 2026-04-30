# Conflict Intelligence Module — Implementation Status

**As of 21 April 2026**
Companion to `conflict_intelligence_module.docx`

---

## Summary

The Conflict Intelligence module is operational with core features fully implemented: both survey instruments seeded as global templates with Harvard Negotiation Project framework prompts, AI-driven analysis producing interest-based narratives and structured manager scripts, three-tier recommended actions with completion tracking, escalation to professional coaches with email/hub notifications, professional review workflow, risk trend reporting, conflict-focused IDP generation, and a skill building section. The main gaps are automated follow-up scheduling (30–60 day pulse), downloadable toolkit worksheets, and custom analysis prompts for the four external instruments (TKI, ROCI-II, CDP-I, PSS).

---

## Section-by-Section Status

### 1. Executive Summary

| Capability | Status | Notes |
|-----------|--------|-------|
| Prediction-and-action system | ✅ Done | Survey → AI analysis → actions → follow-up pipeline operational |
| Anonymous survey data collection | ✅ Done | Min 5 respondents enforced; no individual data exposed |
| AI-driven pattern recognition | ✅ Done | Claude-powered with interest-based prompts |
| Structured intervention frameworks | ✅ Done | Three-tier actions, manager scripts, escalation pathway |
| Interest-based negotiation backbone | ✅ Done | Custom `analysisPrompt` on HNP instruments encodes the full framework |

---

### 2. Theoretical Foundations (2.1–2.5)

These sections are reference material — no implementation required. The theoretical framework is encoded in the AI analysis system prompt stored on the HNP-PULSE and HNP-DEEP instruments.

| Framework | Where It's Encoded |
|-----------|-------------------|
| Four Principles (Fisher, Ury & Patton) | `analysisPrompt` on SurveyTemplate — instructs AI to separate people/problem, focus on interests, generate options, use objective criteria |
| Three Conversations (Stone, Patton & Heen) | Survey category → conversation layer mapping in `analysisPrompt`; categories explicitly labelled in seed (e.g. "Psychological Safety → Feelings + Identity") |
| The Third Side (Ury) | Escalation pathway, multi-role action assignment (Manager, HR, Coach, Team Lead) |
| BATNA | Risk level thresholds trigger escalation pathway as structured alternative |

---

### 3. How the Theoretical Framework Maps to the Module

#### 3.1 Survey Design — Detecting the Three Conversations ✅ Complete

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Bi-Weekly Pulse Survey (15 items, 6 categories) | ✅ Done | `HNP-PULSE` global template, seeded via `seed-conflict-instruments.ts` |
| Quarterly Deep-Dive (21 items, 7 categories) | ✅ Done | `HNP-DEEP` global template, seeded via `seed-conflict-instruments.ts` |
| Psychological Safety → Feelings + Identity | ✅ Done | cp01–cp03, cd05–cd07 |
| Communication & Trust → What Happened? | ✅ Done | cp04–cp06 |
| Conflict Frequency → What Happened? (intensity) | ✅ Done | cp07–cp09 |
| Management Effectiveness → Third Side capacity | ✅ Done | cp10–cp11, cd11–cd12 |
| Escalation Intent → All three (threshold) | ✅ Done | cp12–cp13 |
| Wellbeing & Belonging → Feelings + Identity | ✅ Done | cp14–cp15, cd20–cd21 |
| Interpersonal Dynamics → Identity + What Happened? | ✅ Done | cd08–cd10 |
| Workload & Structural Stressors → What Happened? (structural) | ✅ Done | cd15–cd17 |
| Conflict Culture → All three (norms) | ✅ Done | cd01–cd04 |
| Cross-Team Conflict → What Happened? (cross-boundary) | ✅ Done | cd18–cd19 |
| Leadership & Mediation → Third Side (deep) | ✅ Done | cd11–cd14 |
| Outcomes & Impact → All three (consequence) | ✅ Done | cd20–cd21 |
| Behavioural indicators, not attributional | ✅ Done | All questions measure observable behaviours |
| Mixed methods (scale, boolean, text) | ✅ Done | Each instrument uses scale, boolean, and open-text types |
| Minimum 5 respondents for privacy | ✅ Done | Enforced in `conflict.controller.ts` (`MIN_GROUP_SIZE = 5`) |

#### 3.2 AI Analysis — Interest-Based Conflict Diagnosis ✅ Complete

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Custom system prompt per instrument | ✅ Done | `analysisPrompt` field on `SurveyTemplate` model; controller passes to `callClaude` with fallback to default |
| Interest-based framing in prompts | ✅ Done | HNP prompt instructs AI to identify interests/needs, never assign blame |
| Three Conversations detection rules | ✅ Done | Prompt includes detection patterns (low Psych Safety → Feelings, low Belonging → Identity, etc.) |
| Narrative layer (aiNarrative) | ✅ Done | 2–3 paragraph composite interpretation |
| Quantitative layer (riskScore + riskLevel) | ✅ Done | 0–100 score, four levels (low/medium/high/critical) |
| Pattern layer (conflictTypes) | ✅ Done | Array of structural patterns without personalisation |
| Prompt design doc | ✅ Done | `docs/prompts/conflict-intelligence-analysis.md` |

#### 3.3 Manager Conversation Guide — Principled Negotiation in Practice ✅ Complete

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Primary analysis → manager script (talking points) | ✅ Done | `buildConflictAnalysisPrompt` produces `managerScript` |
| Sub-analysis → structured script (opening/keyQuestions/resolution) | ✅ Done | `buildConflictSubAnalysisPrompt` produces JSON structure |
| Opening → Separate People from Problem | ✅ Done | Prompt: "how to open conversation — shared concerns, not accusations" |
| Key Questions → Focus on Interests | ✅ Done | Prompt: "interest-based questions exploring underlying needs" |
| Resolution → Invent Options for Mutual Gain | ✅ Done | Prompt: "collaborative problem-solving" |
| Frontend rendering of structured scripts | ✅ Done | `conflict-detail.component.ts` parses and renders sections, lists, topic tables |

#### 3.4 Recommended Actions — From Positions to Interests ✅ Complete

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Immediate actions (this week) | ✅ Done | 2–4 items with title, description, owner, priority |
| Short-term actions (2–4 weeks) | ✅ Done | 3–5 items with timeframe |
| Long-term actions (1–3 months) | ✅ Done | 2–3 items with timeframe |
| Preventive measures | ✅ Done | 2–4 plain-text ongoing practices |
| Actions assignable to roles (HR, Manager, Coach, Team Lead) | ✅ Done | `owner` field on each action |
| Action completion tracking | ✅ Done | `completedActions` on ConflictAnalysis, PATCH endpoint, checkbox UI |
| AI-generated follow-up intakes per action | ✅ Done | `generateActionIntake` creates 5–8 question survey per action |

#### 3.5 Escalation Pathway — The Third Side ✅ Complete

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Flag for escalation (HR/Manager clicks escalate) | ✅ Done | `POST /conflict/escalate/:id` with `coachId` and `message` |
| Coach assignment | ✅ Done | `escalatedToCoachId` on ConflictAnalysis model |
| Email notification to assigned coach | ✅ Done | HTML email with risk level, conflict types, AI narrative, action summary, deep link |
| Hub notification | ✅ Done | `createHubNotification` with type `conflict_alert` |
| Professional review: notes, recommendations, status | ✅ Done | `professionalReview` subdocument (pending/in_progress/completed) |
| Status tracking: Pending → In Progress → Resolved/Escalated | ✅ Done | `escalationStatus` enum on model |
| Voluntary only (no auto-escalation) | ✅ Done | Escalation requires explicit user action |

---

### 4. Module Architecture

#### 4.1 Data Flow ✅ Complete

| Stage | Status | Implementation |
|-------|--------|----------------|
| Stage 1: Intake (anonymous surveys, min 5) | ✅ Done | `SurveyResponse` collection, anonymous via `submissionToken` |
| Stage 2: Aggregation (averaged per question) | ✅ Done | `conflict.controller.ts` lines 40–53 |
| Stage 3: AI Analysis (risk score, narrative, types) | ✅ Done | `callClaude` with `buildConflictAnalysisPrompt` |
| Stage 4: Action (recommended actions, completion tracking) | ✅ Done | `generateRecommendedActions`, per-action checkboxes |
| Stage 5: Follow-Up (subsequent pulse surveys) | ⚠️ Partial | Can re-run analysis with new responses; no automated scheduling |

#### 4.2 AI Prompt Design Philosophy ✅ Complete

| Principle | Status | Implementation |
|-----------|--------|----------------|
| Interest-based framing | ✅ Done | All prompts identify patterns/needs, never blame |
| Conversation-ready output | ✅ Done | Manager scripts use open-ended, interest-probing questions |
| Multi-option generation | ✅ Done | Portfolio of actions across time horizons and roles |

#### 4.3 Risk Scoring Model ✅ Complete

| Risk Level | Score Range | Status |
|-----------|-------------|--------|
| Low | 0–30 | ✅ Done |
| Medium | 31–55 | ✅ Done |
| High | 56–75 | ✅ Done |
| Critical | 76–100 | ✅ Done |

Frontend displays risk scores with colour-coded gauges, badges, and bar charts. Admin reports show trend over time.

---

### 5. Survey Instruments

#### 5.1 Bi-Weekly Pulse Survey (15 items) ✅ Complete

Seeded as `HNP-PULSE` (instrumentId), global, active, with custom `analysisPrompt`.

#### 5.2 Quarterly Deep-Dive Analysis (21 items) ✅ Complete

Seeded as `HNP-DEEP` (instrumentId), global, active, with custom `analysisPrompt`.

#### 5.3 Question Design Rationale ✅ Implemented

All questions follow the design principles: behavioural (not attributional), multi-layer coverage, anonymity by design, mixed methods.

---

### 6. The Escalation & Mediation Pathway ✅ Complete

| Step | Status | Notes |
|------|--------|-------|
| 1. Flag for Escalation | ✅ Done | Coach selection + escalation message |
| 2. Initial Consultation | ✅ Done | Coach receives email with AI analysis; reviews in ARTES |
| 3. Mediation Process | ✅ Done | Professional review panel (notes, recommendations) |
| 4. Resolution & Follow-Up | ⚠️ Partial | Review can be marked complete; no automated 30–60 day pulse scheduling |
| Status tracking (Pending → In Progress → Resolved/Escalated) | ✅ Done | Four-stage enum on model |

---

### 7. Skill Building & Development ⚠️ Partially Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Positions & Interests Framework | ⚠️ UI card only | Listed in skill building section but no downloadable worksheet |
| Interest Mapping Worksheet | ⚠️ UI card only | Listed but no downloadable content |
| BATNA Assessment Guide | ❌ Missing | Not referenced in skill building component |
| Reframing Exercises | ❌ Missing | Not referenced in skill building component |
| Manager Conversation Templates | ⚠️ UI card only | "Manager Conversation Planner" card exists; AI generates scripts per analysis but no standalone template library |
| The Balcony Technique | ❌ Missing | Referenced in theoretical docs but no teaching module |
| Conflict Diagnostic Tool | ⚠️ UI card only | Listed but no interactive tool |
| Coaching integration (GROW model IDPs) | ✅ Done | `ConflictIdpDialogComponent` generates IDPs with Goal/Reality/Options/Will, milestones, competency gaps |
| External: EQ-i 2.0 | ✅ Done | Link to MHS storefront + EQ-i PDF import service |
| External: EQ-360 | ✅ Done | Link to MHS storefront |
| External: Myers-Briggs | ✅ Done | Link to official site |
| External: VIA Character Strengths | ✅ Done | Link to viacharacter.org |
| In-Platform: Neuroinclusion module link | ✅ Done | Links to `/neuroinclusion` |
| In-Platform: Leadership IDP link | ✅ Done | Links to `/succession` |
| In-Platform: Coach Interview link | ✅ Done | Links to `/coach/interview` |

#### External Assessment Instruments (Seeded)

| Instrument | Status | Questions | Notes |
|-----------|--------|-----------|-------|
| Thomas-Kilmann (TKI) | ✅ Seeded | 30 | Global, active, forced-choice with ipsative scoring |
| ROCI-II (Rahim) | ✅ Seeded | 28 | Global, active, supports supervisor/subordinate/peer variants |
| CDP-I (Conflict Dynamics Profile) | ✅ Seeded | 32 | Global, active, with behaviour temperature/cluster |
| PSS (Edmondson Psych Safety) | ✅ Seeded | 7 | Global, active, single-construct |
| Custom `analysisPrompt` on external instruments | ✅ Done (2026-04-30) | — | All four instruments now carry framework-specific system prompts: TKI (5 modes, ipsative), ROCI-II (5 styles, normative), CDP-I (4 quadrants × 15 clusters with destructive-behaviour duty-of-care path), PSS-Edmondson (3 benchmark bands). Defined in `backend/src/scripts/external-instrument-prompts.ts`; applied via the idempotent `set-external-instrument-prompts.ts` migration. All include the divergence-aware appendix. |

---

### 8. Ethical Guardrails & Privacy ✅ Complete

| Guardrail | Status | Implementation |
|-----------|--------|----------------|
| Anonymity: min 5 respondents per analysis | ✅ Done | `MIN_GROUP_SIZE = 5` in controller; configurable per template via `minResponsesForAnalysis` |
| AI as advisor, not judge | ✅ Done | Prompt: "diagnostic, not adjudicative… never assign blame" |
| Data tenant isolation | ✅ Done | `tenantFilterPlugin` on ConflictAnalysis; `organizationId` on all queries |
| Human agency: voluntary escalation only | ✅ Done | No auto-escalation; user must select coach and confirm |
| Manager autonomy: scripts are scaffolds | ✅ Done | Scripts generated as suggestions, not mandates |

---

### 9. References & Further Reading

No implementation required. Theoretical reference section.

---

## Completed Tasks

1. ✅ Both HNP survey instruments seeded as global templates with full question sets
2. ✅ Custom `analysisPrompt` field on SurveyTemplate model — per-instrument AI system prompt with fallback
3. ✅ Harvard Negotiation Project framework encoded in analysis prompt (Three Conversations, four principles, risk model)
4. ✅ AI analysis producing interest-based narratives, risk scores, conflict types, and manager scripts
5. ✅ Sub-analysis deep-dive per conflict type with structured manager script (opening/keyQuestions/resolution)
6. ✅ Three-tier recommended actions (immediate/short/long) + preventive measures with role assignment
7. ✅ Action completion tracking with per-action checkboxes
8. ✅ AI-generated follow-up intake surveys per action item
9. ✅ Escalation to professional coach with email notification + hub notification
10. ✅ Professional review workflow (pending → in progress → completed) with notes and recommendations
11. ✅ Four-stage escalation status tracking
12. ✅ Risk scoring model with four levels (low/medium/high/critical)
13. ✅ Risk trend reporting (monthly average, department breakdown) in admin reports
14. ✅ Conflict-focused IDP generation using GROW model
15. ✅ Skill building section with in-platform module links and external assessment links
16. ✅ Four external instruments seeded (TKI, ROCI-II, CDP-I, PSS)
17. ✅ PDF export of conflict analyses
18. ✅ Template dialog with AI Prompt tab for viewing/editing custom system prompts
19. ✅ AI Prompt badge on intake management cards
20. ✅ EQ-i 2.0 PDF import service for development profiles
21. ✅ Ethical guardrails enforced (min group size, tenant isolation, no-blame prompts, voluntary escalation)
22. ✅ AI usage limits per organisation with monthly reset and billing UI
23. ✅ Prompt design reference document at `docs/prompts/conflict-intelligence-analysis.md`

---

## Missing Gaps

> **Status update 2026-04-30:** the original High Priority gap #2 (custom analysis prompts) is now done — see the updated row in §7 above. The roadmap of remaining work has moved to `docs/design/roadmap_divergence_and_coaching.md`, which is the canonical priority list.

### High Priority

| # | Gap | Document Reference | Impact |
|---|-----|-------------------|--------|
| 1 | **Automated 30–60 day follow-up pulse scheduling** | Sections 4.1, 6 — "pulse survey at 30–60 days to measure whether interventions have moved the risk score" | Without this, the feedback loop described in the document (Stage 5: Follow-Up) requires manual re-distribution. The system can re-run analysis with new responses, but there is no scheduler to automatically send follow-up pulses after an escalation resolution or action completion. |
| ~~2~~ | ~~**Custom analysis prompts for external instruments**~~ | ✅ DONE 2026-04-30 — see §7 |

### Medium Priority

| # | Gap | Document Reference | Impact |
|---|-----|-------------------|--------|
| 3 | **Downloadable toolkit worksheets** | Section 7 — Interest Mapping Worksheet, BATNA Assessment Guide, Reframing Exercises, Manager Conversation Templates, The Balcony Technique | UI cards exist in the skill building section but link to nothing. These should be downloadable PDFs or interactive in-app tools. Without them, the skill building section is informational only. |
| 4 | **Longitudinal risk comparison per department** | Section 4.1 — "follow-up measurement closes the loop with objective criteria" | Admin reports show monthly trend charts for the whole organisation, but there is no per-department or per-template longitudinal view showing how a specific team's risk score changed after interventions. |

### Low Priority

| # | Gap | Document Reference | Impact |
|---|-----|-------------------|--------|
| 5 | **Standalone Balcony Technique teaching module** | Section 2.4 — "Go to the Balcony" embedded in design, but no explicit user-facing teaching | The concept is encoded in the AI prompt ("balcony view") but there is no user-facing educational content explaining the technique to managers. |
| 6 | **BATNA Assessment Guide** | Section 7 — "structured evaluation of alternatives to agreement" | Not referenced anywhere in the skill building component. Low priority because the escalation pathway itself serves as the structured BATNA. |

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/src/scripts/seed-conflict-instruments.ts` | Seeds HNP-PULSE + HNP-DEEP with analysis prompt |
| `backend/src/controllers/conflict.controller.ts` | All conflict analysis endpoints (9 total) |
| `backend/src/services/ai.service.ts` | Prompt builders (analysis, sub-analysis, recommended actions) |
| `backend/src/models/ConflictAnalysis.model.ts` | Analysis schema with all fields |
| `backend/src/models/SurveyTemplate.model.ts` | Template schema with `analysisPrompt` field |
| `backend/src/routes/reports.routes.ts` | Risk trend and department breakdown reporting |
| `docs/prompts/conflict-intelligence-analysis.md` | AI prompt design reference document |
| `docs/design/conflict_intelligence_module.docx` | Theoretical foundations and design document |
| `frontend/src/app/modules/conflict/` | All frontend components (dashboard, detail, sub-analysis, actions, escalation, skill building, IDP) |

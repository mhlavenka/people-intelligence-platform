# Survey Divergence — Phase 1 setup & user guide

**Audience:** ARTES org admins and Helena Coaching staff who set up
templates and read conflict-analysis output.
**Status:** Ships with the `feat/survey-divergence-phase1` branch.
**Read first:** `docs/design/survey_divergence_and_truth_signals.md` for the
underlying methodology and ethics.

---

## 1. What this gives you

Until now, conflict analyses aggregated each survey question to a single
mean and handed that mean to Claude. Two teams could land at the same
risk score for completely different reasons — one stuck and uniformly
neutral, one fractured and polarised — and the analysis would read the
same to a manager.

Phase 1 layers four signals on top of every conflict analysis without
changing the headline risk score:

1. **Response quality** — a per-respondent score that flags careless
   answering. Low-quality responses are excluded from the analysis,
   surfaced in aggregate (never per individual).
2. **Per-item divergence** — mean, sd, agreement (`r_wg`), and a
   bimodality coefficient for each item. Items where the team is
   genuinely **split** get flagged.
3. **Dimensional roll-up** — items tagged with the same `dimension`
   (e.g. *Psychological Safety*, *Trust*) aggregate so you see which
   *areas* the team disagrees on.
4. **Team alignment** — a single 0–100 headline number visible on the
   conflict dashboard. Banded **Aligned (≥70) / Mixed (40–69) /
   Fractured (<40)**.

The AI prompt now includes all of the above and is explicitly
instructed to treat divergence as structural signal, not individual
blame. The standing UI disclaimer reinforces the same framing for the
human reader.

---

## 2. One-time setup

### 2.1 Tag the existing conflict templates with dimensions

Phase 1's roll-up only fires when questions carry a `dimension` tag.
The 11 built-in conflict templates were retrofit with a canonical
10-dimension scheme. Run the backfill once per tenant cluster:

```bash
cd backend

# Dry-run — shows what would change, writes nothing
npx ts-node src/scripts/backfill-conflict-dimensions.ts

# Apply
npx ts-node src/scripts/backfill-conflict-dimensions.ts --apply
```

For Helena Coaching's MongoDB Atlas cluster the dry-run reports
**11 templates, 187 questions tagged, 0 skipped**. The script is
idempotent — re-running after `--apply` reports `changed=0` everywhere.

What the script does **not** touch:
- Custom org-created templates (no mapping shipped). The org admin
  picks a dimension per question in the template editor — see §3.2.
- Translation copies (anything with `sourceTemplateId`) — those inherit
  their parent's dimensions when surfaced through the analyzer.

### 2.2 (Optional) Tune the org quality policy

Defaults are conservative — flag-but-include, never auto-reject. They
live on `Organization.surveyQualityPolicy`:

| Field | Default | Effect |
|---|---|---|
| `qualityThreshold` | `0.35` | Responses scoring below this are excluded from analysis |
| `longStringMaxFraction` | `0.80` | ≥80% identical answers ⇒ `longString` flag |
| `minSubgroupN` | `3` | (Phase 2 — subgroup clustering) |
| `showSubgroupAnalysis` | `true` | (Phase 2) |

Helena's tenant currently inherits all defaults. Override only if a
specific org's data justifies it.

### 2.3 Verify the UI

1. Sign in as `admin` or `hr_manager`.
2. Open **Conflict → Dashboard**. The new **Team Alignment** tile
   appears below the Risk Snapshot when at least one analysis has
   metrics. The first time, it'll only show after the next analysis
   is run.
3. Open any conflict analysis (run a new one if all existing analyses
   pre-date this release). A **Divergence Signals** tab appears
   between *AI Recommended Actions* and *Professional Review*.

Legacy analyses (created before this release) keep working; they
simply don't show the divergence tab — the metric fields are absent
on those older `ConflictAnalysis` documents.

---

## 3. Day-to-day use

### 3.1 Reading a divergence panel

Each conflict-analysis detail page now has the **Divergence Signals**
tab. From top to bottom:

**Response quality card** — *“11 of 12 responses included in this
analysis. 1 flagged for low engagement excluded.”* If this number
differs from the headline respondent count, the difference is *quality
exclusions only*. Click the info icon for the exact criteria.

**Team Alignment meter** — the same 0–100 / banded score that
shows on the dashboard tile. Computed as the mean `r_wg` across all
items of this analysis. Three coloured bands:
- **Aligned (≥70):** the team is reporting consistent experience
- **Mixed (40–69):** noticeable spread, expected on a busy team
- **Fractured (<40):** people are not seeing the same workplace

**Dimensional Divergence table** — one row per dimension. Read
right-to-left: a high *Disagreement* number with a low *Agreement*
(`r_wg`) means the team is genuinely split on that area. *Mean* tells
you the direction (low ≈ bad, high ≈ good, depending on the
instrument).

**Most Divergent Items** — up to 10 items, lowest `r_wg` first, with
items flagged as **Split** (bimodality coefficient > 0.555) prioritised.
Each card shows the item text, mean, sd, `r_wg`, and the dimension it
rolls up to.

**Disclaimer** — the standing copy at the bottom is non-negotiable
guidance copy. Don't override it locally.

### 3.2 Adding a dimension to a new template

When creating or editing a template:

1. Open **Assessment Hub → Manage Templates → New / Edit**.
2. For each question, the **Dimension** field (next to *Subscale*)
   accepts free-form text or one of the 13 suggested labels:
   - Psychological Safety, Communication, Trust, Role Clarity,
     Workload & Resources, Conflict Resolution Skills,
     Conflict Frequency / Tension, Management Effectiveness,
     Escalation Intent, Wellbeing & Belonging
   - Plus three psychometric labels: Conflict Style, Conflict
     Behavior, Task / Relationship / Process Conflict
3. Items sharing a dimension aggregate together in the divergence
   panel. Items with no dimension fall into an *Ungrouped* bucket.

You don't have to tag every item — but the more you tag, the richer
the dimensional view becomes.

### 3.3 Using divergence in a coaching / management conversation

The intent is to help the manager ask **better questions**, not to
identify which respondent is the problem. Some patterns to watch for:

| Signal | What it might mean | What to do |
|---|---|---|
| Team alignment **Aligned**, mean **low** | Team agrees things are bad | Address the underlying issue directly |
| Team alignment **Aligned**, mean **high** | Healthy team | Maintain & document what's working |
| Team alignment **Fractured**, no item split | Diffuse disagreement; possibly multiple unrelated frustrations | Open conversation, not a focused intervention |
| **Split** flag on a specific item | Two different lived experiences of the same thing | Likely a structural divide (role / shift / tenure) — design a focus group, not a confrontation |
| Single dimension with high disagreement, others fine | Targeted issue worth a focused intervention | Use the items list to prioritise the next conversation |

**Never** treat divergence as identity — minority voices may be
reporting reality more accurately than the majority.

---

## 4. Phase 2 — subgroup detection (NOW SHIPPED)

A new **Subgroup Patterns** card appears inside the Divergence Signals
tab when k-means clustering on the response vectors yields a
significant structure. Conditions:

- ≥10 accepted responses in the analysis (org policy can raise but
  not lower the floor; default 10).
- Best k (tried at k=2 and k=3) yields silhouette score ≥0.5.
- Every cluster has ≥`minSubgroupN` members (default 3, configurable
  in Org Settings → Survey Quality Policy).

If any of those gates fail, no subgroup card appears — the rest of
the divergence tab still renders.

### What you see
- A stacked bar showing relative cluster sizes (e.g. "A · 6  B · 5").
- Per-cluster cards with the cluster's mean across each tagged
  dimension and the top 3 items where this cluster differs most
  from the overall mean.
- A persistent disclaimer: *"Subgroup patterns are statistical
  clusters, not social groupings. They may reflect role, shift,
  tenure, or recent experience — they do not identify 'sides' of a
  conflict."*

### What we never publish
- Cluster membership (which respondent is in which cluster).
- Cluster IDs that could be cross-referenced with assignment lists.
- Anything below the minimum-N floor.

### AI prompt
The user-message divergence block now includes a SUBGROUP STRUCTURE
section when subgroup analysis is present. The INTERPRETATION GUIDANCE
paragraph instructs Claude to treat clusters as statistical patterns,
not social factions, and never to speculate about who belongs to which
cluster.

### Org-level admin controls (Settings → Organization)
A new **Survey Quality Policy** card exposes:
- Quality threshold (default 0.35) — exclusion floor for the
  per-response quality score.
- Max same-answer fraction (default 80%) — long-string flag.
- Show subgroup analysis (default ON) — disable to suppress Phase 2
  output entirely.
- Minimum members per subgroup (default 3) — the anonymity floor.

## 5. Phase 3 — quality signals (NOW SHIPPED)

The three Phase 3 quality signals are live in production:

- **Trap items.** `SurveyTemplate.IQuestion` carries `is_trap` and
  `trap_correct_answer`. Any response whose answer to a trap item does
  not match the configured key gets the `trapFailed` quality flag (penalty
  0.50 on the quality score).
- **Consistency pairs / reverse-coded items.** `IQuestion.correlated_item_ids`
  plus `reverse_scored` let the editor declare items that should co-vary
  (or anti-vary). A large unexpected contradiction adds the `inconsistent`
  flag (penalty 0.30).
- **Speeding.** `DEFAULT_QUALITY_POLICY.speedingMsPerItemFloor = 2000` ms.
  When `SurveyResponse.timingMsPerItem` is captured (on every submission
  from the current `survey-take` page) and the median per-item time is
  below the floor, the response gets the `speeding` flag (penalty 0.25).
  The floor is per-org-tunable via `Organization.surveyQualityPolicy`.

The template editor (`survey-template-dialog.component.ts`) exposes the
per-question toggles for trap / reverse-coded / correlated set; the AI
prompt for divergence analysis is updated to reflect the new signals.

### What this still doesn't do

- **No person-fit / IRT statistics.** Roadmap P2 — needs calibrated item
  banks and a psychometrician.
- **No Bayesian Truth Serum or longitudinal respondent calibration.**
  Roadmap P3, research items.
- **No cross-module rollout** of the quality filter to Neuro-Inclusion or
  Coaching intakes yet — Conflict Intelligence only. Roadmap P3.

---

## 6. Backend / API reference

| Surface | Where | Notes |
|---|---|---|
| Compute on submit | `survey.routes.ts` `/respond` | Calls `computeQuality` and persists `qualityScore`, `qualityFlags`, `acceptedInAnalysis` on the SurveyResponse. Best-effort — quality scoring failure never blocks a submission. |
| Compute on analyze | `conflict.controller.ts analyzeConflict` | Filters responses by `acceptedInAnalysis`, calls `computeAllMetrics`, persists `responseQuality / itemMetrics / dimensionMetrics / teamAlignmentScore` on the `ConflictAnalysis`. |
| AI prompt enrichment | `ai.service.ts buildConflictAnalysisPrompt` | Prepends QUALITY + PER-ITEM + DIMENSIONAL blocks; appends INTERPRETATION GUIDANCE paragraph. |
| Math primitives | `services/surveyMetrics.service.ts` | All formulas (R<sub>wg</sub>, bimodality coefficient, modified-Z outliers, Shannon entropy) live here. No external deps. |

### Public schema additions

`SurveyResponse`: `qualityScore` (0..1), `qualityFlags[]`,
`acceptedInAnalysis` (default `true`), `timingMsPerItem[]?`.

`SurveyTemplate.IQuestion`: `dimension?` (free-form string),
`is_trap?`, `trap_correct_answer?`, `correlated_item_ids?[]`,
`reverse_scored?`.

`ConflictAnalysis`: `responseQuality`, `itemMetrics[]`,
`dimensionMetrics[]`, `teamAlignmentScore`, `subgroupAnalysis?`
(all optional).

`Organization.surveyQualityPolicy`: `qualityThreshold`,
`longStringMaxFraction`, `minSubgroupN`, `showSubgroupAnalysis`,
`speedingMsPerItemFloor`, `speedingGroupZThreshold`,
`speedingMinCohortN` (see §2.2).

---

## 7. Troubleshooting

**The Divergence Signals tab doesn't appear.**
The analysis pre-dates Phase 1. Run a new conflict analysis on the
same template; the new one will have the metrics. Old analyses are
not back-filled — the responses they were built from may have been
deleted or anonymised.

**The team alignment tile shows a low number after a single analysis.**
The dashboard tile averages the most recent five analyses with
metrics. With one analysis, it equals that analysis's score; the
average smooths out as more land.

**A respondent is sure their response was excluded.**
By design we never expose per-respondent quality flags in the UI.
You can confirm in the database (`SurveyResponse.acceptedInAnalysis`)
during an audit. Helena should never tell a respondent their response
was flagged — that breaks the anonymity contract.

**Translations on the divergence tab are still in English on the
French / Spanish / Slovak UIs.**
Intentional for the first ship. The list of pending strings is in
`docs/i18n-translation-todo.md`. Helena's review of the FR copy
unblocks the next translation batch.

---

## 8. Convert this guide to .docx

This file is markdown so it stays version-controlled with the code.
To produce a Word version for sharing, the easiest path is pandoc:

```bash
pandoc docs/design/survey_divergence_phase1_howto.md \
  -o docs/design/survey_divergence_phase1_howto.docx
```

(Pandoc isn't bundled with the repo. Install once with `brew install
pandoc`, `choco install pandoc`, or via the official installer at
pandoc.org/installing.html.)

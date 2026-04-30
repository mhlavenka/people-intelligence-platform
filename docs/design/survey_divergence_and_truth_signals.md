# Survey Results Interpretation — Divergence, Quality & Truth Signals

**Status:** Proposal for review
**Owner:** HeadSoft Tech × Helena Coaching
**Date:** 2026-04-23
**Scope:** Conflict Intelligence surveys first; design generalises to Neuro-Inclusion, Coaching intakes, Succession assessments.

---

## 1. Problem statement and the re-framing

The prompt: *"individuals causing the issue might be the ones that give different answers as the rest of the focus group."*

This is **sometimes** true, and **often not**. Before we build anything, we should be honest about the failure modes of the hypothesis itself. A respondent whose answers diverge from the group could be:

- the instigator of the conflict,
- **the target** — the one most harmed and therefore most aware,
- **the whistleblower** — the person telling the uncomfortable truth nobody else will say,
- **a minority with different but valid experience** — different shift, project, tenure, or role,
- **a careless respondent** who clicked through without reading,
- **a confused respondent** because the item was ambiguous,
- or **someone in a different power position** whose experience is genuinely different.

Raw statistical divergence is a signal of **real disagreement about reality**. Whether it's dysfunction or truth-telling requires judgement that no aggregation method can supply on its own.

So the re-framed goal is not to *find the problem person*. It is to:

> **Understand the structure of disagreement in the team, and feed that structure into the AI's interpretation — never into individual identification.**

The existing anonymity principle (min group size of 5, aggregation only) is non-negotiable. Within that constraint there is enormous room to do better than the current "mean per question" aggregation.

---

## 2. Why this matters

Today the pipeline aggregates respondents to a per-question mean and hands Claude the mean. That throws away most of the signal:

| Scenario | Mean on a 1-5 item | What the team is actually telling us |
|---|---|---|
| Everyone picks 3 | 3.0 | Team uniformly neutral / stuck |
| Half pick 1, half pick 5 | 3.0 | Team fractured / polarised |
| 80% pick 4, one picks 1 | 3.4 | Mostly aligned, one distressed / whistleblower |
| Bi-modal by role | 3.0 | Structural divide (managers vs ICs) |

These four scenarios need four **different interventions**. Today they look identical to Claude.

Extracting divergence metrics costs us nothing at the respondent level (same anonymous data) and gives the AI a much richer input.

---

## 3. Theoretical foundations

### 3.1 Classical outlier detection

| Technique | Strengths | Weaknesses | Fit for ARTES |
|---|---|---|---|
| **Z-score / SD** | Simple, well known | Assumes normal distribution; sensitive to outliers themselves | Weak — Likert data is rarely normal |
| **IQR (Tukey's fences)** | Non-parametric; robust | Fixed 1.5× cut-off can be too aggressive | OK |
| **MAD — Median Absolute Deviation** | Robust at small N; non-parametric | Less known to stakeholders | **Recommended** — best fit for Likert + small samples |
| **Grubbs' test** | Designed for one outlier in small normal samples | Needs normality; one-outlier assumption | No |
| **Mahalanobis distance** | Multivariate | Needs covariance matrix; unstable at small N | Later, when N>30 |
| **DBSCAN** | Detects outliers as "noise" points | Tuning density params | Phase 2 |

### 3.2 Survey-quality / careless-responding indicators

From the psychometrics literature — Meade & Craig (2012), Curran (2016), DeSimone et al. (2015):

- **Straightlining / non-differentiation** — all answers on the same scale point. Measured by within-respondent variance across items (very low variance = suspicious).
- **Long-string responding** — a run of N identical consecutive answers (the "psychomotor" stand-in for straightlining on long instruments).
- **Speeding** — completion time below a floor (e.g. <2s per item). Requires timing capture on survey-take.
- **Pattern responding** — zigzag, diagonal, cyclic patterns on scales.
- **Attention / trap items** — *"Please select 'Somewhat agree' for this item"*.
- **Inconsistency pairs** — two items that should correlate (e.g. "I trust my manager" and "I feel my manager has my back"). Large discordance = suspect.
- **Directed items with an objectively-verifiable answer** — e.g. tenure validated against HRIS.
- **Person-fit statistics (IRT)** — `lz`, `Zh`. Measures how well an individual's pattern fits the item-response model of the rest. Powerful, but requires IRT-calibrated item banks — a future roadmap piece.

### 3.3 Within-group agreement statistics

- **Variance / standard deviation** per item.
- **R<sub>wg</sub> (James, Demaree & Wolf, 1984)** — within-group agreement on a 0-1 scale. ≥0.70 is a common "good agreement" threshold in org-psych practice.
- **Intraclass Correlation Coefficient (ICC)** — consistency of ratings across respondents; relevant when aggregating individual scores to a group score.
- **Shannon entropy** — information-theoretic disagreement. High entropy = many different answers; zero entropy = perfect agreement. Works on categorical as well as Likert data.
- **Bimodality Coefficient (BC)** — BC > 0.555 strongly suggests a bimodal distribution: the team is not diffusely disagreeing, it is **split**.

### 3.4 Subgroup / cluster detection

When N is large enough (rule of thumb ≥10 with at least ≥3 per prospective subgroup), we can cluster the **response vectors** without ever exposing who belongs where:

- **K-means** (k=2, k=3) with silhouette score to validate separation quality.
- **Hierarchical clustering** (Ward linkage) — gives a dendrogram; useful when cluster count is unknown.
- **DBSCAN** — density-based; naturally surfaces outliers as noise points rather than forcing them into a cluster.

Report format to Claude and the UI: *"Two distinct response patterns detected (silhouette 0.71). Cluster A (5 respondents) reports low psychological safety and high workload; Cluster B (3 respondents) reports adequate safety and moderate workload."* — no names, no role mapping from the platform side (the human reader may infer a plausible structural explanation, e.g. a manager/IC split).

### 3.5 Truth-elicitation mechanisms (future-looking)

- **Bayesian Truth Serum — Prelec (2004).** Ask each respondent (a) their own answer and (b) their prediction of the distribution of answers across the group. The mechanism mathematically rewards answers that are "surprisingly common" — more common in reality than respondents predicted — and these answers are disproportionately honest rather than strategic. Doubles instrument length; mention as a Phase 3 / research item.
- **Forecasting / calibration items** — ask respondents to predict future observable events (next quarter's attrition, etc). Over time you get a per-respondent calibration score, completely separate from conflict reporting. Could be used as a trust weight on their other responses. Heavy lift; flag only.

### 3.6 Principled limits — why "more data" can't identify who is wrong

Two results from decision theory are worth citing so we keep our claims honest:

- **Aumann's Agreement Theorem (1976).** Two rational Bayesian agents with common priors cannot agree to disagree once they share all evidence. Real-world agents disagree because they possess **different evidence** — different experiences of the same team. Divergence therefore tells us *people are seeing different things*, not that someone is mistaken.
- **Condorcet's Jury Theorem.** The majority is more likely correct than any individual *if* every member has >½ probability of being right on the question. In workplace conflict this condition frequently fails — the minority voice may be closer to the truth (e.g. a bullying situation that only one person is brave enough to name).

Implication: **statistical majority ≠ truth**. Any feature we build has to respect that.

---

## 4. Ethical guardrails (non-negotiable)

1. **Min group size 5** — existing rule, keep.
2. **Min subgroup size 3** — for any cluster we report, the cluster must have ≥3 members, else we don't publish it.
3. **No individual respondent surfaces in the UI**, ever. Quality scores live on the respondent record server-side and are used only for filtering before aggregation.
4. **Outputs phrase divergence as structure, not blame.** Copy review required for every new label.
5. **AI prompts explicitly instruct Claude** that divergence is not evidence of individual dysfunction.
6. **A prominent disclaimer** next to every divergence panel: *"Divergent responses reflect different experiences, not different truths. Use these signals to explore, not to judge."*
7. **No "find the dissenter" mode.** Even if the platform could technically rank respondents by distance-from-group, we do not expose it and we do not build internal UIs that lead there.

These guardrails are both ethical and competitive — they are the reason organisations can ask employees to respond honestly.

---

## 5. Current state in ARTES

- `conflict.controller.ts` aggregates responses to per-question means before handing them to `buildConflictAnalysisPrompt()`.
- `SurveyResponse` captures raw responses but no quality indicators.
- The minimum-group-size guard is enforced at aggregation time.
- Nothing about variance, bimodality, subgroups, or respondent quality is computed or shown.

---

## 6. Proposed analytical layers

Five layers stacked on top of what we already have. Each layer is additive — none requires changing the shape of existing survey instruments.

### Layer 1 — Response Quality Filter (pre-aggregation)

For every submitted `SurveyResponse` compute:

- `variance_within` — variance of the respondent's answers across items (low = straightlining candidate).
- `longest_run` — longest consecutive run of the same answer.
- `speed_seconds_per_item` — median seconds per item, if timing is captured.
- `trap_failed` — count of failed attention / trap items (only if the template has any).

Aggregate into `qualityScore ∈ [0,1]` with flags. Responses below a threshold get `acceptedInAnalysis=false` and are excluded from aggregation. The analysis records *how many* were dropped and *why* (in aggregate — no respondent IDs).

Conservative default threshold (can be tuned per org later):

```
acceptedInAnalysis = (qualityScore >= 0.35)  AND  (longest_run <= 80% of items)
```

### Layer 2 — Per-item Divergence Metrics

After quality filter, per question:

```
{
  mean, median, sd, iqr,
  bimodalityCoef,
  entropy,
  rwg,                     // within-group agreement
  outlierCount             // respondents with |modified Z| > 3.5 on this item
}
```

### Layer 3 — Dimensional Divergence Roll-up

Each `SurveyTemplate` question optionally has a `dimension` tag (Communication, Trust, Psychological Safety, Workload, Role Clarity, etc. — already implicit in the instrument design). Roll the per-item metrics up to a per-dimension view so Claude and the UI can say:

> *"Trust dimension: mean 3.1, agreement R<sub>wg</sub> = 0.42 (low). Two of the three trust items are bimodal. The team is not uniformly distrustful — it is split on trust."*

### Layer 4 — Subgroup Detection (gated on N≥10)

Cluster respondents on their full response vector:

1. Run K-means for k=2 and k=3.
2. Compute silhouette score; keep the k with highest silhouette if ≥0.5, else report no significant subgroups.
3. Enforce **min 3 per cluster**; if any cluster is <3, drop subgroup analysis entirely for this run.
4. For each cluster, compute per-dimension mean and identify the items that most distinguish the cluster from the other(s).
5. Publish cluster **size** and **profile**, not membership.

### Layer 5 — Enriched AI Prompt

The AI prompt builder (`buildConflictAnalysisPrompt` in `ai.service.ts`) gets a new block:

```
QUALITY
- 12 responses submitted; 11 accepted, 1 dropped (straightlining).

PER-ITEM DIVERGENCE (top 3 by disagreement)
- Q7 "I feel safe expressing concerns" — mean 2.8, sd 1.6, bimodal (BC 0.62).
  6/11 score ≤2; 5/11 score ≥4. Team is split on psychological safety.
- Q12 "My manager has my back" — mean 3.1, sd 1.4, bimodal (BC 0.58).
- Q3 "Disagreements are resolved constructively" — mean 2.4, sd 1.2, unimodal low.

DIMENSIONAL DIVERGENCE
- Psychological Safety: mean 2.9, Rwg 0.41 (low agreement)
- Trust: mean 3.0, Rwg 0.49 (low)
- Communication: mean 3.2, Rwg 0.72 (good agreement; uniformly mediocre)

SUBGROUP STRUCTURE
- Two distinct response patterns detected (k=2, silhouette 0.71).
- Cluster A (6 respondents): low psychological safety (1.9), low trust (2.1),
  high workload (4.3). Distinguishing items: Q7, Q12, Q18.
- Cluster B (5 respondents): moderate safety (3.9), moderate trust (3.7),
  moderate workload (3.1). Distinguishing items: Q7, Q12.

INTERPRETATION GUIDANCE (for Claude)
Treat divergence as structural signal, not individual blame. Consider role,
shift, tenure, and recent events when interpreting subgroup patterns. Minority
voices may reflect truth rather than dysfunction.
```

Claude's system prompt is extended with an explicit instruction to use divergence to **calibrate confidence** and **propose interventions that do not single out individuals**.

---

## 7. Data model

### 7.1 Additions to `ConflictAnalysis`

```ts
responseQuality: {
  totalSubmitted: number,
  acceptedCount: number,
  droppedCount: number,
  droppedReasons: {
    straightlining: number,
    longString: number,
    speeding: number,
    trapFailed: number
  }
},

itemMetrics: [{
  questionId: string,
  mean: number, median: number, sd: number, iqr: number,
  bimodalityCoef: number,
  entropy: number,
  rwg: number,
  outlierCount: number
}],

dimensionMetrics: [{
  dimension: string,               // 'communication' | 'trust' | ...
  mean: number,
  rwg: number,
  disagreementScore: number,       // 0-100 composite
  mostDivergentItemIds: string[]
}],

subgroupAnalysis?: {
  k: number,
  silhouette: number,
  clusters: [{
    label: string,                 // 'A', 'B', 'C'
    size: number,
    meanByDimension: Record<string, number>,
    distinguishingItemIds: string[]
  }]
}
```

### 7.2 Additions to `SurveyResponse`

```ts
qualityScore: number,              // 0-1
qualityFlags: string[],            // ['straightlining', 'longString', 'speeding']
acceptedInAnalysis: boolean,
timingMsPerItem?: number[]         // only if captured on submit
```

### 7.3 Additions to `SurveyTemplate`

```ts
questions: [{
  ...existing,
  dimension?: string,              // optional tag for Layer 3 roll-up
  reverseCoded?: boolean,          // for consistency checks
  correlatedItemIds?: string[],    // "these items should co-vary"
  isTrap?: boolean,                // "correct answer is X" attention item
  trapCorrectAnswer?: string       // reference for trapFailed detection
}]
```

### 7.4 Organization config

```ts
surveyQualityPolicy: {
  qualityThreshold: number,        // default 0.35
  longStringMaxFraction: number,   // default 0.80
  minSubgroupN: number,            // default 3
  showSubgroupAnalysis: boolean    // default true
}
```

---

## 8. UI treatment on the analysis detail page

Three new panels, below the existing headline risk-score and narrative:

### 8.1 Response quality card

A single compact line:

> *11 of 12 responses included in analysis. 1 response flagged for low engagement was excluded.*

Tooltip: *"Responses are excluded when they show signs of careless answering (e.g. the same answer to most questions). Exclusion is automatic and anonymous."*

### 8.2 Signal structure panel

- **Team alignment** meter — a 0-100 score derived from mean R<sub>wg</sub> across items. Three bands: aligned / mixed / fractured.
- Heat map of items, coloured by disagreement level.
- Items with bimodality coefficient > 0.555 get a split icon and "Team is split on this" label.

### 8.3 Subgroups panel (only if detected, N ≥ 10, silhouette ≥ 0.5, min 3 per cluster)

- Header: "Two viewpoints detected in this team."
- A stacked bar showing cluster sizes.
- For each cluster: a small radar/polar chart of its mean across the main dimensions.
- Distinguishing items list.
- Standing disclaimer banner:
  > *"Subgroup patterns are statistical clusters, not social groupings. They may reflect role, shift, tenure, or recent experience — they do not identify 'sides' of a conflict."*

### 8.4 Re-run / toggle

Admin-level toggle to see the same analysis with and without quality filtering, so they can audit how many respondents were dropped and whether exclusions look right.

---

## 9. Integration with the existing ARTES ecosystem

| Concern | Existing module / file | How it's used |
|---|---|---|
| Aggregation + metric computation | `backend/src/controllers/conflict.controller.ts` | Add a `computeSurveyMetrics()` step between fetch and prompt build |
| AI prompt enrichment | `backend/src/services/ai.service.ts` — `buildConflictAnalysisPrompt` | New metrics block + interpretation guidance appended |
| Response quality capture | `backend/src/routes/survey.routes.ts` — `/api/surveys/respond` | Compute qualityScore on submit; store on `SurveyResponse` |
| Response timing capture | Frontend `survey-take.component.ts` | Optional; lightweight timestamp buffer emitted with submission |
| Dimension tagging | `SurveyTemplate` admin UI | Add a per-question `dimension` dropdown in `survey-template-dialog.component.ts` |
| Divergence panel | Frontend `conflict-detail.component.ts` (or new `divergence-panel.component.ts`) | Reads `itemMetrics` / `subgroupAnalysis` from the analysis |
| Team alignment score on dashboard | `conflict-dashboard-home.component.ts` | New tile alongside risk counts — org-level average of most recent analyses |
| Admin policy | `organization-settings.component.ts` | New "Survey quality policy" card |
| i18n | `assets/i18n/{en,fr,es,sk}.json` + `check-translations.js` | Same pipeline. Every new label and disclaimer translated across four languages |
| Mobile | Android / iOS survey-take wrappers | No change for Phase 1 — server-side filter runs regardless of client |
| Privacy / compliance | `tenantResolver`, aggregation guard | Min-5 guard already enforced; add min-3 subgroup guard in metric computation |

### 9.1 What we do NOT change

- Question scoring and the 0-100 risk score stay exactly as today. This proposal adds an **interpretation layer**; it does not rewrite the headline metric.
- The existing Neuro-Inclusion and Coaching surveys can adopt Layers 1-3 (quality + per-item metrics + dimensional roll-up) with no module-specific code changes. Subgroup analysis (Layer 4) is Conflict-specific for Phase 1.

---

## 10. Phasing

> **Status update 2026-04-30:** Phases 1, 2, and most of Phase 3 are shipped. Person-fit (IRT) and the cross-module rollout remain. Phase 4 items remain research-only. The canonical living priority list is now `docs/design/roadmap_divergence_and_coaching.md`.

### ✅ Phase 1 — Quality filter + per-item / dimensional metrics  *(shipped)*

- Server: straightlining + long-string detection, quality score, exclusion
- Per-item metrics (mean, median, sd, iqr, entropy, bimodality, R<sub>wg</sub>)
- Dimension roll-up (if dimensions are tagged; otherwise "Ungrouped")
- AI prompt enrichment
- UI: response-quality card + signal-structure panel
- i18n in all four languages

### ✅ Phase 2 — Subgroup detection  *(shipped)*

- K-means 2/3 + silhouette validation + min-3 guard
- Subgroups panel + disclaimer copy
- AI prompt update for subgroup interpretation
- Admin policy toggle

### Phase 3 — Advanced signals  *(mostly shipped)*

- ✅ Timing capture on survey-take  *(shipped)*
- ✅ Trap items in `SurveyTemplate` (`is_trap` + `trap_correct_answer`)  *(shipped)*
- ✅ Consistency pairs + reverse-coded items (`correlated_item_ids` + `reverse_scored`)  *(shipped)*
- ✅ Speeding flag wired in (`speedingMsPerItemFloor`, default 2000 ms; per-org tunable)  *(shipped)*
- Person-fit (IRT) — requires calibrated item banks; scope with a psychometrician  *(remaining, P2)*
- Cross-module roll-out (Neuro-Inclusion, Coaching intakes)  *(remaining, P3)*

### Phase 4 — Research / pilot  *(remaining)*

- Bayesian Truth Serum-style item on opt-in instruments
- Longitudinal respondent calibration (separate from any identifying use)

---

## 11. Key design decisions — need your call before we build

1. **Quality threshold philosophy** — strict (default-exclude anything suspicious) vs permissive (flag but include)?
   **Recommendation:** permissive default (threshold 0.35). Expose a toggle so admins can view the analysis strict if they want.
2. **Dimension tagging** — do we retro-fit dimensions onto the existing pulse / deep-dive instruments, or only apply to new templates?
   **Recommendation:** retro-fit both existing instruments; the conflict design doc already names the dimensions.
3. **Subgroup minimum N** — 10 respondents, min 3 per cluster. Comfortable?
   **Recommendation:** yes; anything smaller risks deanonymisation.
4. **Subgroup visibility** — show to managers, or only to hr_manager and admin?
   **Recommendation:** same visibility as the rest of the analysis. Withholding subgroups from managers feels paternalistic and undermines trust.
5. **Team alignment score** — publish it on the dashboard alongside risk counts?
   **Recommendation:** yes. It is one of the most important signals.
6. **Capture response timing on survey-take?** — non-trivial UX and privacy call.
   **Recommendation:** yes, but store only aggregate per-response (median ms per item); drop individual keystroke data.
7. **Trap items in templates** — opt-in per-template or standard?
   **Recommendation:** opt-in. Not every instrument needs them and they can annoy honest respondents if overused.
8. **Language of disclaimers** — the *"divergence ≠ guilt"* banner copy needs Helena's review.
9. **Ethics review** — do we want an external advisor (e.g. an industrial/org psychologist) to review Phase 2 before we ship subgroup UI?
   **Recommendation:** yes, one read-through before general availability.

---

## 12. Risks and open questions

### Risks

- **Risk — "find the problem person" misuse.** A determined manager could try to back-solve individual identity from subgroup patterns. *Mitigation:* min-3 subgroup size, no item-respondent map ever surfaced, explicit policy in ToS.
- **Risk — honest dissenters dropped as "careless".** A thoughtful respondent who answers very similarly across items because they genuinely feel similarly about everything triggers the straightlining flag. *Mitigation:* conservative threshold; require multiple signals (straightlining *and* long-string *and* speeding); flag-but-include by default.
- **Risk — false subgroup detection.** K-means will always find clusters even in pure noise; silhouette threshold guards against this but not perfectly. *Mitigation:* silhouette ≥0.5 floor, multiple-k comparison, report "no significant subgroups" prominently when the score is below threshold.
- **Risk — interpretation collapses to "who is the problem".** Even with our framing, readers may project their prior assumptions. *Mitigation:* persistent UI disclaimer, AI prompt explicitly forbids attribution, copy review.
- **Risk — chilling effect on honest responses.** If employees suspect the platform is trying to identify dissenters, response rates crater. *Mitigation:* publicly visible privacy statement linked from every survey-take page; continue to honour the existing commitments; external audit if needed.
- **Risk — small teams cannot get subgroup analysis.** A 7-person team will never see subgroup signals. *Mitigation:* accept this; aggregate across teams or quarters where appropriate, but only with explicit org approval.

### Open questions

- **Reverse-coded items and instrument change.** To compute consistency pairs we need to retro-fit item metadata. Is that revisable in existing deployed templates, or do we wait for a new version?
- **Cross-survey patterns.** Can we detect when the same respondent straightlines across multiple surveys over time? That would be a strong quality signal — but it also requires persistent respondent linking, which we deliberately avoid in anonymous instruments.
- **Multi-language effect on metrics.** R<sub>wg</sub> and bimodality should be language-agnostic on Likert data, but free-text item analysis is not. When we extend this to open-text items (e.g. word-embedding-based disagreement), language normalisation becomes non-trivial.
- **Research collaboration.** Some of the more advanced techniques (person-fit, BTS) would benefit from an academic collaborator to validate them on real ARTES data before we publish findings from them. Worth a conversation with Helena's network.

---

## 13. What I'm asking for

1. **A 1-hour review** with Helena on §4 (ethical guardrails) and §11 (disclaimer language) — these are the parts where copy matters more than code.
2. **A decision on §11.1 (quality threshold philosophy)** and §11.2 (retrofit dimensions or not) — these drive scope.
3. **A sign-off to start Phase 1** once the above are settled. Phase 1 is low-risk, additive, and delivers most of the interpretive value by itself.

Once those are agreed I'll convert this into a concrete implementation plan with estimates, matching the format of the Escalation-to-Pro proposal.

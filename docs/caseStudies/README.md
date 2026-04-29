# Conflict Intelligence — Bi-Weekly Pulse Survey · Case Studies

Ten scenarios for testing the divergence pipeline end-to-end. Each .md
contains a self-contained per-respondent answer matrix plus the expected
divergence signature, so the seed script (to be written after review) can
drop responses straight from these files into the database.

| # | File | N | Pattern | What it tests |
|---|---|---|---|---|
| 01 | [01-aligned-and-healthy.md](01-aligned-and-healthy.md) | 8 | Aligned, high means | Control case — should produce Low risk, Aligned band, no splits |
| 02 | [02-aligned-but-mediocre.md](02-aligned-but-mediocre.md) | 10 | Aligned, mid means | "Stuck" team — high alignment is not the same as healthy |
| 03 | [03-polarised-after-merger.md](03-polarised-after-merger.md) | 8 | Bimodal, mid means | Fractured signature — same headline as 02, completely different intervention |
| 04 | [04-two-shifts-two-realities.md](04-two-shifts-two-realities.md) | 12 | Bimodal-by-shift | Subgroup detection (k=2, silhouette ≥0.5, clusters of 6) |
| 05 | [05-lone-whistleblower.md](05-lone-whistleblower.md) | 10 | 9 satisfied + 1 outlier | outlierCount, histograms, NO subgroup, minority-voice narrative |
| 06 | [06-quiet-tension-suppression.md](06-quiet-tension-suppression.md) | 10 | Low conflict + low safety | Suppression pattern — AI must recognise "going underground" |
| 07 | [07-the-manager-question.md](07-the-manager-question.md) | 12 | Single dimension fractured | Dimensional roll-up isolates fracture to Management Effectiveness |
| 08 | [08-inner-circle-outer-circle.md](08-inner-circle-outer-circle.md) | 10 | Trust dimension fractured | Peer-to-peer divide; not a manager problem |
| 09 | [09-code-red.md](09-code-red.md) | 8 | Aligned-low, escalation-ready | Critical risk; multiple HR-intervention requests |
| 10 | [10-quality-filter-catches-straightliner.md](10-quality-filter-catches-straightliner.md) | 11 (10 accepted) | 1 careless responder | Quality filter drops 1; audit toggle visible |

## What each scenario exercises in the pipeline

| Pipeline component | Cases that exercise it |
|---|---|
| Layer 1 — quality filter / straightlining / longString | **10** |
| Layer 2 — per-item r_wg, bimodality, outlier counts | **all** |
| Layer 3 — dimensional roll-up | **all**, especially **07** (single-dim fracture) and **08** (different single-dim fracture) |
| Layer 4 — subgroup detection (k-means + silhouette + min-3) | **04** (should fire), **05** / **07** / **08** (should NOT fire — verifies the floor) |
| Team Alignment headline (0–100, banded) | **01** Aligned-high, **02** Aligned-mid, **03**/**04** Fractured, **09** Aligned-low |
| Histograms (Phase 1 visual) | **05** (1-bar at low end), **03**/**04** (bimodal bars), **09** (left-cluster) |
| Disagreement heatmap | **07** isolates the red row; **04** shows multiple red rows |
| Dimensional radar (Phase 2 visual) | **04** has cluster overlay; **07** shows one collapsed axis |
| Audit-mode toggle | **10** (toggle visible because dropped > 0); **all others** toggle hidden |
| AI narrative — "minority voice" framing | **05** |
| AI narrative — "suppression risk" framing | **06** |
| AI narrative — "structural divide, do not identify" | **04**, **08** |
| AI narrative — "external mediation required" | **09** |

## How the seed script should work (when written)

1. Drop existing test data for these orgs/departments.
2. Create one organisation per scenario (or one shared org with one
   department per scenario — preferred for tenancy isolation).
3. For each scenario, create the Bi-Weekly Pulse template assignment +
   N anonymous SurveyResponse documents matching the matrix exactly.
4. Mark all responses as `acceptedInAnalysis: true` initially **except**
   in case 10 where the straightliner should still pass through
   `computeQuality()` naturally (no manual override — we want to verify
   the quality score actually flags it).
5. Print a list of `(orgSlug, departmentId, templateId)` tuples so the
   user can run analysis manually for each one.

## Conventions across all matrices

- Scale items 1–10. **Higher = better** for cp01, cp02, cp04, cp05, cp06,
  cp10, cp11, cp14. **Higher = worse** for cp07 (tension intensity) and
  cp09 (productivity impact).
- Booleans 0 or 1. **1 = bad signal** for cp03, cp08, cp12.
- cp13 and cp15 are free text — included as illustrative quotes per
  scenario, not strictly necessary for the metric pipeline.
- Scale defaults to 1–10 because the seed instrument doesn't set
  `scale_range` (the survey-take renderer falls back to that range).


## How to run when you're ready

From /backend:

# Dry-run (safe — re-runs the inspection without touching the DB)
npx ts-node src/scripts/seed-divergence-case-studies.ts

# Apply all 10 cases
npx ts-node src/scripts/seed-divergence-case-studies.ts --apply

# Apply just one case (e.g. for iterating on case 04)
npx ts-node src/scripts/seed-divergence-case-studies.ts --case 04 --apply

What --apply will do

1. Add 10 new department slugs to Onkwe.departments[] (first run only).
2. For each case: delete any existing SurveyResponse + ConflictAnalysis documents scoped to (org=Onkwe,
   dept=case-N) (idempotent re-seeds).
3. Insert the per-respondent rows from each .md matrix as anonymous SurveyResponse documents.
4. Run the live computeQuality() per row so case 10's straightliner is naturally flagged
   (acceptedInAnalysis = false) by the actual filter — no manual override.

After seeding, to run analyses manually

For each case:
1. Open ARTES → Conflict → Analysis
2. Click Run Analysis
3. Pick the Bi-Weekly Pulse template
4. Pick the case department (e.g. case-04-shifts)
5. Name it (e.g. Case 04 — Two Shifts)
6. Submit

Or via API directly: POST /api/conflict/analyze with { templateId, departmentId: 'case-04-shifts', name:
'...' }.

Once the analyses are in, the divergence panel + radar + heatmap + sparkline + sidebar all light up
against real test data — and we can compare each case's actual numbers against the predicted signatures
in the .md files.
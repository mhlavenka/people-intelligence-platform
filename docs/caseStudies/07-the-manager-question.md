# Case Study 07 — The Manager Question (single-dimension fracture)

## Scenario
A team that gets along well, communicates fine, has decent psychological
safety — but is **completely split on the manager**. Half the team thinks
the manager is great, half thinks they're ineffective. Every dimension
except Management Effectiveness shows healthy alignment; Management
Effectiveness shows a textbook bimodal distribution.

This case verifies the **dimensional roll-up** correctly isolates the
fracture to one dimension. Most r_wg values stay healthy (≥0.7) while
Management Effectiveness drops to near-zero, with cp10 and cp11 flagged
as Split. The disagreement heatmap should show one red dimension row in a
sea of green.

## Organisation
- **Industry:** Marketing agency
- **Team:** Brand strategy
- **Department slug:** `brand-strategy`
- **N respondents:** 12 (mixed seniority)

## Conflict signature being tested
- Psych Safety mean ~7, rwg ≥0.95
- Communication & Trust mean ~7, rwg ≥0.95
- Conflict Frequency mean ~3, rwg ≥0.95
- **Management Effectiveness mean ~5.5 (the bimodal halfway point), rwg ≈0**
- Wellbeing mean ~6.5, rwg ≥0.9
- cp10 and cp11 BOTH at rwg=0 (Split)
- N=12 ≥ 10 and the fracture is clean 6+6 — k-means separates cleanly,
  silhouette ≥0.7 → subgroup card SHOULD fire
- AI narrative explicitly names the manager-effectiveness divide

## Expected metric outcomes
| Signal | Expected |
|---|---|
| Risk score | 55–70 (High) — magnitude calibration: a 6-respondent cluster reporting their manager as ineffective is active conflict, not stable mediocrity. Subgroup detector firing with high silhouette confirms the structural read. |
| Team Alignment | 80+ (Aligned-high) — the team IS broadly aligned. The fracture lives in *one dimension*, which surfaces in the dimensional roll-up / heatmap (one red row), NOT in the headline alignment score. Earlier expectation of 50-65 conflated "any fracture" with "overall fractured". |
| Psych Safety mean | ~7.4, rwg ≥0.95 |
| Communication & Trust mean | ~7.25, rwg ≥0.95 |
| Management Effectiveness mean | ~5.5, rwg ≈0 (FRACTURED) |
| Split items | cp10, cp11 (both at rwg=0) |
| Subgroups | k=2, silhouette ≥0.7, clusters of 6 each, distinguishing items cp10/cp11 + one ancillary (cp14 or similar) |
| AI narrative | "Targeted issue: Management Effectiveness; everything else is fine; the team is divided about how the manager handles conflict and respect" — name cp10/cp11 by their actual text, contrast Cluster A's low manager scores (~2.5) with Cluster B's healthy ones |
| conflictTypes vocabulary | "Management credibility gap", "Structural split on manager fairness and respect-creation (cp10, cp11)", "Management Effectiveness fracture" — fracture vocabulary is correct here because subgroup fired with high confidence (this is NOT the minority-voice case) |

## Per-respondent answer matrix
R1–R6 think manager is great; R7–R12 think manager is ineffective.

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 7    | 8    | 0    | 7    | 7    | 7    | 3    | 0    | 3    | 9    | 9    | 0    | 8    |
| 2   | 8    | 7    | 0    | 7    | 8    | 7    | 2    | 0    | 2    | 8    | 9    | 0    | 7    |
| 3   | 7    | 7    | 0    | 8    | 7    | 8    | 3    | 0    | 3    | 9    | 8    | 0    | 7    |
| 4   | 8    | 8    | 0    | 7    | 7    | 7    | 2    | 0    | 2    | 8    | 9    | 0    | 8    |
| 5   | 7    | 7    | 0    | 7    | 8    | 7    | 3    | 0    | 3    | 9    | 9    | 0    | 7    |
| 6   | 8    | 7    | 0    | 7    | 7    | 8    | 3    | 0    | 2    | 9    | 8    | 0    | 7    |
| 7   | 7    | 7    | 0    | 7    | 7    | 7    | 3    | 0    | 3    | 2    | 3    | 0    | 6    |
| 8   | 7    | 8    | 0    | 8    | 7    | 7    | 2    | 0    | 3    | 3    | 2    | 1    | 6    |
| 9   | 8    | 7    | 0    | 7    | 8    | 7    | 3    | 0    | 3    | 2    | 3    | 0    | 6    |
| 10  | 7    | 7    | 0    | 7    | 7    | 8    | 3    | 0    | 2    | 3    | 2    | 0    | 6    |
| 11  | 7    | 8    | 0    | 7    | 7    | 7    | 3    | 0    | 3    | 2    | 3    | 1    | 6    |
| 12  | 8    | 7    | 0    | 8    | 7    | 7    | 2    | 0    | 3    | 3    | 2    | 0    | 6    |

## Open-text responses
- **cp13** (R7–R12): "leadership" / "manager"
- **cp13** (R1–R6): blank or "workload"
- **cp15** (R7–R12): "Manager has favourites" / "Conflict goes unresolved because the manager doesn't act on it"
- **cp15** (R1–R6): blank or "team is great"

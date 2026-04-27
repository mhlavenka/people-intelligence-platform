# Case Study 08 — Inner Circle / Outer Circle (trust stratification)

## Scenario
A team where some members are *inside* the relational architecture — high
trust with peers, open communication, high comfort speaking up — and others
are *outside* it. The fracture is on **Communication & Trust** specifically;
psychological safety and management ratings are mid-aligned because the
manager is decent but the team's internal dynamics are stratified.

This is subtler than the Manager Question (Case 07) because the divide is
peer-to-peer, not vertical. It's also smaller-N than Two Shifts (Case 04),
so subgroup detection won't fire — the signal lives in r_wg + bimodality.

## Organisation
- **Industry:** University research lab
- **Team:** Computational biology lab (PI + postdocs + PhD students)
- **Department slug:** `comp-bio`
- **N respondents:** 10

## Conflict signature being tested
- Psych Safety mean ~6, r_wg ~0.6 (mixed)
- **Communication & Trust mean ~5.5, r_wg ≤0.2 (fractured)**
- Conflict Frequency mean ~4, r_wg ~0.5
- Management Effectiveness mean ~6.5, r_wg ~0.6
- Wellbeing mean ~6, r_wg ~0.5 (some belong, some don't)
- Split items: cp04, cp05, cp06 (and possibly cp14)
- No subgroup detection (N=10 but silhouette likely below threshold —
  the split is on a few items, not the full vector)

## Expected metric outcomes
| Signal | Expected |
|---|---|
| Risk score | 50–60 (Medium-High) |
| Team Alignment | 35–55 (Fractured/Mixed) |
| Communication & Trust r_wg | ≤0.2 (the fractured dimension) |
| Other dimensions r_wg | ~0.5–0.7 |
| Split items | cp04, cp05, cp06 |
| Subgroups | None (cluster shape unstable across only 3 items) |
| AI narrative | "Trust stratification — peer-to-peer divide visible in trust/communication items; not a manager problem; not a uniform morale problem" |

## Per-respondent answer matrix
R1–R5 are "inner"; R6–R10 are "outer".

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 7    | 7    | 0    | 9    | 9    | 8    | 3    | 0    | 2    | 7    | 7    | 0    | 8    |
| 2   | 7    | 7    | 0    | 9    | 9    | 9    | 2    | 0    | 2    | 7    | 7    | 0    | 8    |
| 3   | 7    | 7    | 0    | 8    | 9    | 8    | 3    | 0    | 3    | 7    | 6    | 0    | 7    |
| 4   | 6    | 7    | 0    | 9    | 8    | 9    | 2    | 0    | 2    | 7    | 7    | 0    | 8    |
| 5   | 7    | 7    | 0    | 9    | 9    | 8    | 3    | 0    | 3    | 7    | 7    | 0    | 8    |
| 6   | 5    | 5    | 0    | 3    | 2    | 3    | 5    | 0    | 5    | 6    | 6    | 0    | 4    |
| 7   | 5    | 6    | 0    | 2    | 3    | 2    | 5    | 0    | 5    | 6    | 6    | 0    | 5    |
| 8   | 6    | 5    | 0    | 3    | 2    | 3    | 6    | 0    | 5    | 5    | 6    | 0    | 4    |
| 9   | 5    | 5    | 0    | 2    | 3    | 2    | 5    | 1    | 5    | 6    | 5    | 0    | 4    |
| 10  | 6    | 6    | 0    | 3    | 2    | 3    | 5    | 0    | 5    | 6    | 6    | 0    | 5    |

## Open-text responses
- **cp13** (R6–R10): "interpersonal"
- **cp13** (R1–R5): blank
- **cp15** (R6–R10): "There are people I work alongside but don't really collaborate with" / "The lab feels cliquey"
- **cp15** (R1–R5): blank

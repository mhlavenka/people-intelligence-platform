# Case Study 04 — Two Shifts, Two Realities (subgroup-detectable)

## Scenario
A 24/7 operations team where the day-shift manager is excellent and
present, the night-shift lead is checked-out, and the two halves of the
team see completely different workplaces. **Tests Phase 2 subgroup
detection**: with N=12 (≥10 floor) and a clean bimodal split, k-means
should detect 2 clusters with silhouette ≥0.5 and per-cluster size 6+6.

## Organisation
- **Industry:** Logistics / 24-hour fulfilment centre
- **Team:** Pick-pack-ship operations
- **Department slug:** `ops-fulfilment`
- **N respondents:** 12 (6 day shift, 6 night shift; same role, same physical location)

## Conflict signature being tested
- Means around 5–6 on most scale items (mid-range overall)
- r_wg low on every dimension touching management or safety
- **Subgroup analysis SHOULD fire** — k=2, silhouette ≥0.55, clusters of 6 each
- Cluster A (day): high safety/comm/mgmt, low tension, high wellbeing
- Cluster B (night): low safety/comm/mgmt, high tension, low wellbeing
- Distinguishing items: cp01, cp02, cp10, cp11

## Expected metric outcomes
| Signal | Expected |
|---|---|
| Risk score | 55–65 (High) |
| Team Alignment | 15–30 (Fractured) |
| Subgroups | k=2, silhouette ~0.65 |
| Cluster A size / size | 6 / 6 |
| Most distinguishing items | cp10, cp11, cp01 |
| Split items | cp01, cp02, cp10, cp11, cp14 |
| AI narrative | "Two distinct response patterns — possible structural / shift / role divide; recommend exploring with HR; do NOT identify individuals" |

## Per-respondent answer matrix
R1–R6 = day shift; R7–R12 = night shift.

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 8    | 8    | 0    | 8    | 8    | 7    | 2    | 0    | 2    | 9    | 9    | 0    | 8    |
| 2   | 9    | 9    | 0    | 8    | 9    | 8    | 2    | 0    | 1    | 9    | 8    | 0    | 9    |
| 3   | 8    | 8    | 0    | 9    | 8    | 8    | 3    | 0    | 2    | 8    | 9    | 0    | 8    |
| 4   | 9    | 8    | 0    | 8    | 9    | 9    | 2    | 0    | 2    | 9    | 9    | 0    | 8    |
| 5   | 8    | 9    | 0    | 8    | 8    | 8    | 1    | 0    | 1    | 8    | 8    | 0    | 9    |
| 6   | 9    | 8    | 0    | 9    | 9    | 8    | 2    | 0    | 2    | 9    | 9    | 0    | 8    |
| 7   | 3    | 3    | 1    | 3    | 4    | 3    | 8    | 1    | 7    | 2    | 3    | 1    | 3    |
| 8   | 2    | 3    | 1    | 4    | 3    | 3    | 7    | 1    | 8    | 2    | 2    | 0    | 4    |
| 9   | 3    | 2    | 0    | 3    | 4    | 2    | 8    | 1    | 7    | 3    | 2    | 1    | 3    |
| 10  | 4    | 3    | 1    | 4    | 3    | 3    | 7    | 0    | 8    | 2    | 3    | 0    | 3    |
| 11  | 3    | 4    | 0    | 3    | 4    | 3    | 8    | 1    | 7    | 3    | 2    | 1    | 4    |
| 12  | 2    | 3    | 1    | 4    | 3    | 4    | 7    | 1    | 8    | 2    | 3    | 0    | 3    |

## Open-text responses
- **cp13** (day, R1–R6): blank or "occasional workload"
- **cp13** (night, R7–R12): "leadership", "communication", "lack of support"
- **cp15** (night): "We never see our manager" / "Day shift gets the resources, we get whatever's left"
- **cp15** (day): blank or "things are fine"

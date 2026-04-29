# Case Study 05 — The Lone Whistleblower

## Scenario
Nine people on the team think things are fine. One person is reporting
something profoundly different — low safety, witnessed unsafe behaviour,
unresolved conflict, wants HR involvement. The aggregate mean **looks
mostly fine** because 9-of-10 are positive, but `outlierCount > 0` on
several items and the per-item histogram clearly shows a single dot at
the bottom of the scale.

This is the Condorcet / Aumann case from the design doc — the minority
voice may be reporting reality more accurately than the majority. The UI
and AI prompt explicitly resist treating divergence as identification —
this case verifies the histograms and outlier counts surface the signal
WITHOUT pointing at the individual.

## Organisation
- **Industry:** Mid-stage fintech
- **Team:** Sales engineering
- **Department slug:** `sales-eng`
- **N respondents:** 10

## Conflict signature being tested
- Mean of most scale items in the 7–8 range (looks healthy)
- One respondent at the bottom of the scale on safety/wellbeing
- `outlierCount` ≥1 on cp01, cp02, cp10, cp11, cp14
- Histograms show 9-bar-cluster on the right + 1-bar at the left for safety items
- Booleans: cp03, cp08, cp12 each have **exactly one** "yes" (the same person)
- No subgroup detection (the lone outlier is below the minSubgroupN floor of 3)
- AI narrative should reference "minority voice", "do not seek to identify"

## Expected metric outcomes
| Signal | Expected |
|---|---|
| Risk score | 55–70 (High) — magnitude-of-signal calibration: the minority is reporting witnessed unsafe behaviour, an unresolved conflict, and escalation intent. Severity drives the score, not proportion. |
| Team Alignment | 55–70 (Mixed; rwg×0.6 + clusterFraction×0.4 — outlier drags the score into the Mixed band without erasing it) |
| Psych Safety mean | ~7.6, rwg ~0.54 |
| Conflict Frequency rwg | ~0.35 (lowest of any dimension — driven by cp07) |
| outlierCount on cp01 / cp02 / cp14 | 1 each |
| Booleans (cp03, cp08, cp12) sum | 1 each (the whistleblower) |
| Subgroups | None detected (cluster of 1 violates min-3 floor) — surfaced explicitly in the SUBGROUP STRUCTURE block as "detector ran but did NOT fire" |
| Histograms | Visible 1-bar at low end on multiple items |
| AI narrative | Use Condorcet/Aumann minority-voice framing explicitly; never use fracture / split / polarised / subgroup / bimodal-split language; recommend aggregate channels (anonymous follow-up, skip-level, ombudsperson) and explicit non-identification |
| conflictTypes vocabulary | "Minority voice signal", "Unsurfaced concern", "Outlier signal" — never "Bimodal Split", "Polarised Experience", "Subgroup-Level Divide", or "Fractured Team Experience" |

## Per-respondent answer matrix
R10 is the outlier; R1–R9 are the satisfied majority.

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 8    | 8    | 0    | 8    | 8    | 8    | 2    | 0    | 2    | 8    | 8    | 0    | 8    |
| 2   | 9    | 8    | 0    | 8    | 9    | 8    | 2    | 0    | 1    | 9    | 8    | 0    | 8    |
| 3   | 8    | 9    | 0    | 9    | 8    | 9    | 2    | 0    | 2    | 8    | 9    | 0    | 9    |
| 4   | 8    | 8    | 0    | 8    | 8    | 8    | 3    | 0    | 2    | 8    | 8    | 0    | 8    |
| 5   | 9    | 8    | 0    | 8    | 9    | 9    | 2    | 0    | 1    | 9    | 9    | 0    | 9    |
| 6   | 8    | 9    | 0    | 9    | 8    | 8    | 2    | 0    | 2    | 8    | 8    | 0    | 8    |
| 7   | 8    | 8    | 0    | 8    | 8    | 8    | 3    | 0    | 2    | 8    | 8    | 0    | 8    |
| 8   | 9    | 9    | 0    | 9    | 9    | 9    | 1    | 0    | 1    | 9    | 9    | 0    | 9    |
| 9   | 8    | 8    | 0    | 8    | 8    | 8    | 2    | 0    | 2    | 8    | 8    | 0    | 8    |
| 10  | 1    | 2    | 1    | 2    | 1    | 2    | 9    | 1    | 9    | 1    | 1    | 1    | 1    |

## Open-text responses
- **cp13** (R1–R9): blank
- **cp13** (R10): "interpersonal" or "leadership / harassment"
- **cp15** (R10): "I have raised this before. Nothing has changed."
- **cp15** (others): blank

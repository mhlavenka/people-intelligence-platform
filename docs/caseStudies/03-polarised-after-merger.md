# Case Study 03 — Polarised After Merger

## Scenario
Two teams were merged 3 months ago. The "legacy" half feel the merge has
been good for them; the "newcomer" half feel pushed out. Means look
mid-range across most dimensions, but variance is huge — r_wg is near zero
on most items. **Same headline number as Case 02, completely different
intervention required.** This is the canonical case the divergence feature
was designed to surface.

## Organisation
- **Industry:** Health-tech (post-acquisition)
- **Team:** Combined platform engineering
- **Department slug:** `platform`
- **N respondents:** 8 (4 from acquiring company, 4 from acquired company)

## Conflict signature being tested
- Means around 5 on most scale items but variance high — r_wg ≤0.3
- Bimodality coefficient > 0.555 on most items → **Split** flags
- Team Alignment **Fractured** (<40)
- Subgroup detection won't fire (N<10), but the AI narrative + split items
  should make the divide obvious
- Risk score elevated despite mid means

## Expected metric outcomes
| Signal | Expected |
|---|---|
| Risk score | 60–70 (High) |
| Team Alignment | 10–30 (Fractured) |
| Psych Safety mean | ~5.0, r_wg ≤0.2 |
| Communication & Trust mean | ~5.0, r_wg ≤0.2 |
| Conflict Frequency mean | ~5.5 (split), r_wg ≤0.2 |
| Management Effectiveness mean | ~5.0, r_wg ≤0.2 |
| Wellbeing & Belonging mean | ~5.0, r_wg ≤0.2 |
| Split items | 5–7 of the 8 scale items |
| Subgroups | Not detected (N=8 < 10 floor) |
| AI narrative | "Two parallel realities; healthy mean masks structural divide" |

## Per-respondent answer matrix
R1–R4 = legacy (acquiring); R5–R8 = newcomer (acquired). Bimodal pattern visible.

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 9    | 8    | 0    | 9    | 8    | 8    | 2    | 0    | 2    | 8    | 9    | 0    | 8    |
| 2   | 8    | 9    | 0    | 8    | 9    | 9    | 2    | 0    | 1    | 9    | 8    | 0    | 9    |
| 3   | 9    | 8    | 0    | 8    | 8    | 8    | 3    | 0    | 2    | 9    | 8    | 0    | 8    |
| 4   | 8    | 9    | 0    | 9    | 8    | 9    | 2    | 0    | 1    | 8    | 9    | 0    | 8    |
| 5   | 2    | 2    | 1    | 2    | 3    | 2    | 8    | 1    | 8    | 2    | 2    | 1    | 2    |
| 6   | 2    | 3    | 1    | 2    | 2    | 3    | 9    | 1    | 9    | 2    | 3    | 1    | 2    |
| 7   | 3    | 2    | 1    | 3    | 2    | 2    | 8    | 1    | 8    | 3    | 2    | 1    | 3    |
| 8   | 2    | 2    | 0    | 2    | 3    | 2    | 9    | 1    | 9    | 2    | 2    | 1    | 2    |

## Open-text responses
- **cp13** (R1–R4): blank / "none"
- **cp13** (R5–R8): "leadership", "values", "team integration"
- **cp15** (R5–R8): "I feel my voice doesn't count since the merger" / "We were promised parity but feel like second-class citizens"
- **cp15** (R1–R4): mostly blank or "going well"

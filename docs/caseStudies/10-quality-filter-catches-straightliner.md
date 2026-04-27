# Case Study 10 — Quality Filter Catches a Straightliner

## Scenario
A team of 11 where 10 respondents engaged honestly and one clicked through
with the same value across every numeric item — the canonical careless
responder pattern (long-string / zero variance within respondent). This
case verifies the **Layer 1 quality filter** correctly:

1. flags the careless response on submit (qualityScore < 0.35),
2. drops it from the analysis cohort,
3. surfaces the drop in `responseQuality.droppedReasons.straightlining`,
4. produces clean metrics on the remaining 10 — without the careless
   answer pulling the means around.

This is also the case where the **audit toggle** matters: with the
filter ON we should see N=10 / 10 included; with the filter OFF (audit
mode) we should see all 11 and the means subtly shifted.

## Organisation
- **Industry:** Retail head office
- **Team:** Merchandising operations
- **Department slug:** `merchandising`
- **N respondents:** 11 submitted, 10 expected to be analysed

## Conflict signature being tested
- 10 honest respondents: a moderately healthy team, mid-high means
- 1 straightliner: identical value (5) across all 13 numeric items;
  longest_run = 13/13 = 100% > 80% threshold → `longString` flag fires
- variance_within ≈ 0 → `straightlining` flag fires
- qualityScore < 0.35 → `acceptedInAnalysis = false`
- Filtered analysis: N=10, clean signals
- Audit-mode toggle: shows N=11, slightly different means
- `responseQuality.droppedReasons.straightlining` should be 1 (or longString)

## Expected metric outcomes (filtered, default view)
| Signal | Expected |
|---|---|
| Risk score | 30–40 (Medium-Low) |
| Team Alignment | 70–85 (Aligned) |
| Response Quality | 10/11 included; 1 dropped (straightlining/longString) |
| Psych Safety mean | ~7.5 |
| Communication & Trust mean | ~7.5 |
| Conflict Frequency mean | ~3.0 |
| Management Effectiveness mean | ~7.5 |
| Wellbeing & Belonging mean | ~7.5 |
| Audit toggle | Visible (because droppedCount > 0) |
| Subgroups | None |

## Per-respondent answer matrix
R11 is the straightliner. R1–R10 are the honest cohort.

| R   | cp01 | cp02 | cp03 | cp04 | cp05 | cp06 | cp07 | cp08 | cp09 | cp10 | cp11 | cp12 | cp14 |
|-----|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1   | 8    | 7    | 0    | 7    | 8    | 7    | 3    | 0    | 3    | 8    | 7    | 0    | 8    |
| 2   | 7    | 8    | 0    | 8    | 7    | 8    | 2    | 0    | 2    | 7    | 8    | 0    | 7    |
| 3   | 8    | 8    | 0    | 7    | 8    | 7    | 3    | 0    | 3    | 8    | 8    | 0    | 8    |
| 4   | 7    | 7    | 0    | 8    | 7    | 7    | 4    | 0    | 3    | 7    | 7    | 0    | 7    |
| 5   | 8    | 7    | 0    | 7    | 8    | 8    | 3    | 0    | 2    | 8    | 7    | 0    | 8    |
| 6   | 7    | 8    | 0    | 8    | 7    | 7    | 3    | 0    | 3    | 7    | 8    | 0    | 7    |
| 7   | 8    | 8    | 0    | 7    | 7    | 8    | 2    | 0    | 3    | 8    | 7    | 0    | 8    |
| 8   | 7    | 7    | 0    | 8    | 8    | 7    | 3    | 0    | 2    | 7    | 8    | 0    | 7    |
| 9   | 8    | 7    | 0    | 7    | 7    | 8    | 4    | 0    | 3    | 8    | 7    | 0    | 8    |
| 10  | 7    | 8    | 0    | 8    | 8    | 7    | 3    | 0    | 3    | 7    | 8    | 0    | 7    |
| 11  | 5    | 5    | 0    | 5    | 5    | 5    | 5    | 0    | 5    | 5    | 5    | 0    | 5    |

## Open-text responses
- **cp13** (R1–R10): mostly blank, a few "workload"
- **cp13** (R11): blank or single character
- **cp15:** mostly blank

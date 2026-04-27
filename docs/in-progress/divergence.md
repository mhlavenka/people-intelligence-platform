The other visualisations from earlier — recap, with what's now shipped vs still on the table

Just shipped (this commit):
- ✅ Per-item histogram — inline SVG bars per scale point in each item card. Goes amber when split.
- ✅ Disagreement heatmap — coloured grid above the dimensional table; one square per item, grouped by  
  dimension; green→red on r_wg.

Earlier on the menu, not yet built:

#2 — Dimensional radar / spider chart

A single radar with one axis per dimension, plotting the cohort's mean. Optional second polygon overlay
for an org-wide benchmark (last-N-analyses average). Where this earns its keep is with subgroups: each  
cluster gets its own polygon overlaid in a different colour, making the per-cluster contrast (which the
design doc §8.3 explicitly called for) instantly readable.

Effort: medium. Either pulling in a tiny radar library or hand-rolling SVG (~120 LOC). The math is just
trig over the dimension means we already have. Would land in the divergence panel and inside the        
existing Subgroup Patterns card.

#4 — Alignment-over-time sparkline

A 5–10 point line on the existing Team Alignment dashboard tile showing recent teamAlignmentScore
history for the org or a department. Tells you whether alignment is trending up/down without opening
individual analyses.

Effort: small (~40 LOC SVG sparkline) but needs a small endpoint that returns [ {date, score, name}, … ]
filtered by org/dept. Already easy because every analysis since Phase 1 carries teamAlignmentScore.

#6 — Subgroup Sankey / chord

Today the Subgroup Patterns card uses a stacked bar (cluster sizes) plus per-cluster mean rows. A Sankey
from "dimension → cluster" or a chord diagram visualising which dimensions distinguish each cluster
would make the structure of the divide tangible — but the data only meaningfully populates this when
subgroups are detected (N≥10, silhouette ≥0.5), which is rarer than the radar use case.

Effort: medium-large; honestly probably overkill for the typical N. Skip unless we see lots of large
cohorts.

Skipped on principle

- Per-respondent dot plots — even anonymised, with N=5–10 they leak individual answer order. The
  histograms we just shipped are the safe form of the same information.
- Time-series per item — too noisy at typical N. The dimensional sparkline (#4) is the right grain.

Recommendation for the next slice

#2 (dimensional radar) is the next clear win, especially because it does double duty — one chart for the
whole-team view, then re-used inside the Subgroup Patterns card to overlay per-cluster polygons. That
makes the existing subgroup card much stronger without restructuring it.

#4 (alignment trend sparkline) is small but needs the new endpoint. Worth doing alongside #2 if we touch
the dashboard tile; otherwise it can wait.

Want me to ship the radar next?
# Pending translations

Tracking new strings shipped with English values across all four locales
(en/fr/es/sk) so the i18n sync check stays green. These need proper
translations in the next translation batch.

Format: `KEY  — short note about context`

## Survey divergence (Phase 1, 2026-04-29)

Conflict-detail divergence tab and dashboard tile, plus the
question-editor dimension picker. Currently visible to admin/HR/coach
roles only.

- **CONFLICT.divergenceTab** — tab label on the conflict analysis detail page
- **CONFLICT.responseQualitySummary** — sentence; uses {{accepted}} / {{total}} / {{dropped}} interpolation
- **CONFLICT.responseQualityTooltip** — info-icon hover text on the quality card
- **CONFLICT.teamAlignment** — tile + card title
- **CONFLICT.teamAlignmentDesc** — dashboard tile subtitle
- **CONFLICT.alignmentBand_aligned** — pill text (≥70/100)
- **CONFLICT.alignmentBand_mixed** — pill text (40-69)
- **CONFLICT.alignmentBand_fractured** — pill text (<40)
- **CONFLICT.dimensionalDivergence** — section heading on detail page
- **CONFLICT.dimColDimension / dimColItems / dimColMean / dimColRwg / dimColDisagreement** — table headers
- **CONFLICT.itemDivergence** — section heading
- **CONFLICT.itemSplit** — small badge ("Split") on bimodal items
- **CONFLICT.itemSplitTooltip** — explanation of bimodality threshold
- **CONFLICT.divergenceDisclaimer** — persistent guidance copy at bottom of the divergence tab. Contains "different experiences, not different truths" framing — translation should preserve the spirit, not literal-translate
- **SURVEY.dimension / dimensionHint / tipDimension** — template editor dimension picker label, hint, and long-form info-icon tooltip

When translating the disclaimer copy in particular, prefer wording that a
respondent would not perceive as accusatory or judgmental. Helena should
review the FR translation before it ships to her tenant.

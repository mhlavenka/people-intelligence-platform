**Section 15.1 — Assessments & Measurement**

Three deliverables: (a) generic AssessmentRecord, (b) pre/post comparison on engagement detail, (c)     
formal 360 flow on the survey engine.

_Key decisions (with rationale)_

1. AssessmentRecord is independent of EqiScoreRecord.
   EQ-i already has a specialized PDF-parsing pipeline and observer/360 scoring fields. Don't merge them.
   AssessmentRecord is the generic catch-all for everything else (DISC, Hogan, Leadership Circle, MBTI,
   custom, plus the output of an in-house 360). EQ-i imports keep their dedicated flow; we just teach the
   IDP generator to read scores from either source.

2. PDF storage reuses existing S3+multer pattern (user.routes.ts avatar upload, eqi-import.routes.ts 10
   MB PDF magic-byte validation). New key prefix: org/{orgId}/assessments/{assessmentId}.pdf. Store
   pdfS3Key on the record; sign URLs on read.

3. 360 flow extends — does not replace — SurveyTemplate.rater_type / rater_pool which is already
   partially scaffolded but unused. Two new pieces:
- SurveyAssignment.raterCategory: 'self' | 'manager' | 'peer' | 'direct_report' — the assignment carries
  the category, the rater never picks it.
- SurveyResponse.raterCategory — copied from the assignment at submission so anonymized responses still
  carry their lens.
- Per-category minimum-group-size: self=1, manager=1, peer≥3, direct_report≥3 (override the global
  MIN_GROUP_SIZE=5).

4. 360 → IDP bridge — when a 360 completes, write an AssessmentRecord with assessmentType='360' and
   category-averaged scores. succession.routes.ts /idp/generate already accepts a flat eqiScores dict, so
   we just need a small adapter that flattens the multi-rater report into that shape.

_Data model_

New AssessmentRecord:
organizationId, engagementId, coacheeId, coachId,
assessmentType: 'eq-i' | 'disc' | 'hogan' | 'leadership_circle' | 'mbti' | '360' | 'cliftonstrengths' |
'tki' | 'custom',
administeredAt: Date,
phase: 'baseline' | 'midpoint' | 'final' | 'ad_hoc',
scores: Map<string, number>,     // dimension → numeric score
scoresMeta: { unit?, scaleMin?, scaleMax?, normGroup? },
pdfS3Key?, pdfFilename?, pdfSizeBytes?,
coachInterpretation?: string,
sourceTemplateId?: ObjectId       // when generated from a 360 SurveyTemplate

SurveyAssignment (extend if it exists, else new): add raterCategory, raterEmail, assignmentToken
(per-rater unique token gating submission).

SurveyResponse: add optional raterCategory.

_Backend changes_

- New routes /api/assessments/*: CRUD, PDF upload (multer+S3), download (signed URL).
- New service assessment360.service.ts: aggregates SurveyResponse rows by raterCategory, applies
  per-category minimums, materializes an AssessmentRecord on completion.
- Extend survey.routes.ts /respond: copy raterCategory from assignment; reject if no category resolves
  and template is multi_rater.
- Extend succession.routes.ts /idp/generate: accept assessmentRecordId as alternative input to
  eqiScores.

_Frontend changes_

- engagement-detail.component.ts: new "Assessments" panel in main column (below sessions timeline).
  Lists records grouped by phase. "Compare" CTA opens a side-by-side dialog when ≥2 records of the same
  assessmentType exist.
- New assessment-dialog/: create/edit record, PDF upload, score editor (dynamic key/value rows for any
  dimension set).
- New assessment-comparison-dialog/: bar chart per dimension showing baseline vs final + delta column.
- New 360-setup-wizard/ (extends survey-template-dialog): step 1 base template, step 2 rater roster
  (rows of email + category), step 3 dispatch.
- 360-report view: multi-rater radar chart with one ring per category.

_Phasing (estimated 4–6 sessions of work)_

1. AssessmentRecord model + CRUD routes + S3 attach + simple list panel on engagement-detail.
2. Pre/post comparison dialog.
3. 360 assignment extensions + per-category aggregation service.
4. 360 → AssessmentRecord materialization + IDP bridge.

  ---
**Section 15.2 — ICF Credentialing**

Two deliverables: CoachingHoursLog (auto from sessions + manual + mentor + CCE + csv import) and a
running-totals dashboard with ICF-export format.

_Key decisions_

1. Don't materialize hour rows for completed sessions.
   The CoachingSession table is already the source of truth for in-platform sessions. Materializing
   duplicates and creates sync bugs (session edit/cancel must update the log row). Instead:
   CoachingHoursLog holds only manual entries, mentor hours, CCE credits, and external-client rows. The
   aggregation service unions session-derived rows + log rows at read time.

2. Add ICF-required attributes to CoachingSession so auto-derived rows have everything ICF wants:
- clientType: 'individual' | 'team' | 'group' (defaults to 'individual').
- paidStatus: 'paid' | 'pro_bono' (defaults from engagement.billingMode === 'sponsor' || hourlyRate > 0,
  else pro_bono).

3. CSV-only import for now. Excel users can "Save As CSV". Avoids the xlsx dependency. Use csv-parse
   (already lightweight) with a dry-run preview API that returns row-by-row validation before commit.

4. ICF level thresholds are config, not hardcoded. ACC=100, PCC=500, MCC=2,500 — store in
   backend/src/config/icf-credential-levels.ts so future ICF changes don't require code edits.

Data model

New CoachingHoursLog:
organizationId, coachId,
date, hours,
category: 'session' | 'mentor_coaching_received' | 'cce',
clientType?: 'individual' | 'team' | 'group',   // for category='session'
paidStatus?: 'paid' | 'pro_bono',                // for category='session'
clientName?, clientOrganization?,                 // external clients
mentorCoachName?,                                 // category='mentor_coaching_received'
cceCategory?: 'core_competency' | 'resource_development',  // category='cce'
notes?, importedFromFile?

Extend CoachingSession: clientType, paidStatus.

_Backend changes_

- New service coachingHours.service.ts:
    - getHoursSummary(coachId, dateRange?) → unions completed sessions + log rows; returns totals broken
      down by paid/pro-bono, individual/team/group, mentor, CCE, plus progress toward each ICF level.
    - exportIcfLog(coachId, dateRange?) → flat CSV in ICF Coaching Hours Log column order (client name,
      dates, paid/pro bono, individual/team, hours).
    - importCsv(coachId, fileBuffer, dryRun=true) → parse, validate, return preview or commit.
- New routes /api/coaching/hours/*: CRUD on CoachingHoursLog, summary, export, import (multer csv).
- Migration: backfill clientType='individual', paidStatus from billingMode on existing CoachingSession
  rows.

_Frontend changes_

- New module frontend/src/app/modules/coaching/icf-hours/:
    - icf-dashboard.component: progress rings (ACC/PCC/MCC), category breakdown chart, recent activity
      table, date-range filter, export CSV button.
    - hours-log-dialog: manual entry form (category-driven dynamic fields).
    - hours-import-dialog: upload CSV → preview table with row errors → confirm import.
- Sidebar nav: add "ICF Hours" item under Coaching, role-gated to coaches + admins.
- engagement-detail.component: small badge on each completed session showing it counts toward ICF
  (paid/pro bono icon).

_Phasing_

1. CoachingSession schema additions + backfill migration.
2. CoachingHoursLog model + manual-entry routes + dashboard summary endpoint.
3. Frontend dashboard + manual-entry dialog.
4. CSV import (with dry-run preview) and CSV export.

  ---
**Cross-cutting concerns**

- i18n: new UI strings into en.json, fr.json, es.json (and sk.json if present). Re-run node
  scripts/i18n/check-translations.js before deploy.
- Tenant filter: both new models include organizationId. Don't bypass.
- Roles: AssessmentRecord readable by coach + coachee on the engagement, plus admin/hr_manager. Sponsor
  never. ICF hours readable by the coach themselves and admin only.
- Tests: integration tests under backend/tests/ for (a) per-category 360 minimums, (b) pre/post delta
  math, (c) hours aggregation that unions sessions + log rows, (d) CSV import dry-run vs commit.
- Estimated total scope: ~10–12 working sessions for both areas combined.
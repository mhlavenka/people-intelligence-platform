# Translations — ICF Credentialing (15.2) — APPLIED

**Status:** Translations applied via `scripts/i18n/apply-icf-translations.js`.
The keys below now have French / Spanish / Slovak translations in their
respective JSON files. This document is retained as a glossary reference;
review and refine specific translations as needed during user testing.

The original tables show the English source values that were translated.

## Keys added to `COACHING.*`

| Key | English |
|-----|---------|
| `COACHING.icfAllTime` | All time |
| `COACHING.icfCatCce` | CCE |
| `COACHING.icfCatMentor` | Mentor Coaching |
| `COACHING.icfCatSession` | Session |
| `COACHING.icfCategory` | Category |
| `COACHING.icfCceCategory` | CCE Category |
| `COACHING.icfCceCertUrl` | Certificate URL |
| `COACHING.icfCceCore` | Core Competency |
| `COACHING.icfCceCredits` | CCE Credits |
| `COACHING.icfCceProvider` | CCE Provider |
| `COACHING.icfCceResource` | Resource Development |
| `COACHING.icfClientEmail` | Client Email |
| `COACHING.icfClientEmailHint` | ICF may contact clients to verify hours during credential review |
| `COACHING.icfClientGroup` | Group |
| `COACHING.icfClientIndividual` | Individual |
| `COACHING.icfClientName` | Client Name |
| `COACHING.icfClientOrType` | Client / Type |
| `COACHING.icfClientOrganization` | Client Organization |
| `COACHING.icfClientTeam` | Team |
| `COACHING.icfCoachingHours` | coaching hours |
| `COACHING.icfCustomRange` | Custom range |
| `COACHING.icfDateRange` | Date Range |
| `COACHING.icfDeleteConfirmMsg` | Permanently remove this hours entry? This cannot be undone. |
| `COACHING.icfDeleteConfirmTitle` | Delete hours entry? |
| `COACHING.icfEligible` | Eligible to apply |
| `COACHING.icfEntries` | entries |
| `COACHING.icfEntryDeleted` | Entry deleted |
| `COACHING.icfExport` | Export CSV |
| `COACHING.icfFromDate` | From |
| `COACHING.icfImport` | Import CSV |
| `COACHING.icfImportBack` | Back |
| `COACHING.icfImportChangeFile` | Change file |
| `COACHING.icfImportChooseFile` | Choose CSV file |
| `COACHING.icfImportCommit` | Import {{count}} valid rows |
| `COACHING.icfImportCommitted` | Successfully imported {{count}} rows |
| `COACHING.icfImportDropHint` | Drop a CSV file here or click to browse |
| `COACHING.icfImportHint` | Upload a CSV file with the columns described below. We'll preview and validate every row before anything is saved. |
| `COACHING.icfImportInvalid` | Invalid |
| `COACHING.icfImportOptional` | Optional columns |
| `COACHING.icfImportPreview` | Preview |
| `COACHING.icfImportRequired` | are required |
| `COACHING.icfImportRowOk` | OK |
| `COACHING.icfImportStatus` | Status |
| `COACHING.icfImportTitle` | Import ICF Hours |
| `COACHING.icfImportTotal` | Total |
| `COACHING.icfImportValid` | Valid |
| `COACHING.icfFromManual` | manual |
| `COACHING.icfFromSessionTooltip` | Auto-populated from a completed coaching session |
| `COACHING.icfFromSessions` | from sessions |
| `COACHING.icfHoursTitle` | ICF Credentialing Hours |
| `COACHING.icfHoursSubtitle` | Track your coaching hours toward ICF credentials (ACC, PCC, MCC). |
| `COACHING.icfHoursValue` | Hours |
| `COACHING.icfLast12Months` | Last 12 months |
| `COACHING.icfLast30Days` | Last 30 days |
| `COACHING.icfLogHours` | Log Hours |
| `COACHING.icfMentorCoachingReceived` | Mentor Coaching Received |
| `COACHING.icfMentorCredential` | Mentor ICF Credential |
| `COACHING.icfMentorHours` | mentor hours |
| `COACHING.icfMentorName` | Mentor Coach Name |
| `COACHING.icfMentorOrganization` | Mentor Coach Organization |
| `COACHING.icfNoEntries` | No coaching hours logged in this period yet. |
| `COACHING.icfNotYetEligible` | Building hours |
| `COACHING.icfNotes` | Notes |
| `COACHING.icfPaid` | Paid |
| `COACHING.icfPaidStatus` | Paid Status |
| `COACHING.icfProBono` | Pro Bono |
| `COACHING.icfProgress` | ICF Credential Progress |
| `COACHING.icfAssessmentType` | Assessment Type |
| `COACHING.icfAssessmentTypeHint` | Instrument debriefed (e.g. EQi-2.0, Hogan, DISC) — leave blank for plain coaching |
| `COACHING.icfRecentActivity` | Recent Activity |
| `COACHING.icfSponsorContactHint` | HR / sponsor liaison at the client organization |
| `COACHING.icfSponsorContactName` | Sponsor Contact |
| `COACHING.icfToDate` | To |
| `COACHING.icfTotalCoachingHours` | Total Coaching Hours |
| `COACHING.icfTotalsBreakdown` | Hours Breakdown |
| `COACHING.editHoursDialogTitle` | Edit Hours Entry |
| `COACHING.logHoursDialogTitle` | Log Coaching Hours |

## Keys added to `NAV.*`

| Key | English |
|-----|---------|
| `NAV.icfHours` | ICF Hours |

## Keys added to `SYSADMIN.*` (email delivery settings)

| Key | English |
|-----|---------|
| `SYSADMIN.emailDeliveryTitle` | Email Delivery |
| `SYSADMIN.emailDeliveryDesc` | Sender identity used for all outbound platform emails (notifications, invitations, password resets) |
| `SYSADMIN.senderName` | Sender Name |
| `SYSADMIN.senderNameHint` | Display name shown in clients' inbox, e.g. "ARTES Hub" |
| `SYSADMIN.senderEmail` | Sender Email |
| `SYSADMIN.senderEmailHint` | Must be a verified address in your AWS SES region |

## Glossary notes for translators

- **ICF** — keep as the acronym; it is the proper name of the International Coach Federation.
- **ACC / PCC / MCC** — keep as English acronyms; they are the credential names.
- **CCE** — Continuing Coach Education credits; keep the acronym, may want to add a parenthetical gloss in the destination language (e.g., FR: "CCE (formation continue)").
- **Pro Bono** — preserve the Latin term; it is used internationally in coaching contexts.
- **Mentor Coaching** — has a specific ICF meaning (a credential-eligible activity), prefer the literal translation that ICF uses on its localized pages.

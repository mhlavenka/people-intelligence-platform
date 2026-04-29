# Claude Code Prompt: ARTES — DocuSeal Document Signing Module (Extensible Multi-Agreement)

## Context

You are building an extensible document e-signing integration for the **ARTES People Intelligence Platform**, a multi-tenant B2B SaaS for executive coaching and organizational development. The stack is:

- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB Atlas with Mongoose
- **Frontend:** Angular 17+
- **Cloud:** AWS (Bitnami Linux instance)
- **E-signature provider:** DocuSeal cloud (REST API)

The architecture supports **multiple agreement types** and allows **new types to be added at runtime via an admin UI** — without code deployment. Each agreement type maps to a DocuSeal template and declares which fields to pre-fill and where the values come from.

---

## Architecture Overview

```
AgreementTemplate (MongoDB)     ← admin-managed config per tenant
        │
        ▼
AgreementDocument (MongoDB)     ← one record per sent document
        │
        ▼
DocuSeal API                    ← submission lifecycle
        │
        ▼
Webhook → AgreementDocument     ← status updates
```

---

## Environment Variables

Add to `.env` and `.env.example`:

```
DOCUSEAL_API_TOKEN=
DOCUSEAL_API_BASE_URL=https://api.docuseal.com
DOCUSEAL_WEBHOOK_SECRET=
```

DocuSeal template IDs are stored per tenant in MongoDB — NOT in env vars.

---

## 1. Mongoose Schema — `AgreementTemplate`

File: `src/models/agreementTemplate.model.ts`

Fields:
- `tenantId` — ObjectId ref to Tenant (required)
- `slug` — string, URL-safe e.g. `'coaching_agreement'`, `'nda'`, `'assessment_consent'` (required)
- `label` — string, human-readable e.g. `'Coaching Agreement'` (required)
- `docusealTemplateId` — number, the DocuSeal template ID (required)
- `signerRole` — string matching DocuSeal template role exactly (required, e.g. `'Client'`)
- `prefillFields` — array of `{ fieldName: string; source: FieldSource }` (see below)
- `requiresCounterSignature` — boolean, default false
- `expiryDays` — number, optional
- `isActive` — boolean, default true
- `createdAt`, `updatedAt` — timestamps

Compound unique index on `[tenantId, slug]`.

**`FieldSource` TypeScript type:**
```typescript
type FieldSource =
  | { kind: 'client';  property: string }   // dot-notation into client object
  | { kind: 'coach';   property: string }   // dot-notation into coach object
  | { kind: 'tenant';  property: string }   // dot-notation into tenant object
  | { kind: 'static';  value: string }      // hardcoded value
  | { kind: 'date';    format: string }     // dayjs format resolved at send-time
  | { kind: 'input';   label: string; required: boolean } // value supplied by sender at send-time
```

The `input` kind is new: it allows the person sending the agreement to supply field values
that are not known in advance (e.g. fee amount, program duration). These are passed in
the `runtimeInputs` map when calling `sendAgreement()`.

---

## 2. Mongoose Schema — `AgreementDocument`

File: `src/models/agreementDocument.model.ts`

Fields:
- `tenantId` — ObjectId ref to Tenant (required)
- `templateId` — ObjectId ref to AgreementTemplate (required)
- `templateSlug` — string (denormalized, required)
- `clientId` — ObjectId ref to User (required)
- `coachId` — ObjectId ref to User (optional)
- `status` — enum: `'pending'` | `'sent'` | `'viewed'` | `'completed'` | `'declined'` | `'expired'` | `'error'`
- `docusealSubmissionId` — string (sparse unique)
- `docusealTemplateId` — number (snapshot)
- `signerEmail` — string
- `signerName` — string
- `signingUrl` — string
- `prefillSnapshot` — Mixed (immutable record of all resolved + runtime field values sent)
- `completedAt` — Date
- `completionCertificateUrl` — string
- `expiresAt` — Date
- `errorMessage` — string
- `metadata` — Mixed
- `createdAt`, `updatedAt` — timestamps

Indexes:
- Compound: `[tenantId, clientId, templateSlug, status]`
- Sparse unique: `docusealSubmissionId`

---

## 3. Field Resolver

File: `src/services/agreementFieldResolver.ts`

Pure function:
```typescript
export function resolveFields(
  prefillFields: AgreementTemplate['prefillFields'],
  context: FieldResolverContext,
  runtimeInputs?: Record<string, string>
): Record<string, string>
```

```typescript
interface FieldResolverContext {
  client: { firstName: string; lastName: string; email: string; [key: string]: unknown };
  coach?: { firstName: string; lastName: string; email: string; [key: string]: unknown };
  tenant: { name: string; [key: string]: unknown };
}
```

Resolution per `FieldSource.kind`:
- `client` → `_.get(context.client, property)` (lodash dot-notation)
- `coach` → `_.get(context.coach, property)` — throw `AgreementConfigError` if coach undefined
- `tenant` → `_.get(context.tenant, property)`
- `static` → `value` as-is
- `date` → `dayjs().format(format)`
- `input` → `runtimeInputs?.[fieldName]` — throw `AgreementConfigError` if `required: true` and missing

Returns flat `Record<string, string>`.

---

## 4. DocuSeal Service

File: `src/services/docuseal.service.ts`

Class `DocuSealService`. Axios instance with base URL and Bearer token from env.

### `createSubmission(params)`
```typescript
{
  docusealTemplateId: number;
  signerRole: string;
  signerName: string;
  signerEmail: string;
  prefillFields: Record<string, string>;
  externalId?: string;
  sendEmail?: boolean;   // default true
  expiresAt?: Date;
}
```

`POST /submissions`. Returns `{ submissionId: string; signingUrl: string }`.

Signing URL: `https://docuseal.com/s/{submitters[0].slug}`

### `getSubmission(submissionId: string)`
`GET /submissions/{id}`

### `sendReminder(submissionId: string)`
`POST /submissions/{id}/remind`

### `expireSubmission(submissionId: string)`
`DELETE /submissions/{id}`

### `verifyWebhookSignature(rawBody: Buffer, signature: string): boolean`
HMAC-SHA256 with `DOCUSEAL_WEBHOOK_SECRET`. Use `crypto.timingSafeEqual`.

---

## 5. Agreement Service

File: `src/services/agreement.service.ts`

### `sendAgreement(params)`

```typescript
{
  tenantId: string;
  templateSlug: string;
  clientId: string;
  coachId?: string;
  context: FieldResolverContext;
  runtimeInputs?: Record<string, string>;  // values for 'input' kind fields
  allowDuplicate?: boolean;                 // default false
  metadata?: Record<string, unknown>;
}
```

Logic:
1. Load `AgreementTemplate` by `{ tenantId, slug: templateSlug, isActive: true }`. Throw `AgreementTemplateNotFoundError` if missing.
2. Unless `allowDuplicate`, check for active agreement (`pending|sent|viewed`) for same `tenantId + clientId + templateSlug`. Throw `AgreementConflictError` with existing doc ID.
3. Create `AgreementDocument` status `'pending'`.
4. Call `resolveFields(template.prefillFields, context, runtimeInputs)` → snapshot.
5. Call `DocuSealService.createSubmission(...)`. On throw, set status `'error'`, save `errorMessage`, rethrow `DocuSealApiError`.
6. Update doc: status `'sent'`, `docusealSubmissionId`, `signingUrl`, `prefillSnapshot`, `expiresAt` (if `expiryDays` set on template).
7. Return saved document.

### `handleWebhookEvent(event: unknown)`

| DocuSeal event | Status update | Side effects |
|---|---|---|
| `submission.viewed` | `viewed` | — |
| `submission.completed` | `completed` | `completedAt = now`, store `completionCertificateUrl` |
| `submission.declined` | `declined` | — |
| `submission.expired` | `expired` | — |

Look up by `docusealSubmissionId`. Log warning if not found; do not throw.

### `getAgreementsForClient(tenantId, clientId, filters?)`
```typescript
filters?: { templateSlug?: string; status?: AgreementStatus | AgreementStatus[] }
```
Sorted by `createdAt` desc. Always filters by `tenantId`.

### `getAgreementById(id, tenantId)`

### `sendReminder(agreementId, tenantId)`
Status must be `sent` or `viewed` — throw `AgreementStateError` otherwise.

### `cancelAgreement(agreementId, tenantId)`
Calls `DocuSealService.expireSubmission(...)`, sets status `expired`.

---

## 6. Agreement Template Admin Service

File: `src/services/agreementTemplate.service.ts`

CRUD used by tenant admin users:
- `createTemplate(tenantId, dto)` — validate slug is URL-safe, unique per tenant
- `updateTemplate(id, tenantId, dto)` — partial update
- `deactivateTemplate(id, tenantId)` — soft delete via `isActive: false`
- `listTemplates(tenantId, includeInactive?)`
- `getTemplate(id, tenantId)`

---

## 7. Express Routes

File: `src/routes/agreements.routes.ts`

### Agreements (JWT auth, scoped to `req.tenantId`):
```
POST   /api/agreements/send
GET    /api/agreements/client/:clientId
GET    /api/agreements/:id
POST   /api/agreements/:id/remind
POST   /api/agreements/:id/cancel
```

### Template admin (JWT auth + admin role):
```
GET    /api/agreement-templates
POST   /api/agreement-templates
PATCH  /api/agreement-templates/:id
DELETE /api/agreement-templates/:id
```

### Webhook (no auth, raw body — register BEFORE express.json()):
```
POST   /api/webhooks/docuseal
```

```typescript
app.use('/api/webhooks/docuseal',
  express.raw({ type: 'application/json' }),
  webhookRouter
);
```

Webhook handler: verify signature → parse → `handleWebhookEvent` → `200 { received: true }`.

---

## 8. Angular Feature Module

Directory: `src/app/features/agreements/`

### `agreements.service.ts`
- `sendAgreement(templateSlug, clientId, coachId?, runtimeInputs?)` → `POST /api/agreements/send`
- `getClientAgreements(clientId, filters?)`
- `getAgreement(id)`
- `sendReminder(id)`
- `cancelAgreement(id)`

Export interfaces `Agreement`, `AgreementTemplate`, `AgreementStatus`.

### `agreement-status-badge.component.ts`
Standalone, dumb. Input: `@Input() status: AgreementStatus`. Color-coded pill: pending=gray, sent=blue, viewed=amber, completed=green, declined=red, expired=orange, error=red+icon.

### `client-agreements.component.ts`
Standalone, smart. Input: `@Input() clientId: string`. Lists agreements grouped by template type. Columns: template label, status badge, sent date, completed date + certificate link, actions (Remind / Cancel). Uses Angular signals.

### `send-agreement-modal.component.ts`
Standalone. Inputs: `@Input() clientId`, `@Input() coachId`, `@Input() availableTemplates: AgreementTemplate[]`.

**Key behavior:** When a template is selected, dynamically render input fields for any `prefillFields` with `source.kind === 'input'`. Each such field shows `source.label` as the field label. This allows the coach to fill in fee amounts, session lengths, etc. before sending.

Emits `@Output() sent = new EventEmitter<Agreement>()` on success.

---

## 9. Error Classes

File: `src/errors/agreement.errors.ts`

```typescript
export class AgreementTemplateNotFoundError extends Error  // 404
export class AgreementConflictError extends Error          // 409
export class AgreementNotFoundError extends Error          // 404
export class AgreementStateError extends Error             // 422
export class AgreementConfigError extends Error            // 500
export class DocuSealApiError extends Error                // 502
```

Map all in `errorHandler.middleware.ts`.

---

## 10. Unit Tests

File: `src/services/__tests__/agreement.service.test.ts`

- `sendAgreement` — happy path `coaching_agreement`
- `sendAgreement` — happy path second type e.g. `nda` (confirms generic)
- `sendAgreement` — `AgreementTemplateNotFoundError` for unknown slug
- `sendAgreement` — `AgreementConflictError` on duplicate active
- `sendAgreement` — sets status `error` if DocuSeal throws
- `sendAgreement` — `allowDuplicate: true` skips conflict check
- `handleWebhookEvent` — all four event types
- `handleWebhookEvent` — unknown submissionId logs warning, no throw
- `sendReminder` — throws `AgreementStateError` on completed

File: `src/services/__tests__/agreementFieldResolver.test.ts`

- All `FieldSource` kinds including dot-notation
- `input` kind — required field missing → `AgreementConfigError`
- `input` kind — optional field missing → empty string, no throw
- `coach` kind — coach not in context → `AgreementConfigError`

---

## 11. DocuSeal Template Setup Guide

File: `docs/docuseal-setup.md`

### Coaching Agreement Template — Field Reference

The file `Helena_Coaching_Agreement_DocuSeal.docx` is the source document.
Upload it to DocuSeal as a PDF, then configure the following fillable fields.
All fields use the signer role **"Client"** unless marked *(static/pre-filled)*.

| DocuSeal Field Name | Type | Source kind | Notes |
|---|---|---|---|
| `AgreementDate` | Date | `date` | Format: `MMMM D, YYYY` |
| `ClientFullName` | Text | `client` | `firstName + ' ' + lastName` (use static concatenation in resolver) |
| `ClientAddress` | Text | `client` | `address` (dot-notation) |
| `ClientEmail` | Text | `client` | `email` |
| `ProgramDurationMonths` | Text | `input` | Label: "Program duration (months)" · Required |
| `MeetingMethod` | Text | `input` | Label: "Meeting method (e.g. Video, Phone, In-person)" · Required |
| `AvailabilityTerms` | Text | `input` | Label: "Between-session availability terms" · Optional |
| `AdditionalRateAmount` | Text | `input` | Label: "Additional services hourly rate (CAD)" · Optional |
| `FeeAmount` | Text | `input` | Label: "Coaching fee amount (CAD)" · Required |
| `PaymentFrequency` | Text | `input` | Label: "Payment frequency (e.g. per month, per session)" · Required |
| `MeetingLength` | Text | `input` | Label: "Session length (e.g. 60 minutes)" · Required |
| `RefundPolicy` | Text | `input` | Label: "Refund policy" · Required |
| `CoachPhone` | Text | `static` | Helena's coaching phone number |
| `CancellationHours` | Text | `input` | Label: "Cancellation notice required (hours)" · Required |
| `RecordRetentionYears` | Text | `input` | Label: "Record retention period (years)" · Optional |
| `TerminationWeeks` | Text | `input` | Label: "Termination notice period (weeks)" · Required |
| `ICFReleaseAgree` | Checkbox | `input` | Label: "Client agrees to ICF credential verification" |
| `ICFReleaseDecline` | Checkbox | `input` | Label: "Client declines ICF credential verification" |
| `ProgramGoals` | Textarea | `input` | Label: "Coaching goals and outcomes (Schedule A)" · Required |
| `ClientSignature` | Signature | — | Signer field (DocuSeal manages) |
| `ClientSignDate` | Date | — | Auto-filled by DocuSeal on signing |
| `CoachSignature` | Signature | — | Counter-signature (if enabled) |
| `CoachSignDate` | Date | — | Auto-filled by DocuSeal on counter-sign |

### MongoDB Seed Document

```json
{
  "tenantId": "<ObjectId>",
  "slug": "coaching_agreement",
  "label": "Coaching Agreement",
  "docusealTemplateId": 123456,
  "signerRole": "Client",
  "expiryDays": 30,
  "isActive": true,
  "prefillFields": [
    { "fieldName": "AgreementDate",        "source": { "kind": "date",   "format": "MMMM D, YYYY" } },
    { "fieldName": "ClientFullName",       "source": { "kind": "client", "property": "fullName" } },
    { "fieldName": "ClientAddress",        "source": { "kind": "client", "property": "address" } },
    { "fieldName": "ClientEmail",          "source": { "kind": "client", "property": "email" } },
    { "fieldName": "CoachPhone",           "source": { "kind": "static", "value": "+1-514-000-0000" } },
    { "fieldName": "ProgramDurationMonths","source": { "kind": "input",  "label": "Program duration (months)", "required": true } },
    { "fieldName": "MeetingMethod",        "source": { "kind": "input",  "label": "Meeting method", "required": true } },
    { "fieldName": "AvailabilityTerms",    "source": { "kind": "input",  "label": "Between-session availability terms", "required": false } },
    { "fieldName": "AdditionalRateAmount", "source": { "kind": "input",  "label": "Additional services rate (CAD/hr)", "required": false } },
    { "fieldName": "FeeAmount",            "source": { "kind": "input",  "label": "Coaching fee (CAD)", "required": true } },
    { "fieldName": "PaymentFrequency",     "source": { "kind": "input",  "label": "Payment frequency", "required": true } },
    { "fieldName": "MeetingLength",        "source": { "kind": "input",  "label": "Session length", "required": true } },
    { "fieldName": "RefundPolicy",         "source": { "kind": "input",  "label": "Refund policy", "required": true } },
    { "fieldName": "CancellationHours",    "source": { "kind": "input",  "label": "Cancellation notice (hours)", "required": true } },
    { "fieldName": "RecordRetentionYears", "source": { "kind": "input",  "label": "Record retention (years)", "required": false } },
    { "fieldName": "TerminationWeeks",     "source": { "kind": "input",  "label": "Termination notice (weeks)", "required": true } },
    { "fieldName": "ICFReleaseAgree",      "source": { "kind": "input",  "label": "ICF release — Client agrees", "required": false } },
    { "fieldName": "ICFReleaseDecline",    "source": { "kind": "input",  "label": "ICF release — Client declines", "required": false } },
    { "fieldName": "ProgramGoals",         "source": { "kind": "input",  "label": "Coaching goals (Schedule A)", "required": true } }
  ]
}
```

### DocuSeal Dashboard Setup Steps

1. Log into app.docuseal.com
2. Create New Template → upload `Helena_Coaching_Agreement_DocuSeal.docx` converted to PDF
3. Set signer role name to exactly: **Client**
4. For each `[[FieldName]]` placeholder in the document, add the corresponding fillable field
   - Signature fields: use DocuSeal **Signature** field type
   - Date fields: use **Date** field type
   - Checkbox fields: use **Checkbox** field type
   - Everything else: use **Text** or **Textarea**
5. Copy the template ID from the DocuSeal URL (`/templates/123456/edit`)
6. Update the MongoDB seed document above with the correct `docusealTemplateId`
7. Register webhook in DocuSeal Settings → Webhooks:
   - URL: `https://yourdomain.com/api/webhooks/docuseal`
   - Events: `submission.viewed`, `submission.completed`, `submission.declined`, `submission.expired`
8. Set `DOCUSEAL_API_TOKEN` and `DOCUSEAL_WEBHOOK_SECRET` in `.env`

---

## Constraints & Notes

- Use `axios`. No `node-fetch` or `got`.
- Use existing `logger` (Winston). No `console.log`.
- No `any`. Use `unknown` + type guards for webhook payloads.
- Every DB query must filter by `tenantId`.
- `prefillSnapshot` on `AgreementDocument` is immutable after creation.
- Do not implement PDF generation — PDFs are uploaded to DocuSeal manually.
- `lodash` available for `_.get`. `dayjs` available for date formatting.
- The `input` kind fields are the mechanism for per-agreement customization (fees, duration, goals).
  The `send-agreement-modal` must render a dynamic form for these fields before sending.

---

## Deliverables Checklist

- [ ] `src/models/agreementTemplate.model.ts`
- [ ] `src/models/agreementDocument.model.ts`
- [ ] `src/services/agreementFieldResolver.ts`
- [ ] `src/services/docuseal.service.ts`
- [ ] `src/services/agreement.service.ts`
- [ ] `src/services/agreementTemplate.service.ts`
- [ ] `src/routes/agreements.routes.ts`
- [ ] `src/errors/agreement.errors.ts`
- [ ] Update `src/app.ts` — register routes, raw-body webhook middleware
- [ ] Update `src/middleware/errorHandler.middleware.ts`
- [ ] `src/app/features/agreements/agreements.module.ts`
- [ ] `src/app/features/agreements/agreements.service.ts`
- [ ] `src/app/features/agreements/agreement-status-badge.component.ts`
- [ ] `src/app/features/agreements/client-agreements.component.ts`
- [ ] `src/app/features/agreements/send-agreement-modal.component.ts`
- [ ] `src/services/__tests__/agreement.service.test.ts`
- [ ] `src/services/__tests__/agreementFieldResolver.test.ts`
- [ ] `docs/docuseal-setup.md`
- [ ] `.env.example` updated

# ARTES × DocuSeal — Complete Setup & Implementation Guide

---

## ⚠️ Pricing Reality Check (Read First)

Before starting: DocuSeal's API access **requires a paid Pro plan**.

| What you need | Cost |
|---|---|
| Pro seat (required to get API key) | **$20 USD/month** |
| Per document signed via API | **$0.20 USD/document** |
| Free plan | UI only — no API, no webhooks |

At 10 documents/month: **~$22/month total**. Still far cheaper than DocuSign ($45+) and worth it for the clean ARTES integration. Development and testing are free (unlimited in test/sandbox mode).

---

## Overview — What We're Building

```
ARTES Angular UI
     │  Coach clicks "Send Agreement"
     ▼
ARTES Node.js API  ──── POST /submissions ────►  DocuSeal Cloud
     │                                                │
     │  Saves AgreementDocument (status: sent)        │  Emails client
     │                                                │
     │  ◄──── POST /api/webhooks/docuseal ────────────┘
     │        (status updates: viewed/completed/declined)
     ▼
MongoDB Atlas  (agreement lifecycle stored)
```

---

# PHASE 1 — DocuSeal Account & Template Setup

## Step 1 — Create DocuSeal Account

1. Go to **https://app.docuseal.com**
2. Click **Sign Up** → sign up with Helena Coaching's business email
3. Verify email
4. On the plan screen: select **Pro** ($20/month)
   - You need Pro to get an API key
   - Billing is month-to-month, no contract
5. Enter payment info and confirm

---

## Step 2 — Convert the Coaching Agreement to PDF

You have `Helena_Coaching_Agreement_DocuSeal.docx` (downloaded from ARTES setup).

**On Windows:**
1. Open in Microsoft Word
2. File → Save As → PDF
3. Save as `Helena_Coaching_Agreement.pdf`

**On Mac:**
1. Open in Word or LibreOffice
2. File → Print → Save as PDF

**On Linux (your Bitnami server):**
```bash
libreoffice --headless --convert-to pdf Helena_Coaching_Agreement_DocuSeal.docx
```

> The PDF must preserve all `[[FieldName]]` placeholders — these are your visual guides for placing DocuSeal fields.

---

## Step 3 — Create the DocuSeal Template

1. Log into **app.docuseal.com**
2. Click **Templates** in the left sidebar
3. Click **+ New Template**
4. Select **Upload Document** → upload `Helena_Coaching_Agreement.pdf`
5. Name the template: `Helena Coaching Agreement`
6. Click **Create**

---

## Step 4 — Configure the Signer Role

In the template editor:

1. On the right panel, find **Submitters / Roles**
2. The default role is usually "First Party" — **rename it to exactly:** `Client`
   - This must match the `signerRole` value in your MongoDB `AgreementTemplate` document
3. You can add a second role `Coach` later if you want counter-signatures (leave for now)

---

## Step 5 — Place All Fillable Fields

For each `[[FieldName]]` in the PDF, place a DocuSeal field on top of it.
Use the toolbar on the left to select the field type, then drag onto the document.

### Field Placement Table

| `[[Placeholder]]` in PDF | DocuSeal Field Name | Field Type | Assigned To |
|---|---|---|---|
| `[[AgreementDate]]` | `AgreementDate` | Date | Client (pre-filled) |
| `[[ClientFullName]]` | `ClientFullName` | Text | Client (pre-filled) |
| `[[ClientAddress]]` | `ClientAddress` | Text | Client (pre-filled) |
| `[[ClientEmail]]` | `ClientEmail` | Text | Client (pre-filled) |
| `[[ProgramDurationMonths]]` | `ProgramDurationMonths` | Text | Client (pre-filled) |
| `[[MeetingMethod]]` | `MeetingMethod` | Text | Client (pre-filled) |
| `[[AvailabilityTerms]]` | `AvailabilityTerms` | Text | Client (pre-filled) |
| `[[AdditionalRateAmount]]` | `AdditionalRateAmount` | Text | Client (pre-filled) |
| `[[FeeAmount]]` | `FeeAmount` | Text | Client (pre-filled) |
| `[[PaymentFrequency]]` | `PaymentFrequency` | Text | Client (pre-filled) |
| `[[MeetingLength]]` | `MeetingLength` | Text | Client (pre-filled) |
| `[[RefundPolicy]]` | `RefundPolicy` | Text | Client (pre-filled) |
| `[[CoachPhone]]` | `CoachPhone` | Text | Client (pre-filled) |
| `[[CancellationHours]]` | `CancellationHours` | Text | Client (pre-filled) |
| `[[RecordRetentionYears]]` | `RecordRetentionYears` | Text | Client (pre-filled) |
| `[[TerminationWeeks]]` | `TerminationWeeks` | Text | Client (pre-filled) |
| `[[ICFReleaseAgree]]` | `ICFReleaseAgree` | Checkbox | Client |
| `[[ICFReleaseDecline]]` | `ICFReleaseDecline` | Checkbox | Client |
| `[[ProgramGoals]]` | `ProgramGoals` | Textarea | Client |
| `[[ClientSignature]]` | `ClientSignature` | Signature | Client ← **required** |
| `[[ClientSignDate]]` | `ClientSignDate` | Date | Client ← **required** |
| *(Coach area)* | `CoachSignature` | Signature | *(skip for now)* |
| *(Coach area)* | `CoachSignDate` | Date | *(skip for now)* |

> **Tip on "pre-filled" fields:** For all fields that ARTES will fill programmatically (everything except the signature and checkboxes), check the **"Read Only"** box in DocuSeal so the client sees the pre-filled value but cannot edit it.

4. Click **Save** when done

---

## Step 6 — Get the Template ID

1. After saving, look at your browser URL bar:
   `https://app.docuseal.com/templates/`**`123456`**`/edit`
2. The number is your **Template ID** — save it, you'll need it for MongoDB

---

## Step 7 — Generate API Key

1. In DocuSeal, go to **Settings** (bottom-left gear icon)
2. Click **API** in the sidebar
3. Click **Generate API Key** (or copy the existing one)
4. Copy and save this key — you'll add it to your `.env` as `DOCUSEAL_API_TOKEN`

> Note: DocuSeal uses the header `X-Auth-Token` (not Bearer Authorization).

---

## Step 8 — Configure the Webhook

1. Still in Settings → API, click **Webhooks** tab
2. Click **Add Webhook**
3. Enter your ARTES webhook URL:
   `https://your-artes-domain.com/api/webhooks/docuseal`
4. Select these events:
   - ☑ `submission.created`
   - ☑ `submission.viewed`
   - ☑ `submission.completed`
   - ☑ `submission.declined`
   - ☑ `submission.expired`
5. Click **Save**
6. DocuSeal will show a **Webhook Secret** — copy it as `DOCUSEAL_WEBHOOK_SECRET`

> ⚠️ If your ARTES server isn't live yet, use **https://webhook.site** temporarily to capture test payloads and verify the event shapes before going live.

---

# PHASE 2 — MongoDB Setup

## Step 9 — Insert the AgreementTemplate Document

Connect to your MongoDB Atlas cluster and run this in the ARTES database:

```javascript
// MongoDB shell or Compass — run in your ARTES database
db.agreementtemplates.insertOne({
  tenantId: ObjectId("<YOUR_TENANT_OBJECTID>"),  // Replace with your actual tenant ID
  slug: "coaching_agreement",
  label: "Coaching Agreement",
  docusealTemplateId: 123456,        // ← Replace with your actual DocuSeal template ID (Step 6)
  signerRole: "Client",              // Must match exactly what you set in DocuSeal (Step 4)
  expiryDays: 30,
  isActive: true,
  prefillFields: [
    // --- Auto-resolved from database ---
    { fieldName: "AgreementDate",        source: { kind: "date",   format: "MMMM D, YYYY" } },
    { fieldName: "ClientFullName",       source: { kind: "client", property: "fullName" } },
    { fieldName: "ClientAddress",        source: { kind: "client", property: "address" } },
    { fieldName: "ClientEmail",          source: { kind: "client", property: "email" } },
    { fieldName: "CoachPhone",           source: { kind: "static", value: "+1-514-000-0000" } }, // ← Helena's phone

    // --- Input fields (coach fills these in the ARTES UI when sending) ---
    { fieldName: "ProgramDurationMonths", source: { kind: "input", label: "Program duration (months)", required: true } },
    { fieldName: "MeetingMethod",         source: { kind: "input", label: "Meeting method (Video / Phone / In-person)", required: true } },
    { fieldName: "AvailabilityTerms",     source: { kind: "input", label: "Between-session availability terms", required: false } },
    { fieldName: "AdditionalRateAmount",  source: { kind: "input", label: "Additional services rate (CAD/hr)", required: false } },
    { fieldName: "FeeAmount",             source: { kind: "input", label: "Coaching fee (CAD)", required: true } },
    { fieldName: "PaymentFrequency",      source: { kind: "input", label: "Payment frequency (e.g. per month)", required: true } },
    { fieldName: "MeetingLength",         source: { kind: "input", label: "Session length (e.g. 60 minutes)", required: true } },
    { fieldName: "RefundPolicy",          source: { kind: "input", label: "Refund policy", required: true } },
    { fieldName: "CancellationHours",     source: { kind: "input", label: "Cancellation notice (hours)", required: true } },
    { fieldName: "RecordRetentionYears",  source: { kind: "input", label: "Record retention period (years)", required: false } },
    { fieldName: "TerminationWeeks",      source: { kind: "input", label: "Termination notice (weeks)", required: true } },
    { fieldName: "ICFReleaseAgree",       source: { kind: "input", label: "ICF release — Client agrees", required: false } },
    { fieldName: "ICFReleaseDecline",     source: { kind: "input", label: "ICF release — Client declines", required: false } },
    { fieldName: "ProgramGoals",          source: { kind: "input", label: "Coaching goals and outcomes (Schedule A)", required: true } }
  ],
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

# PHASE 3 — ARTES Backend (.env & Code)

## Step 10 — Update Environment Variables

Add to your `.env` file on the Bitnami server:

```bash
# DocuSeal
DOCUSEAL_API_TOKEN=your_api_key_from_step_7
DOCUSEAL_API_BASE_URL=https://api.docuseal.com
DOCUSEAL_WEBHOOK_SECRET=your_webhook_secret_from_step_8
```

And to `.env.example` (no values):
```bash
DOCUSEAL_API_TOKEN=
DOCUSEAL_API_BASE_URL=https://api.docuseal.com
DOCUSEAL_WEBHOOK_SECRET=
```

> **Important:** DocuSeal's API uses the header `X-Auth-Token`, not `Authorization: Bearer`. The Claude Code prompt specifies this — make sure your `DocuSealService` axios instance uses this header.

---

## Step 11 — Run Claude Code

Make sure you're in the ARTES project root directory. Run:

```bash
cd /path/to/artes-project
claude
```

Then paste the entire contents of `ARTES_DocuSeal_MultiAgreement_Prompt_v2.md` as your first message.

### What Claude Code will build (in order):

```
src/
├── errors/
│   └── agreement.errors.ts              ← custom error classes
├── models/
│   ├── agreementTemplate.model.ts       ← template registry schema
│   └── agreementDocument.model.ts       ← per-document lifecycle schema
├── services/
│   ├── agreementFieldResolver.ts        ← pure field resolution logic
│   ├── docuseal.service.ts              ← DocuSeal API wrapper
│   ├── agreement.service.ts             ← business logic
│   ├── agreementTemplate.service.ts     ← template CRUD
│   └── __tests__/
│       ├── agreement.service.test.ts
│       └── agreementFieldResolver.test.ts
├── routes/
│   └── agreements.routes.ts
├── middleware/
│   └── errorHandler.middleware.ts       ← updated
├── app.ts                               ← updated
└── app/features/agreements/
    ├── agreements.module.ts
    ├── agreements.service.ts
    ├── agreement-status-badge.component.ts
    ├── client-agreements.component.ts
    └── send-agreement-modal.component.ts
docs/
└── docuseal-setup.md
```

### Key correction for Claude Code to make:

The prompt references `Authorization: Bearer` — tell Claude Code:

> "DocuSeal uses `X-Auth-Token` header, not `Authorization: Bearer`. Apply this in the axios instance in `docuseal.service.ts`."

---

## Step 12 — Verify the Axios Header in docuseal.service.ts

After Claude Code generates the service, confirm this section:

```typescript
// src/services/docuseal.service.ts
private readonly client: AxiosInstance;

constructor() {
  this.client = axios.create({
    baseURL: process.env.DOCUSEAL_API_BASE_URL,
    headers: {
      'X-Auth-Token': process.env.DOCUSEAL_API_TOKEN,  // ← must be this, NOT Authorization
      'Content-Type': 'application/json',
    },
  });
}
```

---

## Step 13 — Verify the Webhook Raw Body Setup in app.ts

Confirm the webhook route is registered **before** `express.json()`:

```typescript
// src/app.ts — ORDER MATTERS

// 1. Webhook route first (needs raw body for HMAC verification)
app.use('/api/webhooks/docuseal',
  express.raw({ type: 'application/json' }),
  webhookRouter
);

// 2. JSON parser for everything else
app.use(express.json());

// 3. Regular API routes
app.use('/api/agreements', authMiddleware, agreementsRouter);
app.use('/api/agreement-templates', authMiddleware, adminMiddleware, templateRouter);
```

> If this order is reversed, `req.body` will already be parsed as JSON when the webhook handler runs, and the HMAC signature will fail because you can't reconstruct the original raw bytes.

---

# PHASE 4 — Testing

## Step 14 — Test DocuSeal API Connection

Before running the full app, verify your API key works:

```bash
curl -H "X-Auth-Token: YOUR_API_TOKEN" \
  https://api.docuseal.com/templates \
  | jq '.'
```

You should see your coaching agreement template in the response.

---

## Step 15 — Test Submission Creation (Manual)

```bash
curl -X POST https://api.docuseal.com/submissions \
  -H "X-Auth-Token: YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": 123456,
    "send_email": false,
    "submitters": [{
      "role": "Client",
      "name": "Test Client",
      "email": "your-own-email@test.com",
      "fields": [
        { "name": "ClientFullName",       "default_value": "Test Client" },
        { "name": "AgreementDate",        "default_value": "April 29, 2026" },
        { "name": "FeeAmount",            "default_value": "500" },
        { "name": "ProgramDurationMonths","default_value": "3" },
        { "name": "MeetingMethod",        "default_value": "Video (Zoom)" },
        { "name": "MeetingLength",        "default_value": "60 minutes" },
        { "name": "PaymentFrequency",     "default_value": "per month" },
        { "name": "RefundPolicy",         "default_value": "No refunds after session 1" },
        { "name": "CancellationHours",    "default_value": "24" },
        { "name": "TerminationWeeks",     "default_value": "2" },
        { "name": "ProgramGoals",         "default_value": "Develop leadership presence and emotional regulation skills" }
      ]
    }]
  }' | jq '.'
```

From the response, copy `submitters[0].slug` and open:
`https://docuseal.com/s/THAT_SLUG`

You should see the coaching agreement with all fields pre-filled, ready to sign.

---

## Step 16 — Run the Unit Tests

```bash
cd artes-backend
npx jest --testPathPattern="agreement" --verbose
```

All tests should pass. If `agreementFieldResolver.test.ts` fails on the `input` kind, check that the resolver correctly reads from `runtimeInputs`.

---

## Step 17 — Test Webhook Locally (Development)

Use **ngrok** to expose your local server to DocuSeal:

```bash
# Install ngrok if not present
npm install -g ngrok

# Expose your local port
ngrok http 8080
```

Copy the `https://xxxx.ngrok.io` URL.

In DocuSeal Settings → Webhooks, temporarily change the webhook URL to:
`https://xxxx.ngrok.io/api/webhooks/docuseal`

Send a test document (Step 15 but with `send_email: true` and your own email). Sign it, and watch your local server logs for the incoming webhook events.

---

## Step 18 — Test the Full Angular Flow

1. Start the Angular dev server: `ng serve`
2. Open an ARTES client profile
3. Find the **Agreements** section
4. Click **Send Agreement** → select "Coaching Agreement" from the dropdown
5. Fill in the dynamic input fields (fee, duration, goals, etc.)
6. Click Send
7. Check your email for the DocuSeal signing link
8. Sign the document
9. Return to ARTES — the agreement status should update to `completed` via the webhook

---

# PHASE 5 — Production Deployment

## Step 19 — Update ARTES Nginx/Apache Config (Bitnami)

Ensure your webhook endpoint is publicly reachable. In your Bitnami Apache config or nginx:

```nginx
# Already covered by your main reverse proxy if ARTES is on 443
# Verify this route is not blocked:
# POST https://your-artes-domain.com/api/webhooks/docuseal
```

Test reachability:
```bash
curl -X POST https://your-artes-domain.com/api/webhooks/docuseal \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 401 (signature missing) — that's correct, means the route is live
```

---

## Step 20 — Update DocuSeal Webhook to Production URL

1. DocuSeal Settings → Webhooks
2. Change URL from ngrok to: `https://your-artes-domain.com/api/webhooks/docuseal`
3. Save

---

## Step 21 — PM2 Restart

```bash
pm2 restart artes-server
pm2 logs artes-server  # watch for any startup errors
```

---

# PHASE 6 — Adding Future Agreement Types

## How to Add a New Agreement (e.g., NDA) — Zero Code Changes

1. **Create the PDF** — write the NDA, mark `[[FieldName]]` placeholders
2. **Upload to DocuSeal** — Templates → New Template → place fields → save → get template ID
3. **Insert MongoDB document:**
   ```javascript
   db.agreementtemplates.insertOne({
     tenantId: ObjectId("<TENANT_ID>"),
     slug: "nda",
     label: "Non-Disclosure Agreement",
     docusealTemplateId: 789012,    // new template ID
     signerRole: "Client",
     expiryDays: 14,
     isActive: true,
     prefillFields: [
       { fieldName: "AgreementDate", source: { kind: "date", format: "MMMM D, YYYY" } },
       { fieldName: "ClientFullName", source: { kind: "client", property: "fullName" } },
       { fieldName: "ConfidentialityPeriod", source: { kind: "input", label: "Confidentiality period (years)", required: true } },
       // ... whatever fields your NDA has
     ],
     createdAt: new Date(), updatedAt: new Date()
   });
   ```
4. **Done.** The ARTES UI will automatically show "NDA" in the Send Agreement dropdown.
   The dynamic input form will render the `input` fields. No redeploy needed.

---

# Quick Reference — Key Values to Track

| Item | Where to Find | Where to Use |
|---|---|---|
| DocuSeal Template ID | Browser URL when editing template | MongoDB `agreementtemplates.docusealTemplateId` |
| DocuSeal API Token | DocuSeal Settings → API | `.env` as `DOCUSEAL_API_TOKEN` |
| DocuSeal Webhook Secret | DocuSeal Settings → Webhooks | `.env` as `DOCUSEAL_WEBHOOK_SECRET` |
| ARTES Tenant ObjectId | MongoDB `tenants` collection | MongoDB seed documents |
| Webhook URL (prod) | Your ARTES domain | DocuSeal Settings → Webhooks |
| Signer Role Name | Must be `Client` (case-sensitive) | `agreementtemplates.signerRole` |

---

# Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `401` on API calls | Wrong header name | Use `X-Auth-Token`, not `Authorization` |
| Fields not pre-filling | Field name mismatch | DocuSeal field names are case-sensitive — match exactly |
| Webhook 401 | HMAC mismatch | Ensure raw body middleware is before `express.json()` |
| Webhook not firing | Wrong URL or wrong events selected | Verify in DocuSeal Settings → Webhooks |
| Template not found | Wrong `slug` or `isActive: false` | Check MongoDB document |
| `AgreementConfigError` on `input` field | Required input not passed | Ensure UI sends all required `runtimeInputs` |

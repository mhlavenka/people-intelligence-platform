# ARTES Multilingual Support — Design Document

**Status:** Proposal
**Author:** HeadSoft Tech (with Claude)
**Last updated:** 2026-04-15

---

## 1. Goal

Make ARTES fully usable in languages other than English — UI, emails, AI-generated content, and the coaching intake library — so HeadSoft × Helena Coaching can onboard non-English speaking organisations without forking the product.

Target initial set: **English + French**. Architecture should make adding a 3rd / 4th language a single Claude Code session of translation work, not another engineering project.

**Execution model:** the engineering work is performed end-to-end by Claude Code, not a human team. Estimates below are in Claude-Code sessions (focused work sessions of the tool doing reads/edits/verifications) and human review cycles (the user approving/directing between sessions). The translations themselves are also produced by Claude — no external vendor is engaged.

## 2. Scope — measured, not guessed

All numbers below come from an empirical pass over the current `master` branch.

| Surface | Current count | Notes |
|---|---:|---|
| Frontend TS components | 96 files | `modules/` + `core/` + `shared/` |
| UI template strings (labels, buttons, tooltips, hints, placeholders, headings) | **~2,100** | grep proxy across `mat-label`, `matTooltip`, `h1-3`, `p`, `placeholder`, `mat-hint`, `<button>` |
| `snackBar.open(...)` sites (ephemeral messages) | 97 across 17 files | |
| Date/currency/number pipe usages | 144 across 41 files | plus 10+ hard-coded `'en-US'` / `'en-GB'` / `'USD'` |
| Backend JSON error strings | ~210 across 28 files | `res.json({ error: '...' })` patterns |
| Email templates (SES via `bookingNotification.service`) | 7 send sites, ~26 lines of inline English HTML | confirmation, cancellation, reschedule, reminder (×2) |
| AI prompt builders | 8 functions in `ai.service.ts` | None currently accept a language input |
| Seeded global intake templates | 5 templates / **112 questions** (85 scale, 13 boolean, 14 text) | `IQuestion.text` is a single string — schema change required |
| Existing i18n dependencies | **0** | no `@angular/localize`, `ngx-translate`, `i18next`, `LOCALE_ID` provider, nothing |

**Headline:** the app is 100 % English today with no i18n scaffolding. The design has to land the scaffolding first, then migrate surfaces in waves.

## 3. User / product model

### Language resolution

Resolve the effective language per request in this order:

1. `User.preferredLanguage` (set once by the user in profile settings; defaults to org default on account creation)
2. `Organization.defaultLanguage` (set by admin; defaults to `'en'`)
3. `Accept-Language` header from the browser (public / anonymous flows — e.g. the public booking page)
4. `'en'` fallback

### New schema fields (additive, non-breaking)

```ts
// backend/src/models/Organization.model.ts
defaultLanguage: string;            // 'en' | 'fr' | ...
supportedLanguages: string[];       // subset the org allows its users to switch to

// backend/src/models/User.model.ts
preferredLanguage?: string;         // undefined = inherit org default
```

### Frontend switcher

A language picker in the user profile menu (`app-shell`). Public booking flow exposes the same picker via URL `?lang=` + localStorage fallback.

## 4. Architecture decisions

### 4.1 Angular frontend — `ngx-translate` (runtime), not `@angular/localize` (build-time)

**Why runtime:**
- One build artefact for all locales (important — current deploy uploads ~500 kB bundle to EC2; multiplying by N locales is wasteful for a B2B SaaS with one small production org).
- Users can switch language without a reload or reshell.
- Future requirement: admin-managed translations of intake content at runtime (see §4.4). A build-time framework can't help with that.
- Trade-off: strings don't get compile-time validation. Mitigated with a CI check (`ngx-translate-extract --clean` must produce zero diffs).

Translation files live at `frontend/src/assets/i18n/{lang}/{namespace}.json`, one namespace per module (auth, coaching, booking, survey, admin, etc.) to keep file sizes manageable.

### 4.2 Backend — `i18next` with JSON resource bundles

- Middleware reads the user's `preferredLanguage` (or Accept-Language for public routes) and attaches `req.t(key, vars?)`.
- Replace the `{ error: 'Foo' }` sites with `{ error: req.t('errors.foo') }`.
- Email composition takes a `language` parameter end-to-end — `sendBookingConfirmation(booking, coach, cancelUrl, language)` — and renders from i18next.
- Luxon date formatting: `DateTime.fromJSDate(d).setLocale(language).setZone(tz).toFormat(...)`.

### 4.3 AI prompts — instruct Claude to respond in the user's language

All eight `build*Prompt()` functions gain a `language` parameter. The prompt's closing instruction becomes:

```
Respond with only valid JSON. All string values in the JSON must be
written in {{ humanLanguageName }}. Do not translate the JSON keys —
they must stay exactly as specified above.
```

Rationale:
- Claude handles multilingual output natively; we don't need separate prompts per language.
- Keeping JSON keys English means backend parsing and DB schema stay stable.
- Downstream consumers (e.g. conflict analysis narrative shown in UI) already render raw values, so they pick up the target language transparently.

Evaluation: run each prompt in each target language with a small fixture set (2-3 inputs each); eyeball outputs for hallucinations / tone drift. Budget: 1 day.

### 4.4 Dynamic content — intake templates

The hardest and most expensive piece. Current schema:

```ts
IQuestion.text: string   // "I feel safe expressing concerns..."
```

**Proposal:** replace the scalar with a translations map, keeping the old string-writing code-path working via a virtual accessor.

```ts
IQuestion {
  id: string;
  category: string;
  categoryTranslations?: Record<string, string>;   // { fr: 'Sécurité psychologique' }
  type: 'scale' | 'boolean' | 'text' | 'forced_choice';
  text: string;                                    // default (English) — still required
  translations?: Record<string, string>;           // { fr: '...' }
  // existing fields: scale_range, labels, options, forced_choice_options...
}
```

Access pattern: a helper `questionText(q, lang)` returns `q.translations?.[lang] ?? q.text`. Applied at three sites: survey-take rendering, survey-responses-dialog rendering, AI prompt composition (we feed the ENGLISH text to Claude always — this gives stable analysis even for non-English respondents — but render the UI copy in the respondent's language).

**Admin UX:** the existing `survey-template-dialog` gets a per-question "Add translation" affordance; when an org has `supportedLanguages: ['en', 'fr']` the dialog asks for text in both on save. Machine-pre-fill via a one-shot Claude call gets the admin 90 % of the way there — they edit rather than author.

**Migration:** existing `text` stays as the English default. No DB migration required on day one — `translations` is optional. We backfill the 112 seeded questions via the seed script on deploy.

Survey **responses** (`SurveyResponse.responses[i].value`) are user-authored free text and are not translated. They remain in whatever language the coachee wrote them in; the coach reads them as-is.

### 4.5 Dates / currencies / numbers

- Drop every bespoke `toLocaleString('en-US', ...)`. Replace with `formatDate`/`formatNumber`/`formatCurrency` from `@angular/common` using the current `LOCALE_ID`.
- Register the target locales at bootstrap with `registerLocaleData(localeFr)` (and English is registered by default).
- Currency: keep `Invoice.currency` per-invoice — the user's language doesn't decide what currency they're billed in.
- Zone: keep `booking.clientTimezone` / `coachTimezone` — independent of language.

## 5. Phases & effort estimate (Claude Code execution)

Effort is measured in two dimensions:
- **Claude hours** — focused tool time doing reads, edits, `tsc --noEmit` checks, and self-verifies. Conservative throughput assumption: ~12 component touches per hour including tsc verification, ~40 small string-replacements per hour with batch edits.
- **Review cycles** — passes of human review where the user runs the UI in a browser, eyeballs translations, and directs follow-ups. The user's availability gates total calendar time.

| Phase | Scope | Claude hours | Review cycles |
|---|---|---:|---:|
| 0 | Decisions & sign-off (this doc) | — | 1 |
| 1 | Foundation: install `ngx-translate` + `i18next`, middleware, language resolver, `User.preferredLanguage` / `Organization.defaultLanguage` + `supportedLanguages`, language switcher in profile menu, `LOCALE_ID` + `registerLocaleData(localeFr)`, i18n namespace skeleton | **~2 h** | 1 |
| 2 | Frontend string extraction + replacement across 96 components (~2,100 keys), 97 snackBar helpers, form validation messages, CI check (`ngx-translate-extract --clean` must be a no-op). Claude does this module by module and tsc-verifies between chunks | **~8 h** | 2 — sampling at 25 % and 75 % completion |
| 3 | Backend error strings (~210) → `req.t()`; email templates parameterised by `language`; luxon `setLocale`; booking flows smoke-tested end-to-end | **~3 h** | 1 |
| 4 | AI prompts: `language` param on all 8 builders + the closing-instruction block; evaluation harness that runs each prompt × each language × 2 fixtures and dumps outputs to disk for user review | **~2 h (+ ~1 h of API time running fixtures)** | 1 — Helena / user eyeballs FR output |
| 5 | Intake: `IQuestion.translations` + `categoryTranslations` + `questionText(q, lang)` helper, admin UI in `survey-template-dialog` with per-question translation fields, `seed-surveys.ts` rewrite translating all 112 questions to French (Claude produces the translations in the same session) | **~4 h** | 1 |
| 6 | Dates / currencies / numbers: remove hard-coded `en-US` / `en-GB`, switch to LOCALE_ID-aware `formatDate`/`formatNumber`/`formatCurrency`, luxon `setLocale(language)` on backend | **~1 h** | — (rolls into Phase 7) |
| 7 | QA: pseudolocalisation build, full role-based flows in both languages, long-string layout regressions (French is ~15–25 % longer than English on average — chips and button groups are the usual offenders) | **~3 h (fixes) + review time** | 2–3 cycles |

**Totals:**
- **Claude Code time: ~23 hours of focused work** (≈ 3 working days if back-to-back)
- **Human review time: 6–8 review cycles** spread across the project
- **Calendar wall-clock, realistic:** **1–2 weeks** depending on how many review cycles per day the user wants to run (2 cycles/day → ~1 week; 1/day → ~2 weeks)

Translation is **not** a separate track. Claude produces the French JSON bundles and intake translations inside Phases 2 / 3 / 5. A single-pass French translation of ~2,500 UI/error strings takes one batch prompt; a polish pass for coaching-domain tone (tu vs vous, formality register, field-specific terms like "coachee" → "coaché·e" or "bénéficiaire") is a second prompt. Budget: included in the Claude hours above.

## 6. Risks & open questions

1. **Long-string layout bugs.** French labels frequently overflow Material chips / narrow buttons (French runs ~15–25 % longer than English on average in UI contexts). Budget for ~3 hours of cosmetic fixes in Phase 7; catch the worst offenders early via a pseudolocalisation build (e.g. English wrapped in `[xxxx… ]`).
2. **RTL languages** (Arabic, Hebrew) are **out of scope** for v1. Adding them is a separate 1–2 week effort for the `dir="rtl"` flip, Material theme adjustments, and directional icon swaps.
3. **AI output quality in French.** Claude handles French very well for coaching-domain content, but the conflict analysis narrative and manager script are the most sensitive — we should run a side-by-side evaluation with Helena before shipping to a French-speaking org. Phase 4's eval harness is designed to dump outputs in a reviewable form precisely for this.
4. **Email rendering regressions.** SES rendering of non-ASCII UTF-8 requires the existing `Content-Type: text/html; charset=UTF-8` headers to be preserved — verified in current code, but worth an integration test in the QA phase.
5. **Who maintains translations post-ship?** The admin UI we build in Phase 5 handles per-org intake content. For the core UI strings the process is: every PR that adds a new English key must add the French counterpart in the same PR. Claude Code can do this in the same session it introduces the feature — the CI check from Phase 2 (`ngx-translate-extract --clean`) catches any English key that ships without its French sibling, so translations can't rot silently.
6. **Partial coverage fallback.** If a translation file is missing a key, `ngx-translate` shows the key literally (ugly). Configure it to fall back to English silently; log misses to the console in development.
7. **`slug` fields** (org slug, coach public slug) are NOT translated — they are URL identifiers. Document this for the admin UI so no-one tries.
8. **User-authored free text** (`CoachingEngagement.goals`, `Session.coachNotes`, `SurveyResponse.responses[i].value`, `JournalSessionNote.*`) is never auto-translated. Each user authors in whatever language they prefer, and other users read it as-is. This is a product decision, not a technical limitation.

## 7. Out of scope (v1)

- RTL (Arabic / Hebrew).
- Translation of user-authored content (notes, goals, journal entries).
- Localised number formatting in AI output (Claude handles this reasonably well on its own).
- PDF / export localisation (no exports exist today).
- Localised marketing landing page (separate concern).
- Per-language URL routing (e.g. `/fr/coaching`); we stay with query-param / localStorage for v1.

## 8. Rollout plan

1. **Feature-flagged behind `ORG_I18N_ENABLED=true`** until Phase 7 sign-off, so production HeadSoft org stays English during development.
2. Backfill: seed script adds FR translations for the 112 global intake questions on deploy.
3. Switch the language picker from "hidden" to "visible" once Phase 7 completes.
4. Announce to the existing org with a changelog note; the default remains English so nothing changes for current users.

## 9. Recommendation

Ship Phases 1–4 + 6 + 7 (everything except the dynamic-intake piece) in the first pass — that's **~17 hours of Claude Code time + ~4 days of human review**, roughly **1–1.5 calendar weeks** end-to-end — and it gives a fully translated product UI + emails + AI output in French. Phase 5 (intake content) follows the week after, once the schema change and admin editing UI have been exercised against the seeded library.

This keeps the first usable milestone inside a single cycle and avoids the schema migration blocking the UI wave.

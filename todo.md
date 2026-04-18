# ARTES todo list
-----------------
 
I. MODULES
----------
**Conflict Intelligence**
 - created an analysis and design doc "conflict_intelligence_module.docx"

**Coaching Module**
 - add mentoring to coaching module
 - invoicing, QB integration
   - when invoice is sent, the tax line does not have different possible taxes - ex. split gst/qst
   - should the invoice to sponsor be a pdf attachment rather than email body? 
 - repeating schedules for session creation by coach (weekly / monthly)

**Booking**

**IDPs** 
- users need to have access to it and be able to print / follow thru with coach follow up - notifications, reminders, etc.

---------
**Leadership & Succession** 
 - IDP cards - how is the status changed from draft to active to completed?

II. SYSTEM
----------
**Organization setup** 
 - put together users / departments / orgchart in more logical way. Make me a proposed solution before implementing so I can approve
**Google Test Env**
 - need to switch to prod and have the app approved by google
**Multilingual**
 - design done, need to implement
   - there is still a lot of untranslated strings in all modules - example bookings dashboard tabs, buttons, table column titles, mini calendar statuses 
   - make sure that all future changes ad keys to all language files that exist (might be adding languages) 
   - Add a line to CLAUDE.md like: All new UI strings must use `{{ 'KEY' | translate }}` — add keys to both `frontend/src/assets/i18n/en.json` and `fr.json` in the same change.
   - Add a pre-deploy test that will validate missing translations - if not passed will prompt and add

     That way every future Claude Code session picks it up from the project instructions.

**Placeholders**
 - Billing - contact us to upgrade - create form to send a contact us to system admin via SES. Alternatively let the organization admin upgrade / choose a plan

III. LOW
--------
 - do I want a mobile Android / iPhone app?


IV. NICE TO HAVE
----------------
 - user guide + how tos









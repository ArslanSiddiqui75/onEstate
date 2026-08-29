# 0nEstate (CertifiedUK / CertifiedUS) — Project Context

> **Purpose**: This file preserves project context across model switches and chat sessions.
> **Last updated**: 2026-08-29 (inbound email webhook shipped; X + portal live HTTP skipped)

---

## Chat handoff — NEXT: transactions e-sign (2026-08-29)

Use this block when starting a **new Cursor chat**. Repo: `ArslanSiddiqui75/onEstate` (`main`). Live app: https://on-estate.vercel.app

If Arslan says **"continue"** / **"next task"** with no extra detail: do the first unchecked item under **Pick up here**. Do not redo shipped work below.

### Pick up here (ordered)
1. **[START HERE] Transactions e-sign** — UI indicators only; no provider yet.
2. WhatsApp later (international path). Do not switch off Twilio.
3. Drop legacy `social_posts` columns (`content`, `scheduled_at`, …) when safe.

**Skipped (do not pick up unless Arslan asks):**
- **X (Twitter) live-test** — skipped this cycle. Env is on Production; no X account connected. FB + LinkedIn posted from org `c3d7bf08…` on 2026-08-16.
- **Portal partner live HTTP** (Rightmove/Zoopla/MLS) — client has been told; wait for commercial APIs. Export-ready adapters stay as they are.

Out of scope for website v1: free canvas, custom HTML/CSS, full CMS / multi-page IA. Org switcher — **skip**. Themes stay at the current 4 until Arslan supplies new UIs.

### Shipped (do not rebuild)
- **Inbound email webhook** — Resend `email.received` at `/api/email/webhook/inbound` (Svix-signed). Fetches body via Receiving API, matches Reply-To plus-tag (`inbox+{leadId}@…`) then From → `leads.email`, logs on the **email** thread (SMS is a separate thread), cancels `no_reply`. CRM Inbox still simulates inbound (SMS or email). Needs `RESEND_WEBHOOK_SECRET` + receiving domain; `EMAIL_INBOUND_ADDRESS` sets outbound Reply-To. Files: `src/lib/email/{inbound,webhook,service}.ts`. Migration **016**.
- **`lead_contacted` / `no_reply` runtime** — first CRM/API SMS or email (count of outbound `messages` === 1) fires `lead_contacted`. Does **not** fire from automation/sequence sends (avoids welcome-SMS loops). `no_reply` = last message still outbound and older than 48h; scanned at the start of `processAutomationRuns` (cron + CRM flush). A real or simulated inbound cancels pending/waiting/running `no_reply` runs. Files: `src/lib/automations/engine.ts`, `/api/twilio/sms`, `/api/email/send`, inbound routes.
- **Message sequence runner** — seeded follow-up + nurture playbooks; enroll toggles send the next step now; **Send next** for the rest. No Day-N scheduler (automations still own `wait`). Files: `src/lib/sequences/{catalog,ensure,engine}.ts`, `/api/sequences/advance`, CRM Automations tab. Migration **015**.
- **CRM automations actually run** — `3f97ea5`. Engine `src/lib/automations/engine.ts`. Triggers: `addLead` → `lead_created`, `updateLeadStage` → `stage_changed`. `wait` steps park until `/api/automations/cron/run` or CRM page flush. `update_stage` does **not** re-fire `stage_changed`.
- **Messaging** — simulated inbound in CRM inbox (`/api/messaging/inbound`); `MESSAGING_MODE`. Twilio **can deliver to PK** (`+92…`). It cannot **receive inbound SMS from Pakistani numbers**; we do not need PK inbound now — CRM simulate-reply is the test path.
- **Lead edit** — pipeline pencil or Edit in the lead drawer. `LeadPatch` + `updateLead` (session + supabase). Score recomputes; stage change still fires `stage_changed`.
- **Phone country codes (E.164)** — dial-code picker on add/edit lead and contacts. `0333…` + Pakistan → `+92333…`. SMS send/automations refuse numbers without `+`. Files: `src/lib/phone/e164.ts`, `src/components/crm/phone-field.tsx`. Not a full telephony product; default dial is UK `+44` / US `+1`.
- **Email channel** — Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set, else simulated and still logged. Automation step `send_email`. CRM Inbox has separate SMS and email threads. Inbound via Resend webhook (or simulate). Files: `src/lib/email/{capabilities,client,service,inbound,webhook}.ts`, `/api/email/send`, `/api/email/webhook/inbound`. Migrations **014**, **016**.
- **Public websites + lead capture** — `5c7c5be`. `/site/[slug]`; `src/proxy.ts` rewrites custom domains; `POST /api/public/leads` creates a CRM lead and fires `lead_created` automations. Unpublished sites stay private.
- **Website section palette + reorder** — curated blocks (hero/listings/about/contact + optional testimonials/stats/cta), show/hide, up/down reorder, per-block style variants. Catalog: `src/lib/website/sections.ts`. Footer is always last. Older payloads hydrate from `show*` flags.
- **Lead routing + scoring** — `src/lib/crm/{scoring,routing}.ts`. Team/Enterprise: round-robin / territory / least-open / creator. Score is computed (source, completeness, type, priority), not typed. Website capture uses the same engines. CRM → Routing tab. Solo still assigns to the person who adds the lead.
- **Domain CNAME verify + SSL** — live DNS (CNAME chain + apex A → Vercel IPs) and TLS probe on 443. Auth via Bearer (`resolveProfileFromRequest`); persist `custom_domain` + payload status with service role. Optional `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` attaches the hostname so certificates can issue. UI: copyable records, apex vs www. Files: `src/lib/website/{domain,domain-records}.ts`, `src/components/website/domain-panel.tsx`, `src/app/api/website/domain/verify/route.ts`.
- **Hosted migrations 010–016 applied** on project `pruezuqdsofegzhbodnj`. 015 creates `message_sequences` / `sequence_enrollments`. 016 splits SMS vs email threads.

### Key files for next work
Transactions e-sign (provider TBD) · CRM deals UI

### Habits
Commit + push major changes automatically (`.cursor/rules/git-auto-push.mdc`). User is **Arslan**. Verify UI in the browser when changing web app behavior.

### Portal sync foundation (2026-08-17)
Honest multi-portal sync (not fake in-memory worker):
- Connect branch ID + feed key under Listings → **Portal connections**
- **Validate & sync portals** runs all market adapters (Rightmove/Zoopla/OTM or MLS)
- Builds downloadable feed JSON; marks connected portals `synced` (export-ready)
- Live HTTP to real portals still needs commercial partner APIs — **skipped until client has those** (informed 2026-08-29)
- Files: `src/lib/portals/{adapters,connections,payload,readiness}.ts`, listings page, migration `008_portal_sync_status.sql`

---

## Chat handoff — Social module (2026-08-16)

Repo: `ArslanSiddiqui75/onEstate` (`main`). Live app: https://on-estate.vercel.app

### What works now
- **Publish now** (Compose → Instagram Graph) after media upload
- **Media upload** via **signed URL** → Supabase Storage (avoids Vercel ~4.5MB body 413)
- **Scheduled posts** via **cron-job.org** every 1–5 min hitting `/api/social/cron/publish`
  - Auth: header **`X-Cron-Secret: <SOCIAL_CRON_SECRET>`** (preferred). Query `?secret=` breaks if the secret contains `&` / special chars
  - Verified test run **200 OK**: `{"processed":1,"published":1,"failed":0}` (2026-08-16 ~13:20 UTC)
- Also: opening `/app/social` calls **`POST /api/social/publish-due`** (flushes due posts for signed-in org) — Hobby workaround
- Vercel **Hobby**: platform cron is **daily only** (`vercel.json` → `0 12 * * *`). Do **not** put `*/5` in `vercel.json` (deploy fails)

### Critical data gotcha — duplicate `tp` orgs
Several orgs are named `tp`. Instagram `@son.ion_kebab` is only on:

| Org id prefix | Connected IG? | Sign-in emails |
|---|---|---|
| `c3d7bf08…` | **Yes** | `bilalsiddiqui3k3@gmail.com`, `i253101@isb.nu.edu.pk` |
| `d9b54dd8…` | No | `arslansiddiqui2k5@gmail.com` |
| other `tp` | No | empty / other |

UI shows **Workspace** name + short org id in the shell. Wrong email = empty Accounts.

### Env (Vercel Production + Preview)
- Supabase: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`
- `SOCIAL_TOKEN_ENCRYPTION_KEY`
- `SOCIAL_CRON_SECRET` + **`CRON_SECRET` (same value)** for Vercel Cron bearer
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (and Meta/etc. as needed)
- App URL / OAuth redirects for production domain

### Bug → fix log (commits on `main`)
| Issue | Fix | Notes |
|---|---|---|
| Tab freeze on upload/publish | Browser Supabase client **singleton**; auth listener no nested deadlock / no full refetch every focus | `src/lib/supabase/client.ts`, `session.tsx` |
| Publish → Saving… then nothing | Legacy `social_posts.content` NOT NULL no default | Migration `007_social_posts_schema_align`; Compose error toasts |
| Accounts empty in other browser | Different user/org; duplicate `tp` names | Shell workspace id; Accounts copy; toast on load fail |
| 6MB MOV → 413 | Signed upload URL; `uploadToSignedUrl` | `upload-media/route.ts`, `media.ts` — `abe68d6` / later |
| Schedule never fires on Hobby | Daily Vercel cron + cron-job.org + page flush | `vercel.json`, `publish-due`, Social `DuePostsFlusher` — `7069954` |

### Still open / next product work
- [x] **Message sequence runner** — shipped (seeded playbooks + enroll / Send next; no extra scheduler)
- [x] Facebook + LinkedIn live publish — 3-account post succeeded 2026-08-16 after LinkedIn version header was fixed (`20240101` was invalid; now `202608`)
- [x] **`lead_contacted` / `no_reply` runtime**
- [x] Inbound email webhook
- [ ] Live-test **X** publish — **skipped** this cycle (env configured; Connect an X account — paid API tier required)
- [ ] Drop legacy `social_posts` columns (`content`, `scheduled_at`, …) when safe
- Repo habit: **commit + push major changes automatically** (see `.cursor/rules/git-auto-push.mdc`)

### Key paths
`src/lib/social/{media,providers,publish-service,crypto}.ts` · `src/components/social/social-planner.tsx` · `src/components/shell/app-shell.tsx` · `src/app/api/social/**` · `src/lib/supabase/client.ts` · `src/lib/app/session.tsx` · `vercel.json` · `supabase/migrations/006_social.sql`, `007_social_posts_schema_align.sql` · `src/app/app/website/page.tsx` · `src/lib/website/templates.ts`

---

## What Is This

A unified, multi-tenant real estate SaaS platform built for estate agencies and brokerages. Two go-to-market brands (CertifiedUK / CertifiedUS) share a single codebase toggled by `NEXT_PUBLIC_BRAND`.

Three surfaces:
- `/` — Marketing landing page
- `/app` — Multi-tenant product workspace (6 modules)
- `/admin` — SaaS admin console
- `/site/[slug]` — Public tenant website (unpublished stays 404). Custom domains rewrite via `src/proxy.ts`

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **UI Primitives**: Radix UI
- **Auth & DB**: Supabase Auth + Postgres + RLS (optional — durable localStorage fallback)
- **SMS/Telephony**: Twilio (optional — simulated when unset). Stay on Twilio for embedded CRM SMS; **do not switch to RingCentral** (seat-priced UCaaS, weak multi-tenant fit; does not fix PK inbound). WhatsApp later for international.
- **Payments**: Stripe Checkout + Customer Portal (platform-owned)
- **Validation**: Zod v4
- **Icons**: Lucide React
- **Package manager**: npm

---

## Project Structure (Key Paths)

```
src/
├── app/
│   ├── page.tsx                      # Marketing landing page
│   ├── site/[slug]/page.tsx          # Public tenant website (server component)
│   ├── proxy.ts                      # Custom-domain rewrite → /site/<host> (Next 16)
│   ├── admin/                        # SaaS admin console
│   ├── app/                          # Product workspace
│   │   ├── crm/page.tsx              # CRM: pipeline, contacts, inbox, calls, automations
│   │   ├── listings/ website/ social/ transactions/ billing/
│   ├── api/
│   │   ├── automations/  (trigger/ run-due/ cron/run/)
│   │   ├── messaging/    (inbound/ status/)
│   │   ├── public/leads/             # Website form → CRM lead
│   │   ├── stripe/  twilio/  social/  waitlist/  website/domain/verify/
├── components/
│   ├── crm/automation-builder.tsx, lead-routing-panel.tsx
│   ├── website/{website-preview, editable-field, public-contact-form, section-palette}.tsx
│   ├── social/  shell/  ui/
├── lib/
│   ├── app/session.tsx
│   ├── automations/engine.ts         # Runtime (enqueue + execute + wait)
│   ├── messaging/{service,capabilities}.ts
│   ├── website/{templates,defaults,public-site,slug,sections}.ts
│   ├── crm/{scoring,routing}.ts
│   ├── data/  stripe/  twilio/  social/  portals/  rbac/  plans/
├── types/index.ts
supabase/migrations/                  # 001–012 (012 lead_routing jsonb on orgs)
```

---

## Data Architecture

**Dual-mode persistence**: Everything works without Supabase (localStorage) and with Supabase (Postgres + RLS).

Key types:
- `WorkspaceSnapshot` — full state object (workspace-store.ts)
- `WorkspaceOrg` — org with Stripe billing fields
- `WorkspaceUser` — user with role + orgId
- `WebsiteSite` — website config (headline, tagline, **slug**, domain, sections, templateId, published, domainStatus)
- `Lead`, `Contact`, `Listing`, `TransactionDeal` — core business objects. Lead stages: `new → contacted → qualified → viewing → offer → won|lost`. `LeadRoutingSettings` on the org. No separate deals table; Transactions is post-offer.
- `SocialAccount`, `SocialPost` — social module
- `Automation`, `AutomationStep`, `AutomationRun`, `LeadActivity` — CRM workflows + timeline
- `LeadTask`, `ConversationMessage` — SMS inbox + follow-up tasks

**CRM UI** (`/app/crm`): Pipeline (table, not kanban), Contacts + promote-to-lead, Texting inbox, Calls (manual log, no dialer), Automations. Website/portal/waitlist capture: **website form now creates leads**; portal/waitlist still do not. No lead↔listing FK. Won leads do not auto-create transactions.

Session provider (`lib/app/session.tsx`) exposes all state + mutation methods via React Context.

---

## RBAC

6 roles × 6 modules matrix. Enforced in UI (`hasModuleAccess`) and DB (RLS policies).

| Module | Owner | Broker | Team Lead | Agent | Assistant | Accountant |
|---|---|---|---|---|---|---|
| CRM | Full | Full | Full | Full | Full | Full |
| Listings | Full | Full | Full | Edit | View | Full |
| Transactions | Full | Edit | Edit | View | — | View |
| Website | Edit | Edit | Edit | — | — | — |
| Social | Edit | View | View | — | Edit | — |
| Billing | View | — | View | — | — | Full |

---

## Module Completion Status

### ✅ Fully Built (just need env keys / migrations to go live)
1. **CRM & Lead Management** (~99%) — Pipeline, contacts, SMS, **email (send + inbound)**, call logging, automation runtime (`lead_created` / `stage_changed` / `lead_contacted` / `no_reply`), **lead routing + scoring**, **sequence enroll / Send next**. Timed drip stays on automations.
2. **Listings & Portal Sync** (~85%) — Table, search, sync buttons, portal adapters (export-ready; live APIs need partnerships)
3. **Transactions & Compliance** (~80%) — Deal cards, checklists, progress bars, e-sign indicators
4. **Social Media Tools** (~85%) — All 4 platforms with real OAuth; IG publish + schedule verified; FB/LI/X live-test deferred
5. **Billing & Subscriptions** (~90%) — Stripe Checkout, Portal, Webhooks (6 events), plan swap with proration, UI
6. **Website Builder** (~95%) — 4 themes, visual editor, public `/site/[slug]` + custom-domain proxy, contact form → CRM leads, **section palette + reorder + variants**, **live DNS verify + TLS probe** (optional Vercel domain attach).

### 🔴 Major Work Remaining
- Transactions e-sign is UI-only
- WhatsApp (later international SMS path)
- X (Twitter) live publish smoke — skipped this cycle; Connect + paid API when asked
- Partner portal HTTP (Rightmove/Zoopla/MLS) — client informed; wait for commercial APIs

---

## Integration Status

### Website → public render + lead capture — ✅ (2026-08-29)
- Public tenant site at **`/site/[slug]`** (server component, `revalidate = 60`)
- Resolver `src/lib/website/public-site.ts` — matches `websites.slug` OR `custom_domain`, service role, **unpublished stays private**
- Custom domains: `src/proxy.ts` rewrites non-platform hosts `/` → `/site/<host>` (Next 16 renamed `middleware` → `proxy`)
- Migration `011_public_sites.sql` — `websites.slug/custom_domain/published` columns + unique indexes, `leads.capture_source`, `lead_capture_events`
- `saveWebsite` now writes those routing columns (payload alone can't be looked up by host)
- Only `active` / `under_offer` listings render publicly (max 12)
- Capture: **`POST /api/public/leads`** — honeypot + per-IP rate limit (5/min), creates lead + `lead_phone_numbers` + activity + capture event, then fires `lead_created` automations
- `WebsiteCanvas` takes an optional `contactForm` node; editor keeps placeholders, public render gets the live form
- Editor shows a "View live site" link once published

### Website section palette — ✅ (2026-08-29)
- Curated blocks only (not Webflow): core hero / listings / about / contact + optional testimonials / stats / CTA
- Order + visibility + variant live in `WebsiteSite.sections` (jsonb payload). Older sites hydrate from `show*` flags; save writes both.
- Per-block variants: hero overlay/left/split, listings grid-2/grid-3/cards, about split/stacked, contact compact/stacked, plus quote/featured, stats row/cards, CTA banner/centered
- Editor: Website → **Sections** panel (`section-palette.tsx`). Footer is pinned last.
- Files: `src/lib/website/sections.ts`, `src/components/website/section-palette.tsx`, `website-preview.tsx`

### Lead routing + scoring — ✅ (2026-08-29)
- Scoring: `src/lib/crm/scoring.ts` — transparent 0–100 from email/phone/budget/notes + source + type + priority. Shown on Team/Enterprise; still stored on Solo.
- Routing: `src/lib/crm/routing.ts` — modes `creator` | `round_robin` | `territory` | `least_open`. Plan flag `leadRouting` required (Team/Enterprise).
- Settings on `organizations.lead_routing` jsonb (migration 012). CRM → **Routing** tab.
- `addLead`, CSV import, promote-to-lead, and `POST /api/public/leads` all go through `prepareNewLead`. Website enquiries assign to the owner on Solo, or the routing pool on Team.
- Lead detail: reassign dropdown + score factor breakdown.

### CRM automations — ✅ Runtime built (2026-08-29)
Before this, `automations` rows were config that nothing executed.
- Engine: `src/lib/automations/engine.ts` — enqueue on trigger, walk steps, park on `wait`
- Durable runs: migration `010_automation_runs.sql` (`automation_runs`, `automation_run_steps`, `leads.tags`)
- Steps implemented: `send_sms`, `send_email`, `create_task`, `wait`, `update_stage`, `add_tag`, `notify_owner`
- Templating: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{phone}}`, `{{stage}}`, `{{source}}`
- Triggers that **auto-fire**: `lead_created`, `stage_changed`, `lead_contacted` (first CRM/API outbound SMS or email only), `no_reply` (48h silence; cancelled on inbound), plus `manual` from UI.
- Routes: `/api/automations/trigger` (user bearer), `/api/automations/run-due` (org flush), `/api/automations/cron/run` (secret)
- `update_stage` deliberately does NOT re-trigger `stage_changed` — prevents workflow ping-pong
- UI: Run history + per-step detail in CRM → Automations; activity timeline in lead detail
- **Needs**: `AUTOMATION_CRON_SECRET` (or reuses `SOCIAL_CRON_SECRET`/`CRON_SECRET`) + migration 010 applied. Point cron-job.org at `/api/automations/cron/run` every few minutes (same pattern as social).
- Local workspace mode has no engine (server-side service role only) — UI says so
- **Provider decision (2026-08-29):** keep Twilio (or later Telnyx) as the messaging API. RingCentral is not cheaper and is the wrong architecture for multi-tenant CRM SMS. PK inbound stays simulated. WhatsApp is the later international path.

### Messaging — ✅ Two-way + simulated inbound (2026-08-22 / 29)
- `MESSAGING_MODE=auto|simulated|twilio` (`src/lib/messaging/capabilities.ts`)
- Shared `sendOutboundSms` / `recordInboundMessage` in `src/lib/messaging/service.ts`
- `/api/messaging/inbound` simulates a lead reply — Twilio can send to PK, cannot receive from PK; we do not need PK inbound now
- Inbound phone matching handles E.164 variants + falls back to `leads.phone`
- New leads auto-sync `lead.phone` → `lead_phone_numbers` (required for real inbound match)

### Email channel — ✅ (2026-08-29)
- `EMAIL_MODE=auto|simulated|resend` (`src/lib/email/capabilities.ts`)
- Shared `sendOutboundEmail` in `src/lib/email/service.ts` (CRM + automations)
- `/api/email/send` (Bearer auth when Supabase is on) · `/api/email/status`
- Separate SMS and email threads per lead (`conversation_threads.channel`, migration 016)
- CRM Inbox: SMS | Email composer. Live send needs `RESEND_API_KEY` + verified `EMAIL_FROM`
- Inbound: `/api/email/webhook/inbound` (Resend `email.received`, Svix `RESEND_WEBHOOK_SECRET`). Body via `GET /emails/receiving/:id`. Match Reply-To plus-tag then From email. Cancels `no_reply`. CRM simulate inbound works for email too (`channel=email`).
- Outbound sets `Reply-To` to `EMAIL_INBOUND_ADDRESS` local+`{leadId}` when that env is set.

### Twilio ↔ CRM — ✅ Code Complete
- `src/lib/twilio/client.ts` — sendTwilioSms with live/simulated fallback
- `/api/twilio/sms` — Outbound with consent check, thread creation, message logging
- `/api/twilio/webhook/inbound` — Inbound SMS handling
- `/api/twilio/webhook/status` — Delivery status callbacks
- CRM page sends SMS via session.sendSms → /api/twilio/sms
- **Needs**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

### Stripe ↔ Billing — ✅ Code Complete
- `src/lib/stripe/config.ts` — Client, price lookup, reverse lookup
- `/api/stripe/checkout` — Session creation, existing subscription swap
- `/api/stripe/portal` — Customer portal redirect
- `/api/stripe/webhook` — 6 event types, org billing patch, audit logging
- Migration 007 — billing columns on organizations
- **Needs**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`

### Social Media — ✅ Instagram publish + schedule (Hobby + cron-job.org) — Aug 2026
- Providers: Facebook, Instagram, LinkedIn, X (OAuth + publish)
- Publish engine: `publish-service.ts` (manual, cron, org flush)
- Routes: accounts, cron/publish, publish, publish-due, oauth, status, upload-media
- Storage: public bucket `social-media` (10MB); uploads via **signed URL**
- Schedule ops: cron-job.org + `X-Cron-Secret`; Vercel daily cron; Social page auto-flush
- See **Chat handoff — Social module** at top of this file for full bug log + org map

---

## Current Work In Progress

### 1. Social — smoke / harden (MOSTLY DONE — 2026-08-16)
- [x] Publish image + caption from Compose (DB + IG path verified earlier)
- [x] Queue can show `published`
- [x] Cron-job.org test: `processed:1, published:1`
- [x] Workspace identity / duplicate `tp` guidance
- [x] Video ≤10MB upload path (signed URL)
- [x] Facebook / LinkedIn live publish (2026-08-16)
- [ ] X live publish — **skipped** this cycle
- Org switcher — **skip**

### 2. Website Builder (2026-08-29)
Four live themes: Modern Minimal, Luxury Dark, Classic Agency, Coastal Living.
Visual editor + public render + lead capture + **section palette** + **CNAME/SSL verify** **done**.

### 3. CRM automations + messaging (2026-08-29)
Runtime + simulated inbound + **email send + inbound webhook** + **`lead_contacted` / `no_reply`** **done**. Hosted migrations 010–015 **applied**. Routing + scoring **done**.

### 4. Lead routing + scoring (2026-08-29)
Done. Sequence runner shipped (enroll / Send next; automations still drip).

---

## Environment Variables

All documented in `.env.example`. Key groups:
- `NEXT_PUBLIC_BRAND` — certified-uk or certified-us
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Messaging: `MESSAGING_MODE=auto|simulated|twilio`
- Email: `EMAIL_MODE=auto|simulated|resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `EMAIL_INBOUND_ADDRESS`
- Automations cron: `AUTOMATION_CRON_SECRET` (falls back to `SOCIAL_CRON_SECRET` / `CRON_SECRET`)
- Social: `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_*`, `LINKEDIN_CLIENT_*`, `X_CLIENT_*`
- Social infra: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET`, `CRON_SECRET` (same value as SOCIAL_CRON_SECRET on Vercel)

---

## Conventions

- All **app workspace** pages are client components (`"use client"`). Public `/site/[slug]` is a **server** component.
- Session state via `useAppSession()` hook from `lib/app/session.tsx`
- Toast notifications via `toast.success()` / `toast.error()` from `components/ui/toast.tsx`
- Module access checks via `hasModuleAccess(role, plan, module, level)`
- Locked modules render `<LockedModule>` component
- Loading/error via skeleton components and `<Alert>`
- Motion via `fadeUp` / `staggerContainer` from `lib/motion.ts`
- All money formatting via `formatMoney(amount, market)` from `lib/utils.ts`
- IDs generated via `newId(prefix)` from `workspace-store.ts`

---

## Latest commits (main)

- (this session) Inbound email webhook (Resend)
- `97285aa` `lead_contacted` / `no_reply` runtime + Twilio PK copy
- `da46870` LinkedIn API version `202608`
- `0da4cbc` Message sequence runner
- `53de9d1` E.164 country-code picker

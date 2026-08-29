# 0nEstate (CertifiedUK / CertifiedUS) — Project Context

> **Purpose**: This file preserves project context across model switches and chat sessions.
> **Last updated**: 2026-08-29 (automations runtime + public sites shipped)

---

## Chat handoff — NEXT: Website section palette (2026-08-29)

Use this block when starting a **new Cursor chat**. Repo: `ArslanSiddiqui75/onEstate` (`main`). Live app: https://on-estate.vercel.app

If Arslan says **"continue"** / **"next task"** with no extra detail: do the first unchecked item under **Pick up here**. Do not redo shipped work below.

### Pick up here (ordered)
1. **Operator (not code):** apply hosted Supabase migrations `010_automation_runs.sql` and `011_public_sites.sql`. Without them, automations and public sites fail at runtime. Confirm in MCP/`list_migrations` or by creating a lead + opening `/site/<slug>`.
2. **[START HERE IN CODE] Website section palette + reorder** — curated blocks, show/hide, reorder, per-block style variants. Not freeform Webflow. Keep current 4 themes until Arslan supplies new UIs.
3. Lead routing + scoring engines (`leadRouting` / `leadScoring` plan flags exist; all leads still assign to creator; score column is display-only)
4. Domain CNAME verify + SSL status productization (`/api/website/domain/verify` is still a stub)
5. Email channel (tasks/automations mention Email; no send transport)
6. Message sequence runner (seeded sequences + enrollment toggles; no scheduler — automations already cover drip)
7. Live-test Facebook / LinkedIn / X publish (IG is verified)

Out of scope for website v1: free canvas, custom HTML/CSS, full CMS / multi-page IA. Org switcher — **skip**.

### Shipped this session (do not rebuild)
- **CRM automations actually run** — `3f97ea5`. Engine `src/lib/automations/engine.ts`. Triggers: `addLead` → `lead_created`, `updateLeadStage` → `stage_changed`. `wait` steps park until `/api/automations/cron/run` or CRM page flush. `update_stage` does **not** re-fire `stage_changed`.
- **Messaging** — simulated inbound in CRM inbox (`/api/messaging/inbound`); `MESSAGING_MODE`; Twilio still cannot deliver to PK numbers.
- **Public websites + lead capture** — `5c7c5be`. `/site/[slug]`; `src/proxy.ts` rewrites custom domains; `POST /api/public/leads` creates a CRM lead and fires `lead_created` automations. Unpublished sites stay private.

### Key files for next website work
`src/app/app/website/page.tsx` · `src/components/website/website-preview.tsx` · `src/lib/website/{templates,defaults,public-site,slug}.ts` · `src/app/site/[slug]/page.tsx` · `src/app/api/public/leads/route.ts` · `WebsiteSite` in `src/types/index.ts`

### Habits
Commit + push major changes automatically (`.cursor/rules/git-auto-push.mdc`). User is **Arslan**. Verify UI in the browser when changing web app behavior.

### Portal sync foundation (2026-08-17)
Honest multi-portal sync (not fake in-memory worker):
- Connect branch ID + feed key under Listings → **Portal connections**
- **Validate & sync portals** runs all market adapters (Rightmove/Zoopla/OTM or MLS)
- Builds downloadable feed JSON; marks connected portals `synced` (export-ready)
- Live HTTP to real portals still needs commercial partner APIs
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
- [ ] **Website section palette + reorder** — see top handoff — **START HERE NEXT** (public render is done)
- [ ] Live-test Facebook / LinkedIn / X (deferred)
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

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **UI Primitives**: Radix UI
- **Auth & DB**: Supabase Auth + Postgres + RLS (optional — durable localStorage fallback)
- **SMS/Telephony**: Twilio (optional — simulated when unset)
- **Payments**: Stripe Checkout + Customer Portal (platform-owned)
- **Validation**: Zod v4
- **Icons**: Lucide React
- **Package manager**: npm

---

## Project Structure (Key Paths)

```
src/
├── app/
│   ├── page.tsx                      # Marketing landing page (~21 KB)
│   ├── admin/                        # SaaS admin console
│   │   ├── audit/ organizations/ subscriptions/ users/
│   ├── app/                          # Product workspace
│   │   ├── crm/page.tsx              # CRM module (~48 KB, 1289 lines)
│   │   ├── listings/page.tsx         # Listings module (~13.5 KB)
│   │   ├── transactions/page.tsx     # Transactions module (~12.7 KB)
│   │   ├── website/page.tsx          # Website builder (~24 KB)
│   │   ├── social/page.tsx           # Social media module
│   │   ├── billing/page.tsx          # Billing module (~9.7 KB)
│   │   ├── onboarding/page.tsx       # Tenant onboarding
│   │   ├── login/ signup/
│   ├── api/
│   │   ├── stripe/  (checkout/ portal/ webhook/)
│   │   ├── twilio/  (sms/ webhook/inbound/ webhook/status/)
│   │   ├── social/  (accounts/ cron/ oauth/ publish/ status/)
│   │   ├── waitlist/
├── components/
│   ├── ui/           # Design system (Badge, Button, Card, Input, etc.)
│   ├── crm/          # automation-builder.tsx (25 KB)
│   ├── social/       # social-planner.tsx (60 KB)
│   ├── shell/        # App shell / sidebar
│   ├── team/         # invite-modal.tsx
│   ├── brand/        # Brand switcher
│   ├── marketing/    # Landing page components
├── lib/
│   ├── app/session.tsx          # Main session provider (~36 KB, 1254 lines)
│   ├── data/
│   │   ├── repository.ts        # WorkspaceRepository interface
│   │   ├── local-repository.ts  # localStorage implementation
│   │   ├── supabase-repository.ts # Supabase implementation
│   │   ├── workspace-store.ts   # Types + localStorage helpers
│   │   ├── bootstrap.ts         # Seed data factory
│   ├── stripe/config.ts         # Stripe client + price mapping
│   ├── twilio/client.ts         # Twilio SMS client (live + simulated)
│   ├── social/
│   │   ├── providers.ts         # All 4 platform adapters (615 lines)
│   │   ├── publish-service.ts   # Publish engine + cron
│   │   ├── oauth-service.ts     # State + PKCE management
│   │   ├── crypto.ts            # Token encryption
│   │   ├── media.ts             # Platform labels/icons
│   ├── rbac/matrix.ts           # 6×6 role-module access matrix
│   ├── plans/catalog.ts         # Plan definitions + feature flags
│   ├── access.ts                # hasModuleAccess(), hasFeature()
│   ├── portals/adapters.ts      # Portal sync adapters (Rightmove, Zoopla, etc.)
│   ├── jobs/queue.ts            # Background job queue abstraction
│   ├── website/templates.ts     # [NEW] Website template definitions
├── types/index.ts               # All TypeScript types (389 lines)
supabase/migrations/             # 7 SQL migrations (001–007)
```

---

## Data Architecture

**Dual-mode persistence**: Everything works without Supabase (localStorage) and with Supabase (Postgres + RLS).

Key types:
- `WorkspaceSnapshot` — full state object (workspace-store.ts)
- `WorkspaceOrg` — org with Stripe billing fields
- `WorkspaceUser` — user with role + orgId
- `WebsiteSite` — website config (headline, tagline, domain, sections, templateId, domainStatus)
- `Lead`, `Contact`, `Listing`, `TransactionDeal` — core business objects
- `SocialAccount`, `SocialPost` — social module
- `Automation`, `AutomationStep` — CRM automation builder

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
1. **CRM & Lead Management** (~95%) — Pipeline, contacts, SMS (Twilio + simulated inbound), call logging, **automation runtime**, activity timeline. Missing: routing/scoring engines, email send, sequence scheduler
2. **Listings & Portal Sync** (~85%) — Table, search, sync buttons, portal adapters (export-ready; live APIs need partnerships)
3. **Transactions & Compliance** (~80%) — Deal cards, checklists, progress bars, e-sign indicators
4. **Social Media Tools** (~85%) — All 4 platforms with real OAuth; IG publish + schedule verified; FB/LI/X live-test deferred
5. **Billing & Subscriptions** (~90%) — Stripe Checkout, Portal, Webhooks (6 events), plan swap with proration, UI
6. **Website Builder** (~80%) — 4 themes, visual editor, public `/site/[slug]` + custom-domain proxy, contact form → CRM leads. Missing: section palette/reorder, CNAME/SSL productization

### 🔴 Major Work Remaining
- Website section palette + reorder
- Lead routing + scoring
- Domain CNAME + SSL
- Email channel
- Message sequence runner (optional — automations already drip)
- FB / LinkedIn / X live publish smoke

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

### CRM automations — ✅ Runtime built (2026-08-29)
Before this, `automations` rows were config that nothing executed.
- Engine: `src/lib/automations/engine.ts` — enqueue on trigger, walk steps, park on `wait`
- Durable runs: migration `010_automation_runs.sql` (`automation_runs`, `automation_run_steps`, `leads.tags`)
- Steps implemented: `send_sms`, `create_task`, `wait`, `update_stage`, `add_tag`, `notify_owner`
- Templating: `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{phone}}`, `{{stage}}`, `{{source}}`
- Triggers fire from `session.tsx`: `addLead` → `lead_created`, `updateLeadStage` → `stage_changed`
- Routes: `/api/automations/trigger` (user bearer), `/api/automations/run-due` (org flush), `/api/automations/cron/run` (secret)
- `update_stage` deliberately does NOT re-trigger `stage_changed` — prevents workflow ping-pong
- UI: Run history + per-step detail in CRM → Automations; activity timeline in lead detail
- **Needs**: `AUTOMATION_CRON_SECRET` (or reuses `SOCIAL_CRON_SECRET`/`CRON_SECRET`) + migration 010 applied
- Local workspace mode has no engine (server-side service role only) — UI says so

### Messaging — ✅ Two-way + simulated inbound (2026-08-22)
- `MESSAGING_MODE=auto|simulated|twilio` (`src/lib/messaging/capabilities.ts`)
- Shared `sendOutboundSms` / `recordInboundMessage` in `src/lib/messaging/service.ts`
- `/api/messaging/inbound` simulates a lead reply — Twilio can't deliver to PK numbers
- Inbound phone matching handles E.164 variants + falls back to `leads.phone`
- New leads auto-sync `lead.phone` → `lead_phone_numbers` (required for real inbound match)

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
- [ ] Facebook / LinkedIn / X live publish
- Org switcher — **skip**

### 2. Website Builder (2026-08-29)
Four live themes: Modern Minimal, Luxury Dark, Classic Agency, Coastal Living.
Visual editor + public render + lead capture **done**. Next: **section palette + reorder**.

### 3. CRM automations + messaging (2026-08-29)
Runtime + simulated inbound **done**. Operator must apply migrations 010 + 011. Next CRM work: routing/scoring.

---

## Environment Variables

All documented in `.env.example`. Key groups:
- `NEXT_PUBLIC_BRAND` — certified-uk or certified-us
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Messaging: `MESSAGING_MODE=auto|simulated|twilio`
- Automations cron: `AUTOMATION_CRON_SECRET` (falls back to `SOCIAL_CRON_SECRET` / `CRON_SECRET`)
- Social: `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_*`, `LINKEDIN_CLIENT_*`, `X_CLIENT_*`
- Social infra: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET`, `CRON_SECRET` (same value as SOCIAL_CRON_SECRET on Vercel)

---

## Conventions

- All pages are client components (`"use client"`)
- Session state via `useAppSession()` hook from `lib/app/session.tsx`
- Toast notifications via `toast.success()` / `toast.error()` from `components/ui/toast.tsx`
- Module access checks via `hasModuleAccess(role, plan, module, level)`
- Locked modules render `<LockedModule>` component
- Loading/error via skeleton components and `<Alert>`
- Motion via `fadeUp` / `staggerContainer` from `lib/motion.ts`
- All money formatting via `formatMoney(amount, market)` from `lib/utils.ts`
- IDs generated via `newId(prefix)` from `workspace-store.ts`

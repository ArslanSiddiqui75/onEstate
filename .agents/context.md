# 0nEstate (CertifiedUK / CertifiedUS) — Project Context

> **Purpose**: This file preserves project context across model switches and chat sessions.
> **Last updated**: 2026-08-16

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

### ✅ Fully Built (just need env keys to go live)
1. **CRM & Lead Management** (~90%) — Pipeline, search, pagination, scoring, contacts, SMS via Twilio, call logging, automation builder
2. **Listings & Portal Sync** (~85%) — Table, search, sync buttons, portal adapters (stubbed), job queue
3. **Transactions & Compliance** (~80%) — Deal cards, checklists, progress bars, e-sign indicators
4. **Social Media Tools** (~85%) — All 4 platforms (Facebook, Instagram, LinkedIn, X) with real OAuth, publish, refresh, cron scheduler
5. **Billing & Subscriptions** (~90%) — Stripe Checkout, Portal, Webhooks (6 events), plan swap with proration, UI

### 🔴 Major Work Remaining
6. **Website Builder** (~50% → building now):
   - ✅ Settings panel, section toggles, live preview, domain field, publish toggle
   - 🔨 IN PROGRESS: Template/theme system (8 pre-made templates)
   - 🔨 IN PROGRESS: Domain connection system (DNS verification, status tracking)
   - ❌ NOT YET: Public website rendering (server-side, multi-tenant by domain)
   - ❌ NOT YET: Custom block editor, client portal as standalone

---

## Integration Status

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

### Social Media — ✅ Instagram publish path working (Aug 2026)
- `src/lib/social/providers.ts` — Facebook, Instagram, LinkedIn, X (all 4 with real OAuth + publish)
- `src/lib/social/publish-service.ts` — Manual + scheduled cron publisher
- `/api/social/` — accounts, cron, oauth, publish, status, upload-media
- Token encryption at rest, auto-refresh
- Public `social-media` Storage bucket (10MB) for Instagram Graph URL fetches
- **Needs**: `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_*`, etc. per platform
- **Decision**: n8n/Zapier NOT needed for MVP — direct API is already built

#### Social bug hunt log (2026-08-15 → 2026-08-16)
| Symptom | Root cause | Fix | Commit / migration |
|---|---|---|---|
| Browser freeze/crash on media select or Publish | `createBrowserSupabaseClient()` created a **new client every call** → auth lock contention + memory spiral; auth listener also re-hydrated full workspace on every tab focus / token refresh | Singleton browser client; defer auth work; only hydrate when no repo yet; timeouts on `getAuthToken` + publish fetch | On `main` (included in earlier social commits / FABLE PLEASE) |
| Publish shows "Saving…" then buttons return; no IG post; **zero** `social_posts` rows | Live DB still had legacy `content NOT NULL` with **no default**; app inserts `caption` only → insert failed; Compose had **no catch** so error was silent | Migration: `content` default `''`; Compose catch + toasts; throw if workspace missing | `b308fe8` + Supabase migration `007_social_posts_schema_align` (applied live) |

**Verified in DB**: post `16d2555d-…` status `published`, caption `"hi"`, `published_at` 2026-08-15 17:50 UTC — Compose → Instagram path works.

**Still open (social)**:
- Confirm that published post visible on `@son.ion_kebab` (and any later posts)
- **Cross-browser / wrong workspace: connected IG missing in Cursor browser** (see open bugs below)
- Live-test Facebook / LinkedIn / X (same planner, different providers)
- Cron scheduled publish end-to-end (`/api/social/cron/publish` + `SOCIAL_CRON_SECRET`)
- Optional cleanup: drop unused legacy cols on `social_posts` (`content`, `scheduled_at`, `target_account_ids`, `error_message`) once confident
- Repo habit: **commit + push to GitHub after every fix** (user request)

#### Open bugs to fix
1. **Connected social accounts not visible in another browser (reported 2026-08-16)**  
   - Symptom: Cursor browser session on `on-estate.vercel.app/app/social` shows Instagram **not** connected; user’s usual browser (where OAuth was done) shows `@son.ion_kebab` connected.  
   - Likely cause: **different auth user / org**. IG lives only on org **`tp`** (`c3d7bf08-…`). DB has several orgs/profiles for “Arslan” (`tp`, another `tp`, `arshi`, `owner Realty`) — signing up or signing into a different workspace creates an empty Accounts tab.  
   - Secondary risk: `getSnapshot()` swallows `listSocialAccounts` errors and returns `[]`, so a real load failure looks identical to “not connected”.  
   - Fix direction: show current **org name** in the app shell; avoid creating duplicate orgs on re-login; surface social-account fetch errors; optional org switcher / “use existing workspace”; don’t fail silent to empty list.

2. **Upload failed (413: Server error) for ~6MB `.MOV` (reported 2026-08-16)**  
   - Symptom: Compose media upload of a 6MB MOV returns `Upload failed (413: Server error)`.  
   - Likely cause: file goes through `/api/social/upload-media` on **Vercel**, whose serverless **request body limit is ~4.5MB** — below our 10MB UI/bucket limit — so Vercel rejects before Supabase Storage.  
   - Client/bucket allow 10MB; server route `MAX_BYTES` is also 10MB, so the 413 is almost certainly the platform limit, not our check.  
   - Fix direction: **direct-to-Supabase upload** (signed URL or browser client → `social-media` bucket) so large media never hits the Next.js/Vercel body ceiling; improve error copy (“file too large for this upload path”); optionally reject MOV earlier with a clear size/format message; consider compressing or converting video client-side for Instagram Reels.

3. **Scheduled posts never auto-publish (reported 2026-08-16)**  
   - Symptom: post scheduled for 15:43 PKT stayed `scheduled` at 15:46+; nothing on Instagram. DB row `269bf703-…` correct (`scheduled_for` 10:43 UTC).  
   - Root cause: **no scheduler was hitting** `/api/social/cron/publish` — no `vercel.json` cron; Compose “Schedule” only writes the row.  
   - Fix: add `vercel.json` cron every 5 min; accept Vercel `Authorization: Bearer CRON_SECRET` as well as `SOCIAL_CRON_SECRET`. Ensure `SOCIAL_CRON_SECRET` (and ideally `CRON_SECRET`) set on Vercel. Note: **Vercel Hobby** may only allow daily crons — use Pro or an external ping (cron-job.org) for every-few-minutes.  

Key files: `src/lib/supabase/client.ts`, `src/lib/app/session.tsx`, `src/components/social/social-planner.tsx`, `src/lib/social/{media,providers,publish-service}.ts`, `src/app/api/social/upload-media/route.ts`, `src/app/api/social/cron/publish/route.ts`, `vercel.json`, `supabase/migrations/006_social.sql`, `007_social_posts_schema_align.sql`

---

## Current Work In Progress

### 1. Social — smoke / harden (IN PROGRESS — 2026-08-16)
Checklist:
- [ ] Publish image + caption from `/app/social` Compose → see toast success
- [ ] Queue shows status `published`
- [ ] Post visible on `@son.ion_kebab`
- [ ] No browser freeze; file input reusable after upload
- [ ] **Same connected accounts visible across browsers when logged into the same org** (blocked by open bug #1)
- [ ] **Video upload ≤10MB works on Vercel** (blocked by open bug #2 — 6MB MOV → 413)

Preflight (checked): IG `@son.ion_kebab` connected on org **`tp`** + secrets present; token expires ~2026-10-13; prior published row `16d2555d` (caption "hi") already in DB.

**Smoke test instruction:** use the browser where Accounts already shows connected (or sign into the **`tp`** workspace), preferably https://on-estate.vercel.app/app/social — not a fresh signup in Cursor’s browser. For media, prefer a **small JPG** until bug #2 is fixed (avoid >~4.5MB videos on Vercel).

### 2. Website Template System & Domain Connection (Aug 2026)
Building 8 pre-made templates (template picker UI, domain verification flow, DNS status tracking).

New/modified files:
- `src/lib/website/templates.ts` — [NEW] Template definitions
- `src/types/index.ts` — Added `templateId`, `domainStatus`, `domainVerifiedAt`, `sslStatus` to `WebsiteSite`
- `src/app/app/website/page.tsx` — Template picker + domain verification UI
- `src/app/api/website/domain/verify/route.ts` — [NEW] DNS verification endpoint

Public website rendering (server-side multi-tenant) is NOT built yet — that's Phase 2 of this feature.

---

## Environment Variables

All documented in `.env.example`. Key groups:
- `NEXT_PUBLIC_BRAND` — certified-uk or certified-us
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Social: `META_APP_ID`, `META_APP_SECRET`, `INSTAGRAM_APP_*`, `LINKEDIN_CLIENT_*`, `X_CLIENT_*`
- Social infra: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET`

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

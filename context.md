# 0neStreet — Agent context

> Primary handoff for coding agents. Prefer **code + `supabase/migrations/`** over Markdown when they conflict.
> Humans: open `vault/` in Obsidian. See `vault/00 Home.md`.

**Agents → this file + code. Humans → `vault/`.** Update Product / Operations / Listings notes (and this file) only when those facts change — not for UI polish, refactors, or routine schema digests.

---

## Why it exists

Multi-tenant brokerage OS: CRM, listings, deals, website, social, billing in one login. Both regions use the name **0neStreet**. `NEXT_PUBLIC_BRAND` (`onestreet-uk` | `onestreet-us`) picks the UK or US setup. Surfaces: `/` marketing, `/UK` and `/US` previews, `/app` workspace, `/admin` platform console, `/site/[slug]` public tenant sites.

Live: https://on-estate.vercel.app · Repo: `ArslanSiddiqui75/onEstate` (`main`) · Vercel project `on-estate` · Supabase `pruezuqdsofegzhbodnj`

---

## Locked decisions (do not reverse)

- **CRM is org-wide.** `assigned_to` is routing, not an access lock. No own-book isolation.
- **Accountant** keeps **view** on CRM / listings / deals (no fake “hide pipeline”).
- **No fake Stripe receipts.** Invoices stay empty until keys + a real checkout exist.
- **Stay on Twilio** for SMS (WhatsApp later for international). Do not switch to RingCentral.
- **Portal HTTP** to Rightmove/Zoopla/MLS waits on commercial partner APIs (export-only today).
- **Org switcher** — out of scope.
- Do not commit `supabase/.temp/` or unsolicited `.github/` noise unless asked.

---

## Launch / remaining client work

| Item | Status |
|---|---|
| QA ship-blockers (listings/deals persist, admin tenants, invite RBAC, session sign-out) | Done in code + hosted schema |
| Deep UI polish (sidebar, dialer, reports snapshot, etc.) | On `main` (`fe7e695`+) |
| Stripe live invoices | Ops: separate UK and US accounts (`STRIPE_SECRET_KEY_UK` / `_US`, webhook secrets, regional price ids). Webhooks: `/api/stripe/webhook/uk` and `/us` |
| Partner portal live HTTP | Blocked on commercial APIs |
| WhatsApp path | Later — do not rip out Twilio |
| X (Twitter) live publish | Skipped until paid API / asked |
| Supabase Auth redirect URLs | Dashboard only (not via MCP) |
| Website visual refresh | Wait for design inspo |

---

## How to run

```bash
cd <app-root>   # folder that contains package.json
npm install
cp .env.example .env.local   # fill required keys — never commit secrets
npm run dev                  # http://localhost:3000
npm test                     # Vitest
npm run build
```

Migrations: apply `supabase/migrations/` in order on hosted (or Supabase CLI locally). Source of truth for schema is those SQL files + `src/types/index.ts`.

---

## Env / ops (names only — see `.env.example`)

Critical groups: Supabase (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`), brand (`NEXT_PUBLIC_BRAND`), Stripe, Twilio + `MESSAGING_MODE`, Resend email, `PLATFORM_ADMIN_PASSWORD` (server-only admin login), social OAuth + `SOCIAL_TOKEN_ENCRYPTION_KEY`, cron secrets (`CRON_SECRET` / `SOCIAL_CRON_SECRET` / `AUTOMATION_CRON_SECRET` — production cron fails closed if unset).

- Vercel Hobby: platform cron is **daily** only — use cron-job.org for frequent social/automation ticks (`X-Cron-Secret`).
- Duplicate org names (e.g. several `tp`): shell shows workspace id; wrong email → empty Social accounts.
- Production app URL: `NEXT_PUBLIC_APP_URL=https://on-estate.vercel.app`

---

## Architecture pointers (code wins)

| Area | Look here |
|---|---|
| Session / mutations | `src/lib/app/session.tsx` |
| RBAC matrix | `src/lib/rbac/matrix.ts`, `src/lib/access.ts` |
| Plans | `src/lib/plans/catalog.ts` |
| Supabase repo | `src/lib/data/supabase-repository.ts` |
| CRM routing / scoring | `src/lib/crm/{routing,scoring}.ts` |
| Automations | `src/lib/automations/engine.ts` |
| Public sites | `src/lib/website/public-site.ts`, `src/proxy.ts` |
| Types | `src/types/index.ts` |
| Schema | `supabase/migrations/` |
| Tests | `src/lib/core.test.ts`, `npm test` |

Modules under `/app`: crm, listings, transactions, website, social, billing + teams, tasks, reports, documents, tickets, settings.

---

## Known caveats

- Dual persistence: Supabase when configured, else durable localStorage demo mode.
- Calls tab: `tel:` device dialer + log — **no** in-app WebRTC.
- Website publish requires active/under-offer listings; unpublished public URLs stay unavailable.
- Org + admin cookies can coexist until sign-out (sign-out clears both; overlap banner in app).
- Twilio can send to many countries; PK inbound SMS is not reliable — use CRM simulate inbound.
- Soft-archive via `archived_at` where implemented.
- Next.js 16: read `node_modules/next/dist/docs/` / `AGENTS.md` before assuming old App Router habits; `src/proxy.ts` replaces classic middleware naming.

---

## Habits

- User: **Arslan**. Commit + push major work when asked (repo has git-auto-push guidance).
- Prefer verifying UI in the browser for product behavior changes.
- Do not invent product process beyond locked decisions above.

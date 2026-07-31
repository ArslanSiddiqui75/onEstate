# 0nEstate — CertifiedUK / CertifiedUS

A unified, multi-tenant real estate operations platform built for modern estate agencies and brokerages.

---

## What Is This App?

**CertifiedUK** (UK market) and **CertifiedUS** (US market) are go-to-market brands for a single SaaS platform that unifies every operational tool a real estate agency needs into one product, one login, one data model. Instead of stitching together separate CRM, listing, compliance, website, social, and billing tools — this platform provides all six as tightly integrated modules.

The app ships as a Next.js 16 App Router application with three main surfaces:

| Route | What It Does |
|---|---|
| `/` | **Marketing site** — public landing page for the active brand (CertifiedUK or CertifiedUS) |
| `/app` | **Live product workspace** — multi-tenant operational hub where agents, brokers, and teams work |
| `/admin` | **SaaS admin console** — platform-level management of tenants, subscriptions, users, and audit logs |

---

## The Problem It Solves

Real estate agencies today face four core pain points:
1. **Fragmented stack** — CRM, listings, compliance, web, and social live in separate tools stitched together with brittle integrations.
2. **Paid add-ons everywhere** — Essentials like lead import sit behind extra fees, inflating cost and slowing onboarding.
3. **Dated UI** — Clunky interfaces slow adoption among agents and ISAs who expect consumer-grade software.
4. **Flat access control** — One-size-fits-all permissions ignore how owners, brokers, leads, and agents actually delegate work.

CertifiedUK/US addresses all four by providing a modern, role-aware, all-in-one platform with proper RBAC and market-specific configuration.

---

## Six Core Modules

The `/app` workspace is a working multi-tenant product (not a static demo). It contains six integrated modules:

### 1. CRM & Lead Management
- Configurable pipelines for buyers, sellers, landlords, and tenants
- Automated nurture and drip sequences by lead stage
- Lead routing and assignment by role and territory
- Lead scoring to prioritize follow-up
- SMS inbox, call logs, and conversation threading (Twilio-powered)
- Phone provenance tracking with consent and verification status
- Automation workflows (triggers → action steps)

### 2. Listings & Portal Sync
- Two-way portal feeds with pre-upload validation
- Bulk media management for photos, floorplans, and virtual tours
- Listing status sync across connected portals
- Error-checking to prevent rejected feeds
- **UK portals**: Rightmove, Zoopla, OnTheMarket
- **US portals**: MLS boards via brokerage credentials
- Market-specific fields (leasehold/freehold for UK, MLS disclosures for US)

### 3. Transactions & Compliance
- Configurable deal checklists by transaction type
- E-signature workflows via certified providers (UK-compliant / ESIGN-compliant)
- Deal-linked ledger and reconciliation
- Risk-level tracking and compliance status per deal
- Full audit trail on every deal action

### 4. Website Builder
- Branded sites for agents, teams, and brokerages
- Listing embeds always in sync with live inventory
- Custom domains and professional templates
- Client portal for buyers, sellers, and tenants

### 5. Social Media Tools
- Cross-platform scheduling from one calendar (Instagram, Facebook, LinkedIn, X)
- Automatic listing-to-post generation
- Branded templates matching client identity
- Performance tracking across accounts
- Real OAuth connections with platform-side publishing

### 6. Billing & Subscriptions
- Solo, Team/Brokerage, and Enterprise tiers
- Usage limits tracked and enforced per plan
- Self-serve upgrade and downgrade flows via Stripe Checkout
- Feature-gating tied directly to the RBAC matrix

---

## Role-Based Access Control (RBAC)

Every module is gated by a 6 roles × 6 modules RBAC matrix. Access is granted by role, then bounded by plan tier. Enterprise-tier ceilings:

| Module | Owner/Admin | Broker | Team Lead | Agent | Assistant/ISA | Accountant |
|---|---|---|---|---|---|---|
| **CRM & Leads** | Full | Full | Full | Full | Full | Full |
| **Listings & Portals** | Full | Full | Full | Edit | View | Full |
| **Transactions** | Full | Edit | Edit | View | — | View |
| **Website Builder** | Edit | Edit | Edit | — | — | — |
| **Social Tools** | Edit | View | View | — | Edit | — |
| **Billing & Plans** | View | — | View | — | — | Full |

This matrix is enforced both in the frontend (UI gating) and in the database via Supabase Row Level Security (RLS) policies.

---

## Multi-Market Brand System

The platform supports two markets via a single codebase, toggled by `NEXT_PUBLIC_BRAND`:

| Aspect | CertifiedUK | CertifiedUS |
|---|---|---|
| **Portals** | Rightmove, Zoopla, OnTheMarket | MLS boards |
| **Currency** | GBP with UK VAT handling | USD with US sales tax |
| **E-Signatures** | UK-compliant providers | ESIGN-compliant providers |
| **Listings** | Leasehold / freehold tenure fields | MLS disclosures auto-validated |
| **Terminology** | Estate Agent, Tenancy, Solicitor | Realtor, Lease, Closing Attorney |

Market rules are applied from backend/brand config — there is no user-facing UK/US switcher.

---

## Pricing Tiers

| Feature | Solo Agent | Team / Brokerage | Enterprise |
|---|---|---|---|
| **Seats** | 1 user | Up to 25 users | Unlimited, custom SLAs |
| **Price (GBP)** | £49/mo | £199/mo | Custom |
| **Price (USD)** | $59/mo | $249/mo | Custom |
| **CRM** | Core pipelines | Lead routing & scoring | Cross-office routing |
| **Listings** | 1 portal feed | Full two-way sync | Unlimited feeds, multi-MLS |
| **Transactions** | Checklists + e-sign | Compliance workflows | Ledger + reconciliation |
| **Website** | 1 branded site | Team site + client portal | Multi-office site network |
| **Social** | Manual scheduling | Auto listing-to-post | Brand governance controls |

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **UI Components**: Radix UI primitives
- **Auth & Database**: Supabase Auth + Postgres + Row Level Security (optional — durable browser store fallback)
- **SMS/Telephony**: Twilio (optional — simulated send when unset)
- **Payments**: Stripe Checkout + Customer Portal (platform Stripe)
- **Validation**: Zod v4
- **Icons**: Lucide React

---

## Data Persistence Modes

The app works in two modes:
1. **Without Supabase** — Data lives in a durable browser workspace store (localStorage-backed). Fully functional for demos & dev.
2. **With Supabase** — Same modules use Postgres + RLS. Apply SQL migrations in `supabase/migrations/` in order:

| Migration | Purpose |
|---|---|
| `001_phase1_rbac.sql` | Core schema: orgs, profiles, leads, listings, audit logs + RBAC RLS policies |
| `002_real_modules.sql` | Extended module tables (contacts, sequences, deals, etc.) |
| `003_platform_admin.sql` | Platform admin console tables |
| `004_contacts.sql` | Full contacts module |
| `005_automations.sql` | Automation workflow tables |
| `006_social.sql` | Social media accounts, posts, and scheduling tables |
| `007_billing.sql` | Subscription lifecycle columns + webhook plan mutation |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Marketing landing page
│   ├── admin/              # SaaS admin console
│   │   ├── audit/
│   │   ├── organizations/
│   │   ├── subscriptions/
│   │   └── users/
│   ├── app/                # Product workspace
│   │   ├── crm/            # CRM module
│   │   ├── listings/       # Listings module
│   │   ├── transactions/   # Transactions module
│   │   ├── website/        # Website builder module
│   │   ├── social/         # Social media module
│   │   ├── billing/        # Billing module
│   │   ├── login/
│   │   └── signup/
│   └── api/                # API routes (Stripe, Twilio, Social OAuth)
├── components/             # UI and feature components
├── lib/                    # Core business logic, RBAC, session, data repositories
├── types/                  # TypeScript definitions
└── supabase/migrations/    # Postgres SQL migrations (001–007)
```

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # Configure brand + optional integrations
npm run dev                   # → http://localhost:3000
```

---

## 📋 Task Tracker & Verification Status

### Phase 1: Core Product Polish
- **1.7 Error Handling & Loading States**:
  - `[x]` Create shared ErrorBoundary component with retry
  - `[x]` Create skeleton/loading components for each module
  - `[x]` Create toast notification system
  - `[x]` Add loading states to session initialization
  - `[x]` Add error states to data repository calls
- **1.2 Auth Flow Hardening**:
  - `[x]` Add form validation with Zod on login/signup
  - `[x]` Add password strength indicator on signup
  - `[x]` Add error messages for auth failures
  - `[x]` Add session expiry handling & auto-refresh
  - `[x]` Add protected route redirect logic (`src/app/app/layout.tsx` & `src/app/admin/layout.tsx`)
- **1.3 CRM Module Production-Readiness**:
  - `[x]` Add search/filter bar to leads list
  - `[x]` Add pagination for leads
  - `[x]` Replace raw error divs with toast + Alert
  - `[x]` Add success feedback on add lead / send SMS
  - `[x]` Stage labels capitalised + result count badge
  - `[x]` Fix form reset async event bug on lead submission
- **1.6 Mobile Responsive Audit**:
  - `[x]` App sidebar — collapsible on mobile
  - `[x]` CRM tables — horizontal scroll wrapper via TableShell
  - `[x]` Forms — responsive grid layouts with full-width mobile inputs
  - `[x]` Marketing page — fluid typography and responsive grids
  - `[x]` Admin console — responsive stats grid and horizontal scroll tables
- **1.1 Supabase Setup**:
  - `[x]` Dual-mode persistence engine (Durable local store fallback + Supabase client)
  - `[ ]` User action: Create Supabase project & run migrations 001–007
  - `[ ]` User action: Configure `.env.local` with Supabase keys
- **1.4 Listings Polish**:
  - `[x]` Add search bar to listings
  - `[x]` Add toast feedback for add listing / portal sync
  - `[x]` Add sync button loading state
  - `[x]` Create background job queue abstraction (`src/lib/jobs/queue.ts`)
  - `[x]` Wire portal adapters to queue (`src/lib/portals/adapters.ts`)
- **1.5 Transactions Checklist Tracking**:
  - `[x]` Add progress bar to deal cards
  - `[x]` Add deadline alerts for overdue items
  - `[x]` Toast feedback on checklist / stage updates
  - `[x]` Empty state when no deals
  - `[x]` Wire e-sign status indicators (`src/app/app/transactions/page.tsx`)

### Phase 2: Billing & Multi-Tenancy
- `[x]` Stripe live integration & Webhook handler hardening
- `[x]` Plan enforcement gates (`hasFeature`, `checkSeatLimit`, `checkPortalLimit`)
- `[x]` Tenant onboarding flow (`src/app/app/onboarding/page.tsx`)
- `[x]` Admin console data binding & override toast feedback
- `[x]` Team member invitation system (`src/components/team/invite-modal.tsx`)

### Phase 3: Integrations & Next Tasks
- `[x]` Social publishing e2e engine (`src/lib/social/publish-service.ts`)
- `[x]` Twilio live SMS with simulated fallback (`src/lib/twilio/client.ts` & `/api/twilio/sms`)
- `[x]` Portal API adapters (`src/lib/portals/adapters.ts`)
- `[ ]` Website builder enhancement (custom block editor, client portal preview, custom domain setup)


# Workflow

## Brokerage host flow (happy path)

1. Owner signs up → org created → onboarding (`/app/onboarding`).
2. Invite team (`/app/settings/members`); roles gated server-side.
3. Add or import leads → CRM pipeline; routing/scoring on Team+ plans.
4. Optional: website publish with live listings → public `/site/{slug}` → contact form → `POST /api/public/leads` → `lead_created` automations.
5. SMS/email from inbox (Twilio/Resend or simulated); calls via device `tel:` + log.
6. Listings inventory → portal feed export when credentials exist.
7. Won lead / manual deal → Transactions checklists + e-sign (`/sign/{token}`).
8. Billing via platform Stripe Checkout / Customer Portal when configured.

## Platform operator

1. `/admin/login` (server-checked `PLATFORM_ADMIN_*`).
2. Tenants, subscriptions, users, audit, tickets, impersonation (where shipped).
3. Org sign-out clears admin session and vice versa (dual cookies until then).

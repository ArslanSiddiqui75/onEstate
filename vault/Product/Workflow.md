# Workflow

## Brokerage host flow (happy path)

1. Owner signs up → org created → onboarding (`/app/onboarding`).
2. Fill Business Profile (`/app/settings/business-profile`) — trading/legal identity, language, authorised representative, email compliance footer.
3. Invite team (`/app/settings/team`); roles gated server-side.
4. Add or import leads → CRM pipeline; routing/scoring on Team+ plans.
5. Optional: website publish with live listings → public `/site/{slug}` → contact form → `POST /api/public/leads` → `lead_created` automations.
6. SMS/email from inbox (Twilio/Resend or simulated); calls via device `tel:` + log.
7. Listings inventory → portal feed export when credentials exist.
8. Won lead / manual deal → Transactions checklists + e-sign (`/sign/{token}`).
9. Billing via platform Stripe Checkout / Customer Portal when configured.

## Platform operator

1. Opaque per-role gate URLs (env `PLATFORM_ADMIN_GATE_*`, long alphanumeric), not `/admin/login`.
2. Each gate only accepts that role’s credentials (`PLATFORM_ADMIN_PASSWORD_*`); session cookie is short-lived and `__Host-` locked in production.
3. Tenants, subscriptions, users, audit, tickets, impersonation (where shipped).
4. Org sign-out clears admin session and vice versa (dual cookies until then).

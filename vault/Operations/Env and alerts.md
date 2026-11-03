# Env and alerts

**Never commit secrets.** Names and setup live in `.env.example`. Local values go in `.env.local` (gitignored). Production: Vercel project `on-estate`.

## Groups

| Group | Purpose |
|---|---|
| `NEXT_PUBLIC_BRAND` | `onestreet-uk` \| `onestreet-us` |
| Supabase | Auth + Postgres + RLS |
| Stripe | Checkout, portal, webhooks, invoices |
| Twilio + `MESSAGING_MODE` | SMS |
| Resend / email envs | CRM + automation email |
| `PLATFORM_ADMIN_PASSWORD` (+ optional role overrides) | `/admin` server login |
| Social OAuth + `SOCIAL_TOKEN_ENCRYPTION_KEY` | Social connect/publish |
| Cron secrets | Social + automation schedules; production fails closed if unset |

## Ops notes

- Set `CRON_SECRET` equal to `SOCIAL_CRON_SECRET` / `AUTOMATION_CRON_SECRET` on Vercel when using platform cron bearer.
- Hobby Vercel cron is **daily only** (`vercel.json` uses `0 0 * * *` as a safety net). Point cron-job.org (or Pro) every few minutes at `/api/social/cron/publish` and `/api/automations/cron/run` with `X-Cron-Secret` (or `Authorization: Bearer <CRON_SECRET>`). Without that, waits and scheduled social posts stall.
- Prefer header `X-Cron-Secret` over query `?secret=` (special characters break query secrets).
- E-sign stays simulated until Dropbox Sign is wired — `DROPBOX_SIGN_API_KEY` / `ESIGN_MODE=live` alone must not be marketed as live.
- Apply `supabase/migrations/20261104120000_p0_honesty_hardening.sql` on hosted (RBAC string levels, unmatched inbound, documents storage RLS, website publish gate).

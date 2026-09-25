# Env and alerts

**Never commit secrets.** Names and setup live in `.env.example`. Local values go in `.env.local` (gitignored). Production: Vercel project `on-estate`.

## Groups

| Group | Purpose |
|---|---|
| `NEXT_PUBLIC_BRAND` | `certified-uk` \| `certified-us` |
| Supabase | Auth + Postgres + RLS |
| Stripe | Checkout, portal, webhooks, invoices |
| Twilio + `MESSAGING_MODE` | SMS |
| Resend / email envs | CRM + automation email |
| `PLATFORM_ADMIN_PASSWORD` (+ optional role overrides) | `/admin` server login |
| Social OAuth + `SOCIAL_TOKEN_ENCRYPTION_KEY` | Social connect/publish |
| Cron secrets | Social + automation schedules; production fails closed if unset |

## Ops notes

- Set `CRON_SECRET` equal to `SOCIAL_CRON_SECRET` on Vercel when using platform cron bearer.
- Hobby Vercel cron is daily — use an external ping for frequent social/automation ticks.
- Prefer header `X-Cron-Secret` over query `?secret=` (special characters break query secrets).

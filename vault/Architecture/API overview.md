# API overview

> **HUMAN REFERENCE.** Routes live under `src/app/api/**`. Prefer reading the route file over expanding this note after every PR.

Rough map:

- `/api/public/leads` — website capture
- `/api/twilio/*`, `/api/email/*`, `/api/messaging/*` — messaging
- `/api/automations/*`, `/api/sequences/*` — workflows
- `/api/stripe/*` — checkout, portal, webhook, invoices
- `/api/social/*` — OAuth, publish, cron, media
- `/api/website/domain/verify` — DNS/TLS
- `/api/team/invite` — invites
- `/api/admin/*` — platform console
- `/api/esign/*` — signature flows

Auth patterns vary (Bearer org JWT, admin cookie, cron secret, Twilio signature). Check each route.

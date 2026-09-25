# External platforms

| Platform | Role | Notes |
|---|---|---|
| Vercel | Hosting + (limited) cron | Project `on-estate`; live `on-estate.vercel.app` |
| Supabase | Auth, DB, Storage, RLS | Project `pruezuqdsofegzhbodnj` |
| Stripe | Platform billing | Tenants do not bring Connect keys |
| Twilio | SMS | Signature required on webhooks in production |
| Resend | Email send/receive | Optional inbound webhook |
| Meta / LinkedIn / X | Social OAuth + publish | X needs paid API for live smoke |
| Portal partners | Listing distribution | Export-ready; live HTTP blocked on commercial access |
| Dropbox Sign (optional) | E-sign | Simulated `/sign/{token}` by default |

Respect each provider’s ToS and rate limits. Do not store API secrets in this vault — only env **names** and dashboard locations.

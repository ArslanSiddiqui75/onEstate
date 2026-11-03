# Launch Checklist

Client / ops remaining (not “more polish tickets”):

- [ ] Separate UK and US Stripe accounts: `STRIPE_SECRET_KEY_UK` / `STRIPE_SECRET_KEY_US`, matching webhook secrets, and regional price ids. Webhooks: `/api/stripe/webhook/uk` and `/api/stripe/webhook/us`
- [ ] Confirm Supabase Auth redirect URLs include production app origin
- [ ] Partner portal commercial API access (if live portal push is required)
- [ ] WhatsApp (later) — keep Twilio until then
- [ ] X publish only if paid API + explicit ask
- [ ] Website visual refresh when design direction exists
- [ ] External cron-job.org (or Pro) every few minutes for social + automation ticks + secrets set
- [ ] Apply hosted migrations through `20261104140000_sell_ready_wave_a.sql` (honesty + invite tokens + checkout intents)
- [ ] Confirm Twilio status webhook URL matches `TWILIO_WEBHOOK_BASE_URL` / app URL
- [ ] SMTP wired for Conversations; Resend only for invites/e-sign
- [ ] Refund process for orphaned Stripe signup sessions

Already done in product/code (verify on live after deploy):

- [x] Listings / deals persist; admin sees tenants
- [x] Invite RBAC server-enforced
- [x] Session isolation on sign-out
- [x] Website publish guard (needs live listings)
- [x] Deep UI pass on `main`
- [x] P0 honesty: RBAC ceilings, e-sign simulated label, DND on sequences/automations, unmatched inbound capture, documents storage RLS, agency/lettings CAS, cron schedule honesty
- [x] Wave A–C sell blockers: free invite accept, checkout intents/terms, agency Bearer + portal seeds, social partial publish, SMS statusCallback, listings cover ACL

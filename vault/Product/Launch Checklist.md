# Launch Checklist

Client / ops remaining (not “more polish tickets”):

- [ ] Stripe Production keys, price IDs, webhook → live invoices after one checkout
- [ ] Confirm Supabase Auth redirect URLs include production app origin
- [ ] Partner portal commercial API access (if live portal push is required)
- [ ] WhatsApp (later) — keep Twilio until then
- [ ] X publish only if paid API + explicit ask
- [ ] Website visual refresh when design direction exists

Already done in product/code (verify on live after deploy):

- [x] Listings / deals persist; admin sees tenants
- [x] Invite RBAC server-enforced
- [x] Session isolation on sign-out
- [x] Website publish guard (needs live listings)
- [x] Deep UI pass on `main`

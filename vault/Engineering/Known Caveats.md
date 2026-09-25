# Known Caveats

- Dual persistence (Supabase vs localStorage) — features that need service role (automations engine, some admin) are limited in pure local mode.
- Calls: device dialer only (`tel:`), not WebRTC.
- Several orgs can share the display name `tp` — use workspace id in the shell.
- Twilio: outbound to PK works; inbound from PK numbers is unreliable — use simulate inbound.
- Unpublished websites resolve as unavailable publicly.
- Org and admin sessions can both exist until someone signs out.
- Portal “sync” is export-ready, not live partner HTTP.
- Stripe invoice list is empty until real Stripe ops exist (by design).
- Next.js 16 conventions may differ from older training data — see `AGENTS.md`.

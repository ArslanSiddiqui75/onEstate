# Decisions

Locked product calls (also mirrored in repo `context.md`):

1. **CRM is org-wide** — shared office pipeline. `assigned_to` is for routing (round-robin / territory / least-open / creator), not row-level “own book.”
2. **Accountant** retains **view** on CRM, listings, and deals.
3. **No fake Stripe invoices** — UI stays honest until platform Stripe keys + checkout exist.
4. **Twilio** for SMS; WhatsApp is a later international path. Do not pivot to RingCentral for multi-tenant CRM SMS.
4b. **Multiple Twilio numbers per workspace** — owners can buy several numbers, choose From on Conversations/bulk SMS, and set one default for automations/sequences. Each number still belongs to exactly one org for inbound routing.
5. **Portal partner HTTP** (Rightmove / Zoopla / OnTheMarket / MLS) waits on commercial APIs; product can export/validate feeds meanwhile.
6. **Org switcher** — out of scope for now.
7. Website builder stays curated sections (not free canvas / arbitrary HTML CMS) for v1.

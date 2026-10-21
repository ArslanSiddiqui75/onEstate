# Security and RLS

> **HUMAN REFERENCE.** Source of truth: migrations (RLS policies), `src/lib/rbac/matrix.ts`, `src/lib/server/require-module.ts`, admin session routes.

- Org data scoped by membership; service-role used carefully on server APIs.
- UI gates via `hasModuleAccess`; DB RLS aligned to the TypeScript matrix (see `rbac_matrix_align` migration).
- Invite escalation blocked server-side (`/api/team/invite`).
- Admin passwords checked only on server (`POST /api/admin/login`); httpOnly signed cookie.
- Twilio webhooks: signature validation; cron routes fail closed in production without secrets.
- Public lead capture: honeypot + coarse rate limit.
- Do not put real passwords or keys in this vault.

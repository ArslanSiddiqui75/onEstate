# Security and RLS

> **HUMAN REFERENCE.** Source of truth: migrations (RLS policies), `src/lib/rbac/matrix.ts`, `src/lib/server/require-module.ts`, admin session routes.

- Org data scoped by membership; service-role used carefully on server APIs.
- UI gates via `hasModuleAccess`; DB RLS aligned to the TypeScript matrix (`rbac_matrix_align` + `20261104120000_p0_honesty_hardening` for string AccessLevel overrides clamped to role ceilings).
- Personal module grants cannot exceed the role matrix ceiling (none unlocks to view only).
- Invite escalation blocked server-side (`/api/team/invite`).
- Admin passwords checked only on server (`POST /api/admin/login`); httpOnly signed cookie.
- Operator lock screens use opaque single-segment gates (`PLATFORM_ADMIN_GATE_*`) rewritten in `proxy.ts`; `/admin/login` is retired; gates are `noindex` and role-locked.
- Twilio webhooks: signature validation; unmatched inbound persisted; cron routes fail closed in production without secrets.
- `documents` storage bucket: org-prefixed path RLS on `storage.objects`.
- Public lead capture: honeypot + coarse rate limit.
- Do not put real passwords or keys in this vault.

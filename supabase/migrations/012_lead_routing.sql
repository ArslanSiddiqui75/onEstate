-- Lead routing settings live on the org so website capture can assign
-- without a signed-in actor. Empty json hydrates to defaults in app code.

alter table public.organizations
  add column if not exists lead_routing jsonb not null default '{}'::jsonb;

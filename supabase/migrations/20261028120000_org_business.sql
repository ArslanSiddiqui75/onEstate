-- Public brokerage details the owner fills in under Settings → Business profile.

alter table public.organizations
  add column if not exists business jsonb not null default '{}'::jsonb;

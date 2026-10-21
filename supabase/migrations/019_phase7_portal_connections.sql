-- Phase 7: encrypted portal credentials (shared across the org, not per-browser).
-- Apply after 018_phase4_extras.sql

create table if not exists public.portal_connections (
  org_id uuid not null references public.organizations (id) on delete cascade,
  portal text not null,
  connected boolean not null default false,
  branch_id text,
  network_id text,
  api_key_ciphertext text,
  connected_at timestamptz,
  last_verified_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (org_id, portal)
);

alter table public.portal_connections enable row level security;

create policy portal_connections_read on public.portal_connections for select
  using (
    org_id = (select org_id from public.current_profile())
  );

-- Writes go through the service-role API so the raw API key is encrypted first.
revoke insert, update, delete on public.portal_connections from authenticated, anon;

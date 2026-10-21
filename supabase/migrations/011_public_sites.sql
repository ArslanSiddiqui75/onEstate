-- Public multi-tenant website rendering + inbound lead capture.
-- The builder stored everything in `websites.payload`, which can't be looked up
-- by host. These columns are the public routing keys.
-- Apply after 010_automation_runs.sql

alter table public.websites
  add column if not exists slug text,
  add column if not exists custom_domain text,
  add column if not exists published boolean not null default false;

-- Backfill routing keys from payloads written before this migration.
update public.websites
set
  slug = coalesce(
    slug,
    nullif(regexp_replace(lower(coalesce(payload->>'headline', '')), '[^a-z0-9]+', '-', 'g'), '-'),
    left(org_id::text, 8)
  ),
  custom_domain = coalesce(custom_domain, nullif(lower(payload->>'customDomain'), '')),
  published = coalesce(published, (payload->>'published')::boolean, false)
where slug is null or custom_domain is null;

create unique index if not exists websites_slug_key
  on public.websites (slug)
  where slug is not null;

create unique index if not exists websites_custom_domain_key
  on public.websites (custom_domain)
  where custom_domain is not null;

-- Leads captured by a public form have no authenticated actor, so the capture
-- route runs as the service role. Track where each one came from.
alter table public.leads
  add column if not exists capture_source text;

create table if not exists public.lead_capture_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  -- website | portal | api
  channel text not null default 'website',
  slug text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  -- coarse abuse signal only; not used for targeting
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists lead_capture_events_org_idx
  on public.lead_capture_events (org_id, created_at desc);

alter table public.lead_capture_events enable row level security;

create policy lead_capture_events_read on public.lead_capture_events for select
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

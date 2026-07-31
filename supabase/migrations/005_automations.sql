-- Automations: customizable CRM workflows (trigger + ordered action steps).
-- Apply after 004_contacts.sql

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  trigger text not null default 'manual',
  trigger_stage text,
  status text not null default 'draft',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automations_org_id_idx on public.automations (org_id);

alter table public.automations enable row level security;

create policy automations_all on public.automations for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

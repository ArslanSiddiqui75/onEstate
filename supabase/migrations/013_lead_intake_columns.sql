-- Hosted DB never got these lead columns from 002 (tables existed, ALTER did not).
-- Add-lead was posting next_action / territory / priority and PostgREST rejected the insert.

alter table public.leads
  add column if not exists next_action text,
  add column if not exists next_action_due_at timestamptz,
  add column if not exists territory text,
  add column if not exists priority text default 'medium';

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  activity_type text not null,
  body text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lead_activities enable row level security;

drop policy if exists lead_activities_all on public.lead_activities;
create policy lead_activities_all on public.lead_activities for all
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  )
  with check (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'edit')
  );

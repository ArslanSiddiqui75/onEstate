-- Automation runtime: durable runs so trigger-based workflows actually execute.
-- Before this, `automations` stored config that nothing ever ran.
-- Apply after 009_websites.sql

-- add_tag steps need somewhere to write; contacts already have tags.
alter table public.leads
  add column if not exists tags jsonb not null default '[]'::jsonb;

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid not null references public.automations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  trigger text not null,
  -- pending → running → waiting (delay) → completed | failed | cancelled
  status text not null default 'pending',
  step_index int not null default 0,
  -- engine skips runs until now() >= run_after (implements `wait` steps)
  run_after timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  step_index int not null,
  step_type text not null,
  label text,
  status text not null default 'completed',
  detail text,
  executed_at timestamptz not null default now()
);

create index if not exists automation_runs_org_idx on public.automation_runs (org_id);
create index if not exists automation_runs_lead_idx on public.automation_runs (lead_id);
-- the engine's hot path: claim due work
create index if not exists automation_runs_due_idx
  on public.automation_runs (status, run_after);
create index if not exists automation_run_steps_run_idx
  on public.automation_run_steps (run_id);

alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;

-- Tenants read their own run history; only the service role (engine) writes.
create policy automation_runs_read on public.automation_runs for select
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

create policy automation_run_steps_read on public.automation_run_steps for select
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

-- Sequence runner. Hosted never received 002's sequence tables, so this
-- creates them (and is a no-op add-column if they already exist locally).
-- No scheduler: enroll / Send next advances one step. Automations still drip.

create table if not exists public.message_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  kind text not null default 'custom',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sequence_id uuid not null references public.message_sequences (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null default 'active',
  follow_up boolean not null default true,
  nurture boolean not null default false,
  current_step int not null default 0,
  last_ran_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sequence_id, lead_id)
);

alter table public.message_sequences
  add column if not exists kind text not null default 'custom';

alter table public.sequence_enrollments
  add column if not exists current_step int not null default 0,
  add column if not exists last_ran_at timestamptz;

create unique index if not exists message_sequences_org_kind_uidx
  on public.message_sequences (org_id, kind)
  where kind in ('follow_up', 'nurture');

alter table public.message_sequences enable row level security;
alter table public.sequence_enrollments enable row level security;

drop policy if exists sequences_all on public.message_sequences;
create policy sequences_all on public.message_sequences for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

drop policy if exists enrollments_all on public.sequence_enrollments;
create policy enrollments_all on public.sequence_enrollments for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

grant select, insert, update, delete on public.message_sequences to authenticated, service_role;
grant select, insert, update, delete on public.sequence_enrollments to authenticated, service_role;

-- Real modules: CRM phones/tasks, messaging, listings ops, transactions
-- Apply after 001_phase1_rbac.sql

-- Extend leads
alter table public.leads
  add column if not exists next_action text,
  add column if not exists next_action_due_at timestamptz,
  add column if not exists territory text,
  add column if not exists priority text default 'medium';

create table if not exists public.lead_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null default 'Primary',
  number text not null,
  source text not null default 'manual',
  consent text not null default 'unknown',
  verification text not null default 'unverified',
  preferred boolean not null default false,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  channel text not null default 'SMS',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

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

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  phone_number_id uuid references public.lead_phone_numbers (id) on delete set null,
  previous_status text,
  new_status text not null,
  source text not null,
  created_at timestamptz not null default now()
);

-- Listings ops
alter table public.listings
  add column if not exists sync_readiness int default 0,
  add column if not exists last_sync_at timestamptz,
  add column if not exists next_milestone text,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.listing_portal_syncs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  portal text not null,
  status text not null default 'not_connected',
  last_synced_at timestamptz,
  unique (listing_id, portal)
);

create table if not exists public.listing_compliance_issues (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  issue text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  stage text not null default 'Instruction',
  e_sign_status text not null default 'not_started',
  market public.market not null,
  value numeric not null default 0,
  currency text not null,
  coordinator text,
  target_close_date timestamptz,
  risk_level text default 'medium',
  ledger_status text default 'not_started',
  compliance_status text default 'on_track',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_parties (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  party_role text,
  sort_order int not null default 0
);

create table if not exists public.transaction_checklist_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  provider text,
  status text not null default 'draft',
  external_id text,
  created_at timestamptz not null default now()
);

-- Communications / Twilio
create table if not exists public.messaging_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'twilio',
  account_sid text,
  from_number text,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  unique (org_id)
);

create table if not exists public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  phone_number text not null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, lead_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  direction text not null,
  body text not null,
  status text not null default 'queued',
  provider_sid text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  direction text not null default 'outbound',
  phone_number text not null,
  outcome text not null default 'logged',
  notes text,
  duration_seconds int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.message_sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
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
  created_at timestamptz not null default now(),
  unique (sequence_id, lead_id)
);

-- Provisioning helper: create org + profile from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  meta_name text;
  meta_org text;
  meta_plan public.plan_id;
  meta_market public.market;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
  meta_plan := coalesce((new.raw_user_meta_data->>'plan')::public.plan_id, 'solo');
  meta_market := coalesce((new.raw_user_meta_data->>'market')::public.market, 'uk');

  insert into public.organizations (name, market, plan)
  values (meta_org, meta_market, meta_plan)
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (new.id, new_org_id, meta_name, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS for new tables
alter table public.lead_phone_numbers enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.lead_activities enable row level security;
alter table public.consent_events enable row level security;
alter table public.listing_portal_syncs enable row level security;
alter table public.listing_compliance_issues enable row level security;
alter table public.listing_media enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_parties enable row level security;
alter table public.transaction_checklist_items enable row level security;
alter table public.transaction_documents enable row level security;
alter table public.messaging_accounts enable row level security;
alter table public.conversation_threads enable row level security;
alter table public.messages enable row level security;
alter table public.call_logs enable row level security;
alter table public.message_sequences enable row level security;
alter table public.sequence_enrollments enable row level security;

create policy lead_phones_all on public.lead_phone_numbers for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy lead_tasks_all on public.lead_tasks for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy lead_activities_all on public.lead_activities for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy consent_all on public.consent_events for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy listing_syncs_all on public.listing_portal_syncs for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'edit'));

create policy listing_issues_all on public.listing_compliance_issues for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'edit'));

create policy listing_media_all on public.listing_media for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('listings', 'edit'));

create policy transactions_all on public.transactions for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'edit'));

create policy tx_parties_all on public.transaction_parties for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'edit'));

create policy tx_checklist_all on public.transaction_checklist_items for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'edit'));

create policy tx_docs_all on public.transaction_documents for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('transactions', 'edit'));

create policy messaging_accounts_all on public.messaging_accounts for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy threads_all on public.conversation_threads for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy messages_all on public.messages for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy call_logs_all on public.call_logs for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy sequences_all on public.message_sequences for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy enrollments_all on public.sequence_enrollments for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy profiles_update on public.profiles
  for update using (org_id = (select org_id from public.current_profile()));

create policy org_update on public.organizations
  for update using (id = (select org_id from public.current_profile()));

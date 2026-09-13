-- Schema reconciliation for hosted drift (QA audit P0-1, P0-2, P0-3, P1-4).
-- Hosted was provisioned from an older cut of 002/003/007; this brings it in
-- line with what the application actually reads and writes. Idempotent.

-- 1. Listings: columns the client always sends (P0-1: insert 400 PGRST204).
alter table public.listings
  add column if not exists sync_readiness int default 0,
  add column if not exists last_sync_at timestamptz,
  add column if not exists next_milestone text,
  add column if not exists updated_at timestamptz default now();

-- 2. Transactions: hosted has the old shape (title/commission_estimated);
--    the app inserts these columns (P0-2: deal create silently fails).
alter table public.transactions
  add column if not exists listing_title text not null default '',
  add column if not exists e_sign_status text not null default 'not_started',
  add column if not exists market public.market not null default 'uk',
  add column if not exists currency text not null default 'GBP',
  add column if not exists coordinator text,
  add column if not exists target_close_date timestamptz,
  add column if not exists risk_level text default 'medium',
  add column if not exists ledger_status text default 'not_started',
  add column if not exists compliance_status text default 'on_track',
  add column if not exists notes text;

-- The hosted table also carries a legacy not-null "title" column the app never
-- writes; give it a default so inserts of the new shape succeed.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'title'
  ) then
    alter table public.transactions alter column title set default '';
  end if;
end $$;

-- Child tables: the app writes org_id (RLS scoping) and party_role;
-- hosted tables predate those columns.
alter table public.transaction_parties
  add column if not exists org_id uuid references public.organizations (id) on delete cascade,
  add column if not exists party_role text;

alter table public.transaction_checklist_items
  add column if not exists org_id uuid references public.organizations (id) on delete cascade;

update public.transaction_parties tp
set org_id = t.org_id
from public.transactions t
where tp.transaction_id = t.id and tp.org_id is null;

update public.transaction_checklist_items tc
set org_id = t.org_id
from public.transactions t
where tc.transaction_id = t.id and tc.org_id is null;

-- 3. call_logs: missing entirely on hosted (P1-4: Log call no-op).
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

alter table public.call_logs enable row level security;

drop policy if exists call_logs_all on public.call_logs;
create policy call_logs_all on public.call_logs for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

-- 4. Platform operator tables from 003 (P0-3: admin console reads these).
--    Service-role access only; RLS enabled with no policies.
create table if not exists public.platform_tenants (
  id uuid primary key references public.organizations (id) on delete cascade,
  lifecycle_status text not null default 'trialing',
  owner_name text not null,
  owner_email text not null,
  billing_email text not null,
  health_score int not null default 70,
  tags text[] not null default '{}',
  internal_notes text not null default '',
  source text not null default 'signup',
  website_published boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  plan public.plan_id not null,
  status text not null default 'trialing',
  interval text not null default 'month',
  currency text not null,
  unit_amount numeric not null default 0,
  mrr numeric not null default 0,
  seats_included int not null default 1,
  seats_used int not null default 1,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  collection_method text not null default 'charge_automatically',
  last_payment_status text not null default 'none',
  last_payment_at timestamptz,
  next_invoice_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  metadata jsonb default '{}'::jsonb
);

alter table public.platform_tenants enable row level security;
alter table public.platform_subscriptions enable row level security;
alter table public.platform_audit_events enable row level security;

-- 5. Organizations: columns the admin loader selects (P0-3: the select 400s
--    when any column is missing, which zeroed the whole registry).
alter table public.organizations
  add column if not exists trial_ends_at timestamptz,
  add column if not exists last_payment_status text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists onboarding_completed boolean not null default false;

-- Existing active workspaces have finished onboarding by definition.
update public.organizations
set onboarding_completed = true
where subscription_status = 'active';

-- Billing columns stay service-role-only (mirrors 007_billing.sql).
revoke update (
  trial_ends_at,
  last_payment_status,
  last_payment_at
) on public.organizations from authenticated, anon;

-- 6. Backfill platform_subscriptions from live organizations so the admin
--    console reflects existing tenants (Stripe webhook keeps it fresh).
insert into public.platform_subscriptions (
  org_id, plan, status, currency, unit_amount, mrr,
  seats_included, seats_used,
  stripe_customer_id, stripe_subscription_id, stripe_price_id,
  current_period_end, cancel_at_period_end
)
select
  o.id,
  o.plan,
  coalesce(o.subscription_status, 'trialing'),
  case when o.market = 'uk' then 'GBP' else 'USD' end,
  case o.plan when 'solo' then 79 when 'team' then 199 else 499 end,
  case when coalesce(o.subscription_status, '') = 'active'
       then case o.plan when 'solo' then 79 when 'team' then 199 else 499 end
       else 0 end,
  case o.plan when 'solo' then 1 when 'team' then 25 else 100 end,
  greatest((select count(*) from public.profiles p where p.org_id = o.id), 1),
  o.stripe_customer_id,
  o.stripe_subscription_id,
  o.stripe_price_id,
  o.current_period_end,
  coalesce(o.cancel_at_period_end, false)
from public.organizations o
on conflict (org_id) do nothing;

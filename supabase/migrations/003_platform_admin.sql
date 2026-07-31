-- Platform SaaS admin schema (apply after 002_real_modules.sql)
-- Operator tables for multi-tenant subscription management.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('super_admin', 'billing_admin', 'support_admin')),
  created_at timestamptz not null default now()
);

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

alter table public.platform_admins enable row level security;
alter table public.platform_tenants enable row level security;
alter table public.platform_subscriptions enable row level security;
alter table public.platform_audit_events enable row level security;

-- Platform admins are managed via service role / restricted policies.
-- Application should use SUPABASE_SERVICE_ROLE_KEY for admin console server routes.

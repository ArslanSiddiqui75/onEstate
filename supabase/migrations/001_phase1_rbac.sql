-- ClassifiedX Phase-1 schema with RBAC-aligned RLS
-- Apply in Supabase SQL editor when credentials are configured.

create extension if not exists "pgcrypto";

create type public.market as enum ('uk', 'us');
create type public.app_role as enum (
  'owner', 'broker', 'team_lead', 'agent', 'assistant', 'accountant'
);
create type public.plan_id as enum ('solo', 'team', 'enterprise');
create type public.access_level as enum ('full', 'edit', 'view', 'none');
create type public.module_id as enum (
  'crm', 'listings', 'transactions', 'website', 'social', 'billing'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market public.market not null default 'uk',
  plan public.plan_id not null default 'solo',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'agent',
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  lead_type text not null,
  stage text not null default 'new',
  score int not null default 0,
  assigned_to uuid references public.profiles (id),
  market public.market not null,
  source text,
  budget numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  address text not null,
  city text not null,
  market public.market not null,
  status text not null default 'draft',
  price numeric not null,
  currency text not null,
  beds int not null default 0,
  baths int not null default 0,
  sqft int not null default 0,
  tenure text,
  mls_disclosure_complete boolean default false,
  agent_id uuid references public.profiles (id),
  image_url text,
  description text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.has_module_access(
  required_module public.module_id,
  required_level public.access_level
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.app_role;
  level public.access_level;
  rank_required int;
  rank_actual int;
begin
  select role into r from public.profiles where id = auth.uid();
  if r is null then
    return false;
  end if;

  level := case
    when required_module = 'crm' then 'full'
    when required_module = 'listings' then
      case r
        when 'agent' then 'edit'
        when 'assistant' then 'view'
        else 'full'
      end
    when required_module = 'billing' then
      case r
        when 'owner' then 'view'
        when 'team_lead' then 'view'
        when 'accountant' then 'full'
        else 'none'
      end
    when required_module = 'transactions' then
      case r
        when 'owner' then 'full'
        when 'broker' then 'edit'
        when 'team_lead' then 'edit'
        when 'agent' then 'view'
        when 'accountant' then 'view'
        else 'none'
      end
    when required_module = 'website' then
      case r
        when 'owner' then 'edit'
        when 'broker' then 'edit'
        when 'team_lead' then 'edit'
        else 'none'
      end
    when required_module = 'social' then
      case r
        when 'owner' then 'edit'
        when 'broker' then 'view'
        when 'team_lead' then 'view'
        when 'assistant' then 'edit'
        else 'none'
      end
    else 'none'
  end;

  rank_required := case required_level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;
  rank_actual := case level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;

  return rank_actual >= rank_required;
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.listings enable row level security;
alter table public.audit_logs enable row level security;

create policy org_select on public.organizations
  for select using (
    id = (select org_id from public.current_profile())
  );

create policy profiles_select on public.profiles
  for select using (
    org_id = (select org_id from public.current_profile())
  );

create policy leads_all on public.leads
  for all using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  )
  with check (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'edit')
  );

create policy listings_all on public.listings
  for all using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('listings', 'view')
  )
  with check (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('listings', 'edit')
  );

create policy audit_select on public.audit_logs
  for select using (
    org_id = (select org_id from public.current_profile())
  );

create policy audit_insert on public.audit_logs
  for insert with check (
    org_id = (select org_id from public.current_profile())
  );

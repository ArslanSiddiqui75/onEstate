-- Phase 4: team invites, waitlist persistence, invite-aware signup trigger.
-- Apply after 017_esign_and_lead_listing.sql

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  name text not null,
  role public.app_role not null default 'agent',
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists team_invites_email_idx
  on public.team_invites (lower(email), status);

alter table public.team_invites enable row level security;

create policy team_invites_read on public.team_invites for select
  using (
    org_id = (select org_id from public.current_profile())
  );

create table if not exists public.waitlist_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  brokerage text,
  market text not null,
  brand text,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_submissions_created_idx
  on public.waitlist_submissions (created_at desc);

alter table public.waitlist_submissions enable row level security;
-- Inserts only via service role (API route). No client policies.

-- When a user signs up with a pending team invite, join that org instead of creating a new one.
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
  invite record;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
  meta_plan := coalesce((new.raw_user_meta_data->>'plan')::public.plan_id, 'solo');
  meta_market := coalesce((new.raw_user_meta_data->>'market')::public.market, 'uk');

  select * into invite
  from public.team_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite is not null then
    insert into public.profiles (id, org_id, full_name, role)
    values (new.id, invite.org_id, coalesce(nullif(trim(invite.name), ''), meta_name), invite.role);

    update public.team_invites
    set status = 'accepted'
    where id = invite.id;

    return new;
  end if;

  insert into public.organizations (name, market, plan)
  values (meta_org, meta_market, meta_plan)
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (new.id, new_org_id, meta_name, 'owner');

  return new;
end;
$$;

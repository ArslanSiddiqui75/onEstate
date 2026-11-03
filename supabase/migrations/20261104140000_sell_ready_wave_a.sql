-- Wave A: invite tokens, terms audit, durable signup checkout intents, re-invite.

-- Invite token for free join (no Checkout).
alter table public.team_invites
  add column if not exists token text;

update public.team_invites
set token = encode(gen_random_bytes(24), 'hex')
where token is null or token = '';

alter table public.team_invites
  alter column token set not null;

create unique index if not exists team_invites_token_uidx
  on public.team_invites (token);

-- Allow re-invite after accepted/revoked: pending email unique per org only.
alter table public.team_invites drop constraint if exists team_invites_org_id_email_key;
create unique index if not exists team_invites_pending_email_uidx
  on public.team_invites (org_id, lower(email))
  where status = 'pending';

-- Terms acceptance on the profile.
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists accepted_terms_version text;

-- Durable Stripe signup intents (survive abandoned browsers / invite collisions).
create table if not exists public.signup_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  email text not null,
  org_name text not null,
  plan text not null check (plan in ('solo', 'team', 'enterprise')),
  market text not null check (market in ('uk', 'us')),
  accept_terms boolean not null default false,
  status text not null default 'open'
    check (status in ('open', 'paid', 'attached', 'abandoned')),
  stripe_customer_id text,
  stripe_subscription_id text,
  attached_org_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists signup_checkout_intents_email_idx
  on public.signup_checkout_intents (lower(email), status);

alter table public.signup_checkout_intents enable row level security;
-- Service-role only (no authenticated policies).

-- Join invites + stamp terms from signup metadata.
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
  meta_market public.market;
  meta_terms text;
  invite record;
  terms_at timestamptz;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
  meta_market := coalesce((new.raw_user_meta_data->>'market')::public.market, 'uk');
  meta_terms := new.raw_user_meta_data->>'accepted_terms_at';
  if meta_terms is not null and length(trim(meta_terms)) > 0 then
    begin
      terms_at := meta_terms::timestamptz;
    exception when others then
      terms_at := now();
    end;
  else
    terms_at := null;
  end if;

  select * into invite
  from public.team_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite is not null then
    insert into public.profiles (id, org_id, full_name, role, accepted_terms_at, accepted_terms_version)
    values (
      new.id,
      invite.org_id,
      coalesce(nullif(trim(invite.name), ''), meta_name),
      invite.role,
      terms_at,
      case when terms_at is not null then coalesce(new.raw_user_meta_data->>'accepted_terms_version', '2026-11-04') else null end
    );

    update public.team_invites
    set status = 'accepted'
    where id = invite.id;

    return new;
  end if;

  insert into public.organizations (name, market, plan)
  values (meta_org, meta_market, 'solo')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role, accepted_terms_at, accepted_terms_version)
  values (
    new.id,
    new_org_id,
    meta_name,
    'owner',
    terms_at,
    case when terms_at is not null then coalesce(new.raw_user_meta_data->>'accepted_terms_version', '2026-11-04') else null end
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';

-- Wave E: unmatched inbound triage fields + profile email for member dedupe.

alter table public.unmatched_inbound_messages
  add column if not exists needs_opt_out boolean not null default false,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null,
  add column if not exists linked_lead_id uuid references public.leads (id) on delete set null;

create index if not exists unmatched_inbound_open_idx
  on public.unmatched_inbound_messages (org_id, created_at desc)
  where resolved_at is null;

-- Store email on profiles so workspace member lists can dedupe invites.
alter table public.profiles
  add column if not exists email text;

create index if not exists profiles_org_email_idx
  on public.profiles (org_id, lower(email))
  where email is not null and email <> '';

-- Backfill from auth when available (service role / migration context).
update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '')
  and u.email is not null;

-- Preserve Wave A invite + terms behaviour; also stamp profiles.email.
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
    insert into public.profiles (id, org_id, full_name, role, email, accepted_terms_at, accepted_terms_version)
    values (
      new.id,
      invite.org_id,
      coalesce(nullif(trim(invite.name), ''), meta_name),
      invite.role,
      lower(new.email),
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

  insert into public.profiles (id, org_id, full_name, role, email, accepted_terms_at, accepted_terms_version)
  values (
    new.id,
    new_org_id,
    meta_name,
    'owner',
    lower(new.email),
    terms_at,
    case when terms_at is not null then coalesce(new.raw_user_meta_data->>'accepted_terms_version', '2026-11-04') else null end
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';

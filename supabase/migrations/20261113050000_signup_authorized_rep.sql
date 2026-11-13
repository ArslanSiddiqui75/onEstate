-- The person who creates the workspace is the authorised representative.
-- Signup already collects their name, email, and phone. Store those on the
-- profile and in organizations.business so Business Profile opens filled in.

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
  meta_plan public.plan_id;
  meta_terms text;
  meta_phone text;
  meta_first text;
  meta_last text;
  invite record;
  terms_at timestamptz;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
  meta_market := coalesce((new.raw_user_meta_data->>'market')::public.market, 'uk');
  meta_phone := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  meta_first := split_part(trim(meta_name), ' ', 1);
  meta_last := nullif(trim(substring(trim(meta_name) from char_length(meta_first) + 1)), '');
  begin
    meta_plan := coalesce((new.raw_user_meta_data->>'plan')::public.plan_id, 'solo');
  exception when others then
    meta_plan := 'solo';
  end;
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
    insert into public.profiles (id, org_id, full_name, role, email, phone, accepted_terms_at, accepted_terms_version)
    values (
      new.id,
      invite.org_id,
      coalesce(nullif(trim(invite.name), ''), meta_name),
      invite.role,
      lower(new.email),
      meta_phone,
      terms_at,
      case when terms_at is not null then coalesce(new.raw_user_meta_data->>'accepted_terms_version', '2026-11-04') else null end
    );

    update public.team_invites
    set status = 'accepted'
    where id = invite.id;

    return new;
  end if;

  insert into public.organizations (name, market, plan, business)
  values (
    meta_org,
    meta_market,
    meta_plan,
    jsonb_build_object(
      'authorizedRep', jsonb_build_object(
        'firstName', meta_first,
        'lastName', coalesce(meta_last, ''),
        'email', lower(new.email),
        'phone', coalesce(meta_phone, ''),
        'jobPosition', 'owner'
      )
    )
  )
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role, email, phone, accepted_terms_at, accepted_terms_version)
  values (
    new.id,
    new_org_id,
    meta_name,
    'owner',
    lower(new.email),
    meta_phone,
    terms_at,
    case when terms_at is not null then coalesce(new.raw_user_meta_data->>'accepted_terms_version', '2026-11-04') else null end
  );

  return new;
end;
$$;

update public.profiles p
set phone = nullif(trim(u.raw_user_meta_data->>'phone'), '')
from auth.users u
where p.id = u.id
  and (p.phone is null or btrim(p.phone) = '')
  and nullif(trim(u.raw_user_meta_data->>'phone'), '') is not null;

update public.organizations o
set business = coalesce(o.business, '{}'::jsonb) || jsonb_build_object(
  'authorizedRep', jsonb_build_object(
    'firstName', split_part(btrim(p.full_name), ' ', 1),
    'lastName', coalesce(
      nullif(btrim(substring(btrim(p.full_name) from char_length(split_part(btrim(p.full_name), ' ', 1)) + 1)), ''),
      ''
    ),
    'email', lower(coalesce(nullif(p.email, ''), u.email, '')),
    'phone', coalesce(nullif(btrim(p.phone), ''), nullif(btrim(u.raw_user_meta_data->>'phone'), ''), ''),
    'jobPosition', 'owner'
  )
)
from public.profiles p
join auth.users u on u.id = p.id
where p.org_id = o.id
  and p.role = 'owner'
  and coalesce(o.business #>> '{authorizedRep,firstName}', '') = ''
  and coalesce(o.business #>> '{authorizedRep,lastName}', '') = ''
  and coalesce(o.business #>> '{authorizedRep,email}', '') = ''
  and coalesce(o.business #>> '{authorizedRep,phone}', '') = ''
  and coalesce(o.business #>> '{authorizedRep,jobPosition}', '') = '';

notify pgrst, 'reload schema';

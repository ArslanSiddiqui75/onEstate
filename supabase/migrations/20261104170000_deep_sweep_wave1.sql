-- Deep sweep wave 1: stamp owner signup plan from metadata (not always solo).

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
  invite record;
  terms_at timestamptz;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
  meta_market := coalesce((new.raw_user_meta_data->>'market')::public.market, 'uk');
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
  values (meta_org, meta_market, meta_plan)
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

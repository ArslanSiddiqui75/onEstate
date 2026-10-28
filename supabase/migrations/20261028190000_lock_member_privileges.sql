-- Members must not be able to promote themselves, rewrite another person's
-- access, or change brokerage settings the product reserves for the owner.
-- Service-role routes (team, Stripe, lead routing) bypass these grants.

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and org_id = (select org_id from public.current_profile())
    and role = (select role from public.current_profile())
  );

revoke update (role, org_id, module_access) on public.profiles from authenticated, anon;

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update
  using (
    id = (select org_id from public.current_profile())
    and (select role from public.current_profile()) = 'owner'
  )
  with check (
    id = (select org_id from public.current_profile())
    and (select role from public.current_profile()) = 'owner'
  );

drop policy if exists tx_docs_all on public.transaction_documents;
create policy tx_docs_all on public.transaction_documents
  for all
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('transactions', 'view')
  )
  with check (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('transactions', 'edit')
  );

revoke select (sign_token), update (sign_token)
  on public.transaction_documents from authenticated, anon;

-- A public signup must not pick a paid plan. Checkout attaches the plan
-- after Stripe confirms payment.
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
  invite record;
begin
  meta_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  meta_org := coalesce(new.raw_user_meta_data->>'org_name', meta_name || ' Realty');
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
  values (meta_org, meta_market, 'solo')
  returning id into new_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (new.id, new_org_id, meta_name, 'owner');

  return new;
end;
$$;

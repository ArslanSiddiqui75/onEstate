-- Column-level REVOKEs do not undo a table-level GRANT, and Supabase grants
-- the authenticated role full access to new public tables. These guards hold
-- whatever the grants are, so members cannot rewrite their own access, the
-- billing state of their workspace, or another team's sign tokens.

create or replace function public.is_privileged_caller()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin');
$$;

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  k text;
begin
  if public.is_privileged_caller() then
    return new;
  end if;
  foreach k in array array['role', 'org_id', 'module_access'] loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception 'Role, workspace and module access can only be changed by the team settings'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.guard_organization_billing()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  k text;
begin
  if public.is_privileged_caller() then
    return new;
  end if;
  foreach k in array array[
    'plan', 'stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id',
    'subscription_status', 'current_period_end', 'cancel_at_period_end',
    'trial_ends_at', 'last_payment_status', 'last_payment_at'
  ] loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception 'Billing fields are managed by checkout and cannot be edited directly'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists guard_organization_billing on public.organizations;
create trigger guard_organization_billing
  before update on public.organizations
  for each row execute function public.guard_organization_billing();

-- Sign tokens are the only secret on a signature request. Only the service
-- role reads them, so members get column access to everything else.
do $$
declare
  cols text;
begin
  if to_regclass('public.transaction_documents') is null then
    return;
  end if;
  select string_agg(format('%I', column_name), ', ')
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'transaction_documents'
    and column_name <> 'sign_token';
  execute 'revoke select on public.transaction_documents from authenticated, anon';
  execute format('grant select (%s) on public.transaction_documents to authenticated', cols);
end $$;

-- A `for all` policy checks WITH CHECK on writes but only USING on deletes,
-- so a view-only role could delete rows. Require edit access for deletes on
-- every table that uses the view/edit split.
do $$
declare
  r record;
  module_id text;
  policy_name text;
begin
  for r in
    select distinct tablename, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and qual ~ 'has_module_access\(''[a-z_]+''[^)]*''view'''
  loop
    module_id := substring(r.qual from 'has_module_access\(''([a-z_]+)''');
    policy_name := left(r.tablename, 40) || '_delete_needs_edit';
    execute format('drop policy if exists %I on public.%I', policy_name, r.tablename);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.has_module_access(%L, %L))',
      policy_name, r.tablename, module_id, 'edit'
    );
  end loop;
end $$;

-- Slugs are URL segments. A dotted slug could shadow a connected custom domain.
alter table public.websites
  drop constraint if exists websites_slug_format;
alter table public.websites
  add constraint websites_slug_format check (slug ~ '^[^.[:space:]/]{1,80}$') not valid;

-- One workspace per phone number, so inbound texts always route to one place.
do $$
begin
  create unique index if not exists organizations_phone_number_uidx
    on public.organizations (phone_number)
    where phone_number is not null and phone_number <> '';
exception when unique_violation then
  raise notice 'Skipped organizations_phone_number_uidx: duplicate phone numbers already exist';
end $$;

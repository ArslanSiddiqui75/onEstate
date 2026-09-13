-- Align has_module_access() with src/lib/rbac/matrix.ts (QA re-audit N1).
-- Also block published websites that have no listings (P2-8 server-side).

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

  level := case required_module
    when 'crm' then
      case r
        when 'accountant' then 'view'
        else 'full'
      end
    when 'listings' then
      case r
        when 'owner' then 'full'
        when 'broker' then 'full'
        when 'team_lead' then 'full'
        when 'agent' then 'edit'
        when 'assistant' then 'view'
        when 'accountant' then 'view'
        else 'none'
      end
    when 'transactions' then
      case r
        when 'owner' then 'full'
        when 'broker' then 'edit'
        when 'team_lead' then 'edit'
        when 'agent' then 'view'
        when 'accountant' then 'view'
        else 'none'
      end
    when 'website' then
      case r
        when 'owner' then 'edit'
        when 'broker' then 'edit'
        when 'team_lead' then 'edit'
        else 'none'
      end
    when 'social' then
      case r
        when 'owner' then 'edit'
        when 'broker' then 'view'
        when 'team_lead' then 'view'
        else 'none'
      end
    when 'billing' then
      case r
        when 'owner' then 'view'
        when 'team_lead' then 'view'
        when 'accountant' then 'full'
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

create or replace function public.enforce_website_has_listings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published is true then
    if not exists (
      select 1 from public.listings where org_id = new.org_id
    ) then
      raise exception 'Cannot publish a website with no listings';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists websites_require_listings on public.websites;
create trigger websites_require_listings
  before insert or update of published on public.websites
  for each row
  execute function public.enforce_website_has_listings();

-- Personal module overrides, and team leads no longer see billing.
-- False removes a module. True grants view when the role has none.
-- The owner role ignores overrides so the workspace cannot be locked out.

alter table public.profiles
  add column if not exists module_access jsonb not null default '{}'::jsonb;

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
  grants jsonb;
  override text;
  level public.access_level;
  rank_required int;
  rank_actual int;
begin
  select role, coalesce(module_access, '{}'::jsonb)
    into r, grants
  from public.profiles
  where id = auth.uid();

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
        when 'accountant' then 'full'
        else 'none'
      end
    else 'none'
  end;

  if r is distinct from 'owner' then
    override := grants ->> required_module::text;
    if override = 'false' then
      level := 'none';
    elsif override = 'true' and level = 'none' then
      level := 'view';
    end if;
  end if;

  rank_required := case required_level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;
  rank_actual := case level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;

  return rank_actual >= rank_required;
end;
$$;

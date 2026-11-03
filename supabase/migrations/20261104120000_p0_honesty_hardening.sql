-- P0 honesty / safety hardening:
-- 1) has_module_access understands string AccessLevel overrides + role ceilings
-- 2) unmatched Twilio inbound capture
-- 3) documents storage.objects RLS (org-prefixed paths)
-- 4) website publish gate counts only active / under_offer (non-archived)

-- ---------------------------------------------------------------------------
-- 1. RBAC: string levels + clamp to role ceiling (parity with src/lib/access.ts)
-- ---------------------------------------------------------------------------
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
  role_ceiling public.access_level;
  requested public.access_level;
  rank_required int;
  rank_actual int;
  rank_ceiling int;
  rank_requested int;
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

  role_ceiling := level;

  if r is distinct from 'owner' then
    override := grants ->> required_module::text;
    if override = 'false' or override = 'none' then
      level := 'none';
    elsif override = 'true' then
      if level = 'none' then
        level := 'view';
      end if;
    elsif override in ('view', 'edit', 'full') then
      requested := override::public.access_level;
      rank_ceiling := case role_ceiling
        when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;
      rank_requested := case requested
        when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;
      if role_ceiling = 'none' then
        -- Unlock from none is capped at view (legacy boolean true).
        level := 'view';
      elsif rank_requested <= rank_ceiling then
        level := requested;
      else
        level := role_ceiling;
      end if;
    end if;
  end if;

  rank_required := case required_level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;
  rank_actual := case level
    when 'none' then 0 when 'view' then 1 when 'edit' then 2 else 3 end;

  return rank_actual >= rank_required;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Unmatched Twilio inbound (no silent drop)
-- ---------------------------------------------------------------------------
create table if not exists public.unmatched_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  org_candidates uuid[] not null default '{}',
  from_phone text not null,
  to_phone text,
  body text not null,
  provider_sid text,
  source text not null default 'twilio',
  created_at timestamptz not null default now()
);

create index if not exists unmatched_inbound_org_idx
  on public.unmatched_inbound_messages (org_id, created_at desc);

create index if not exists unmatched_inbound_created_idx
  on public.unmatched_inbound_messages (created_at desc);

create unique index if not exists unmatched_inbound_sid_uidx
  on public.unmatched_inbound_messages (provider_sid)
  where provider_sid is not null and provider_sid <> '';

alter table public.unmatched_inbound_messages enable row level security;

drop policy if exists unmatched_inbound_select on public.unmatched_inbound_messages;
create policy unmatched_inbound_select on public.unmatched_inbound_messages
  for select using (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Writes are service-role only (Twilio webhook).
revoke insert, update, delete on public.unmatched_inbound_messages from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Documents bucket storage RLS (org-prefixed object names)
-- ---------------------------------------------------------------------------
drop policy if exists "Documents org member read" on storage.objects;
create policy "Documents org member read" on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select org_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Documents org member insert" on storage.objects;
create policy "Documents org member insert" on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select org_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Documents org member update" on storage.objects;
create policy "Documents org member update" on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select org_id::text from public.profiles where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select org_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Documents org member delete" on storage.objects;
create policy "Documents org member delete" on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (
      select org_id::text from public.profiles where id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Website publish: require an active or under_offer non-archived listing
-- ---------------------------------------------------------------------------
create or replace function public.enforce_website_has_listings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published is true then
    if not exists (
      select 1 from public.listings
      where org_id = new.org_id
        and archived_at is null
        and status in ('active', 'under_offer')
    ) then
      raise exception 'Cannot publish a website with no active listings';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

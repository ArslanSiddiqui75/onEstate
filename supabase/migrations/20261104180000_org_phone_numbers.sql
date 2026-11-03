-- Multiple Twilio numbers per workspace. organizations.phone_number stays the
-- default sender (synced) for automations/sequences and older clients.

create table if not exists public.organization_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  phone_number text not null,
  label text not null default '',
  is_default boolean not null default false,
  twilio_sid text,
  created_at timestamptz not null default now(),
  constraint organization_phone_numbers_e164 check (phone_number ~ '^\+[1-9]\d{7,14}$')
);

create unique index if not exists organization_phone_numbers_number_uidx
  on public.organization_phone_numbers (phone_number);

create unique index if not exists organization_phone_numbers_one_default_uidx
  on public.organization_phone_numbers (org_id)
  where is_default;

create index if not exists organization_phone_numbers_org_id_idx
  on public.organization_phone_numbers (org_id);

alter table public.organization_phone_numbers enable row level security;

drop policy if exists org_phone_numbers_select on public.organization_phone_numbers;
create policy org_phone_numbers_select on public.organization_phone_numbers
  for select
  using (org_id = (select org_id from public.profiles where id = auth.uid()));

-- Writes go through service-role API routes (owner buy / set-default).

-- Backfill from the legacy single column.
insert into public.organization_phone_numbers (org_id, phone_number, is_default)
select id, phone_number, true
from public.organizations
where phone_number is not null
  and phone_number <> ''
  and phone_number ~ '^\+[1-9]\d{7,14}$'
on conflict (phone_number) do nothing;

-- Per-account Do Not Disturb for contacts.
-- Scoped to (profile_id, contact_id): only the signed-in user is blocked from
-- messaging that contact. Agency-wide SMS consent/opt-out stays on phone rows.

create table if not exists public.contact_user_dnd (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, contact_id)
);

create index if not exists contact_user_dnd_profile_idx
  on public.contact_user_dnd (profile_id);

create index if not exists contact_user_dnd_org_idx
  on public.contact_user_dnd (org_id);

create index if not exists contact_user_dnd_contact_idx
  on public.contact_user_dnd (contact_id);

alter table public.contact_user_dnd enable row level security;

-- Each member only manages their own DND list inside the org.
create policy contact_user_dnd_select on public.contact_user_dnd
  for select
  using (
    profile_id = auth.uid()
    and org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

create policy contact_user_dnd_insert on public.contact_user_dnd
  for insert
  with check (
    profile_id = auth.uid()
    and org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

create policy contact_user_dnd_delete on public.contact_user_dnd
  for delete
  using (
    profile_id = auth.uid()
    and org_id = (select org_id from public.current_profile())
    and public.has_module_access('crm', 'view')
  );

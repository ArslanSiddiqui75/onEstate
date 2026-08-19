-- Public website builder settings, one row per organisation.

create table if not exists public.websites (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.websites enable row level security;

drop policy if exists websites_all on public.websites;
create policy websites_all on public.websites for all
  using (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('website', 'view')
  )
  with check (
    org_id = (select org_id from public.current_profile())
    and public.has_module_access('website', 'edit')
  );

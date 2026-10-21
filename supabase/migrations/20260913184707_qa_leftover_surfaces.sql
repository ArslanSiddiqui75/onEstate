-- Soft-archive, teams (groups only), org documents, support tickets.

alter table public.leads add column if not exists archived_at timestamptz;
alter table public.listings add column if not exists archived_at timestamptz;
alter table public.transactions add column if not exists archived_at timestamptz;

create index if not exists leads_org_active_idx
  on public.leads (org_id) where archived_at is null;
create index if not exists listings_org_active_idx
  on public.listings (org_id) where archived_at is null;
create index if not exists transactions_org_active_idx
  on public.transactions (org_id) where archived_at is null;

create or replace function public.enforce_website_has_listings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.published is true then
    if not exists (
      select 1 from public.listings
      where org_id = new.org_id and archived_at is null
    ) then
      raise exception 'Cannot publish a website with no listings';
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create index if not exists teams_org_idx on public.teams (org_id);
create index if not exists team_members_profile_idx on public.team_members (profile_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
  for all using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'broker', 'team_lead')
    )
  )
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'broker', 'team_lead')
    )
  );

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select using (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.org_id = t.org_id
      where t.id = team_id and p.id = auth.uid()
    )
  );

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members
  for all using (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.org_id = t.org_id
      where t.id = team_id
        and p.id = auth.uid()
        and p.role in ('owner', 'broker', 'team_lead')
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      join public.profiles p on p.org_id = t.org_id
      where t.id = team_id
        and p.id = auth.uid()
        and p.role in ('owner', 'broker', 'team_lead')
    )
  );

create table if not exists public.org_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  path text not null,
  kind text not null default 'upload',
  mime_type text,
  lead_id uuid references public.leads (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  deal_id uuid references public.transactions (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists org_documents_org_idx on public.org_documents (org_id);

alter table public.org_documents enable row level security;

drop policy if exists org_documents_select on public.org_documents;
create policy org_documents_select on public.org_documents
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists org_documents_write on public.org_documents;
create policy org_documents_write on public.org_documents
  for all using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  )
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id),
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_email text not null,
  author_kind text not null check (author_kind in ('org', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_org_idx on public.support_tickets (org_id);
create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
  );

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select on public.support_ticket_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
      join public.profiles p on p.org_id = t.org_id
      where t.id = ticket_id and p.id = auth.uid()
    )
  );

drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert on public.support_ticket_messages
  for insert with check (
    exists (
      select 1 from public.support_tickets t
      join public.profiles p on p.org_id = t.org_id
      where t.id = ticket_id and p.id = auth.uid()
    )
  );

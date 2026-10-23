-- Support desk: who took a ticket, who resolved it, and the timestamps
-- the admin console uses for first response, time to resolve, and handle time.
-- Apply this in the Supabase SQL editor. A deploy does not run it on its own.

alter table public.support_tickets
  add column if not exists requester_email text,
  add column if not exists requester_name text,
  add column if not exists assignee_email text,
  add column if not exists assigned_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists first_response_by text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by text;

update public.support_tickets t
set requester_email = m.author_email
from (
  select distinct on (ticket_id) ticket_id, author_email
  from public.support_ticket_messages
  where author_kind = 'org'
  order by ticket_id, created_at asc
) m
where t.id = m.ticket_id
  and t.requester_email is null;

update public.support_tickets t
set
  first_response_at = m.created_at,
  first_response_by = m.author_email
from (
  select distinct on (ticket_id) ticket_id, author_email, created_at
  from public.support_ticket_messages
  where author_kind = 'admin'
  order by ticket_id, created_at asc
) m
where t.id = m.ticket_id
  and t.first_response_at is null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'support_ticket_messages'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%author_kind%'
  loop
    execute format(
      'alter table public.support_ticket_messages drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.support_ticket_messages
  add constraint support_ticket_messages_author_kind_check
  check (author_kind in ('org', 'admin', 'internal'));

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  kind text not null,
  actor_email text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_idx
  on public.support_ticket_events (ticket_id, created_at);

create index if not exists support_tickets_status_idx
  on public.support_tickets (status, updated_at desc);

create index if not exists support_tickets_assignee_idx
  on public.support_tickets (assignee_email);

alter table public.support_ticket_events enable row level security;

-- Internal notes stay off the workspace. Service role bypasses these policies.
drop policy if exists support_ticket_messages_select on public.support_ticket_messages;
create policy support_ticket_messages_select on public.support_ticket_messages
  for select using (
    author_kind <> 'internal'
    and exists (
      select 1 from public.support_tickets t
      join public.profiles p on p.org_id = t.org_id
      where t.id = ticket_id and p.id = auth.uid()
    )
  );

drop policy if exists support_ticket_messages_insert on public.support_ticket_messages;
create policy support_ticket_messages_insert on public.support_ticket_messages
  for insert with check (
    author_kind = 'org'
    and exists (
      select 1 from public.support_tickets t
      join public.profiles p on p.org_id = t.org_id
      where t.id = ticket_id and p.id = auth.uid()
    )
  );

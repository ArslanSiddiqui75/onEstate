-- Durable office books for diary/booking/client portals and the landlord desk.
-- Public links resolve through the token indexes; the full book lives in jsonb so
-- the existing client models stay unchanged.

create table if not exists public.agency_books (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  booking_token text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint agency_books_booking_token_format
    check (booking_token ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$')
);

create unique index if not exists agency_books_booking_token_uidx
  on public.agency_books (lower(booking_token));

create table if not exists public.agency_link_tokens (
  token text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('booking', 'portal')),
  created_at timestamptz not null default now(),
  constraint agency_link_tokens_token_format
    check (token ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$')
);

create index if not exists agency_link_tokens_org_idx
  on public.agency_link_tokens (org_id);

create table if not exists public.lettings_books (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lettings_report_tokens (
  token text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  property_id text not null,
  created_at timestamptz not null default now(),
  constraint lettings_report_tokens_token_format
    check (token ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$')
);

create index if not exists lettings_report_tokens_org_idx
  on public.lettings_report_tokens (org_id);

alter table public.agency_books enable row level security;
alter table public.agency_link_tokens enable row level security;
alter table public.lettings_books enable row level security;
alter table public.lettings_report_tokens enable row level security;

-- Members never write these tables from the browser; the app uses the service role.
drop policy if exists agency_books_select on public.agency_books;
create policy agency_books_select on public.agency_books
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists lettings_books_select on public.lettings_books;
create policy lettings_books_select on public.lettings_books
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

create table if not exists public.lettings_repair_refs (
  reference text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  repair_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists lettings_repair_refs_org_idx
  on public.lettings_repair_refs (org_id);

create table if not exists public.lettings_inspection_refs (
  inspection_id text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.lettings_repair_refs enable row level security;
alter table public.lettings_inspection_refs enable row level security;

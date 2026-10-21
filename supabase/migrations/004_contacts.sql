-- Contacts: CRM-wide address book, separate from the sales-pipeline Leads table.
-- Apply after 003_platform_admin.sql

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  category text not null default 'other',
  tags jsonb not null default '[]'::jsonb,
  notes text,
  lead_id uuid references public.leads (id) on delete set null,
  assigned_to uuid references public.profiles (id),
  market public.market not null,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null default 'Primary',
  number text not null,
  source text not null default 'manual',
  consent text not null default 'unknown',
  verification text not null default 'unverified',
  preferred boolean not null default false,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contacts_org_id_idx on public.contacts (org_id);
create index if not exists contacts_lead_id_idx on public.contacts (lead_id);
create index if not exists contact_phone_numbers_contact_id_idx on public.contact_phone_numbers (contact_id);

alter table public.contacts enable row level security;
alter table public.contact_phone_numbers enable row level security;

create policy contacts_all on public.contacts for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

create policy contact_phones_all on public.contact_phone_numbers for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('crm', 'edit'));

-- E-sign documents + optional lead↔listing link.
-- Hosted never got transaction_documents from an older 002 cut, so create it here.

create table if not exists public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  provider text,
  status text not null default 'draft',
  external_id text,
  signer_name text,
  signer_email text,
  sign_token text,
  summary text,
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transaction_documents
  add column if not exists signer_name text,
  add column if not exists signer_email text,
  add column if not exists sign_token text,
  add column if not exists summary text,
  add column if not exists sent_at timestamptz,
  add column if not exists signed_at timestamptz;

create unique index if not exists transaction_documents_sign_token_uidx
  on public.transaction_documents (sign_token)
  where sign_token is not null;

alter table public.transaction_documents enable row level security;

drop policy if exists tx_docs_all on public.transaction_documents;
create policy tx_docs_all on public.transaction_documents for all
  using (org_id = (select org_id from public.profiles where id = auth.uid()))
  with check (org_id = (select org_id from public.profiles where id = auth.uid()));

alter table public.leads
  add column if not exists listing_id uuid references public.listings (id) on delete set null;

create index if not exists leads_listing_id_idx
  on public.leads (org_id, listing_id)
  where listing_id is not null;

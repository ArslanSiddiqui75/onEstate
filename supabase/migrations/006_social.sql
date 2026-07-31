-- Social scheduling: real OAuth-connected accounts, encrypted tokens, and posts.
-- Apply after 005_automations.sql

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin', 'x')),
  display_name text not null,
  handle text,
  avatar_url text,
  external_account_id text not null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'expired')),
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz,
  connected_by uuid references public.profiles (id),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, platform, external_account_id)
);

-- Access/refresh tokens live in a separate table with NO row-level security
-- policies at all, so only the service-role key (used exclusively by the
-- /api/social/* server routes) can ever read or write a token. The browser
-- client only ever sees `social_accounts`, never this table.
create table if not exists public.social_account_secrets (
  account_id uuid primary key references public.social_accounts (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Short-lived CSRF state for the OAuth redirect round-trip. Also service-role
-- only; rows are deleted as soon as the callback consumes them.
create table if not exists public.social_oauth_states (
  state text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id),
  platform text not null,
  return_to text not null,
  code_verifier text,
  created_at timestamptz not null default now()
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  account_ids jsonb not null default '[]'::jsonb,
  caption text not null default '',
  media jsonb not null default '[]'::jsonb,
  link_url text,
  listing_id uuid references public.listings (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  last_error text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_accounts_org_id_idx on public.social_accounts (org_id);
create index if not exists social_posts_org_id_idx on public.social_posts (org_id);
create index if not exists social_posts_due_idx on public.social_posts (status, scheduled_for);
create index if not exists social_oauth_states_created_at_idx on public.social_oauth_states (created_at);

alter table public.social_accounts enable row level security;
alter table public.social_account_secrets enable row level security;
alter table public.social_oauth_states enable row level security;
alter table public.social_posts enable row level security;

-- Org members can see their connected accounts, but never write them from the
-- browser: connecting/disconnecting always goes through server routes using
-- SUPABASE_SERVICE_ROLE_KEY, because that's the only place OAuth client
-- secrets and access tokens may be used.
create policy social_accounts_select on public.social_accounts for select
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'view'));

create policy social_posts_all on public.social_posts for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'edit'));

-- Deliberately no policies on social_account_secrets or social_oauth_states:
-- row level security with zero policies means anon/authenticated roles get
-- zero rows, and only the service role (which bypasses RLS) can touch them.

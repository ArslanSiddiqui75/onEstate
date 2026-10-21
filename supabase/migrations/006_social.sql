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
  updated_at timestamptz not null default now()
);

-- Ensure all columns exist in case the table was created by a previous partial script
alter table public.social_accounts
  add column if not exists org_id uuid references public.organizations (id) on delete cascade,
  add column if not exists platform text,
  add column if not exists display_name text,
  add column if not exists handle text,
  add column if not exists avatar_url text,
  add column if not exists external_account_id text,
  add column if not exists status text default 'connected',
  add column if not exists scopes jsonb default '[]'::jsonb,
  add column if not exists connected_at timestamptz,
  add column if not exists connected_by uuid references public.profiles (id),
  add column if not exists last_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Handle any legacy NOT NULL columns (e.g. account_name, account_id) from earlier schemas
do $$
declare
  col text;
begin
  for col in 
    select column_name 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'social_accounts'
      and is_nullable = 'NO'
      and column_name not in ('id', 'org_id', 'platform', 'display_name', 'external_account_id', 'status', 'scopes', 'created_at', 'updated_at')
  loop
    execute format('alter table public.social_accounts alter column %I drop not null;', col);
  end loop;
end $$;

-- Ensure unique index on org_id + platform + external_account_id for upserts
create unique index if not exists social_accounts_org_platform_ext_idx
  on public.social_accounts (org_id, platform, external_account_id);

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

alter table public.social_account_secrets
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz default now();

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

alter table public.social_oauth_states
  add column if not exists org_id uuid references public.organizations (id) on delete cascade,
  add column if not exists user_id uuid references public.profiles (id),
  add column if not exists platform text,
  add column if not exists return_to text,
  add column if not exists code_verifier text,
  add column if not exists created_at timestamptz default now();

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

alter table public.social_posts
  add column if not exists org_id uuid references public.organizations (id) on delete cascade,
  add column if not exists account_ids jsonb default '[]'::jsonb,
  add column if not exists caption text default '',
  add column if not exists media jsonb default '[]'::jsonb,
  add column if not exists link_url text,
  add column if not exists listing_id uuid references public.listings (id) on delete set null,
  add column if not exists status text default 'draft',
  add column if not exists scheduled_for timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_by uuid references public.profiles (id),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

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
drop policy if exists social_accounts_select on public.social_accounts;
create policy social_accounts_select on public.social_accounts for select
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'view'));

drop policy if exists social_posts_all on public.social_posts;
create policy social_posts_all on public.social_posts for all
  using (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'view'))
  with check (org_id = (select org_id from public.current_profile()) and public.has_module_access('social', 'edit'));

-- Storage bucket for social media uploads (public so platform APIs can fetch image/video URLs)
insert into storage.buckets (id, name, public, file_size_limit)
values ('social-media', 'social-media', true, 10485760)
on conflict (id) do update set public = true;

drop policy if exists "Social media public read" on storage.objects;
create policy "Social media public read" on storage.objects for select
  using (bucket_id = 'social-media');

-- Notify PostgREST to immediately refresh its schema cache
notify pgrst, 'reload schema';


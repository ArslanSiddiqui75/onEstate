-- Platform-wide operator settings (service role only). Used for role-based
-- maintenance mode and similar switches that are not tenant-scoped.

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.platform_settings enable row level security;

-- No policies for anon/authenticated — only the service role reads/writes.

insert into public.platform_settings (key, value)
values (
  'role_maintenance',
  jsonb_build_object(
    'enabled', false,
    'roles', '[]'::jsonb,
    'updatedAt', now()
  )
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';

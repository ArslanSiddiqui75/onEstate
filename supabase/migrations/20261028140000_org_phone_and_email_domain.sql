-- Number bought for the brokerage, and the sending domain connected with DNS.

alter table public.organizations
  add column if not exists phone_number text,
  add column if not exists email_domain jsonb not null default '{}'::jsonb;

-- Real-time Stripe billing: subscription lifecycle fields on organizations,
-- plus column-level locks so tenants can never grant themselves a plan for
-- free — only the Stripe webhook (service role) may write these columns.

alter table public.organizations
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists last_payment_status text,
  add column if not exists last_payment_at timestamptz;

-- org_update (001_phase1_rbac.sql) lets any org member update their own
-- organization row (name, market, etc). Billing fields must only ever be
-- written by the Stripe webhook / checkout route, which use the service
-- role and therefore bypass both RLS and these grants.
revoke update (
  plan,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  subscription_status,
  current_period_end,
  cancel_at_period_end,
  trial_ends_at,
  last_payment_status,
  last_payment_at
) on public.organizations from authenticated, anon;

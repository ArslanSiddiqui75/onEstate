-- TCPA (US) / PECR (UK) messaging compliance: email consent, audit events,
-- and org-level SMS/email suspension when opt-outs spike.

alter table public.leads
  add column if not exists email_consent text not null default 'unknown';

alter table public.organizations
  add column if not exists messaging_compliance jsonb not null default '{}'::jsonb;

alter table public.consent_events
  add column if not exists channel text not null default 'sms';

alter table public.consent_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists consent_events_org_created_idx
  on public.consent_events (org_id, created_at desc);

create index if not exists consent_events_org_channel_status_idx
  on public.consent_events (org_id, channel, new_status, created_at desc);

comment on column public.organizations.messaging_compliance is
  'Workspace SMS/email suspension state for high opt-out rates (TCPA/PECR guardrail).';

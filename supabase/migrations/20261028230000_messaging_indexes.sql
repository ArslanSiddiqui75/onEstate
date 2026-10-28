-- Lookup paths used by Twilio status callbacks, thread views and CRM lead lists.
create index if not exists messages_provider_sid_idx
  on public.messages (provider_sid)
  where provider_sid is not null;

create index if not exists messages_thread_sent_idx
  on public.messages (thread_id, sent_at desc);

create index if not exists messages_lead_idx
  on public.messages (lead_id);

create index if not exists call_logs_org_created_idx
  on public.call_logs (org_id, created_at desc);

-- Email sits on the same conversation thread as SMS. Channel + subject
-- distinguish a mail from a text; older rows stay SMS.

alter table public.messages
  add column if not exists channel text not null default 'sms',
  add column if not exists subject text;

alter table public.conversation_threads
  add column if not exists email text;

create index if not exists messages_channel_idx
  on public.messages (org_id, channel, sent_at desc);

-- SMS and email are separate threads per lead. Messages.channel already
-- distinguishes the channel; this stops email replies attaching to the SMS row.

alter table public.conversation_threads
  add column if not exists channel text not null default 'sms';

alter table public.conversation_threads
  drop constraint if exists conversation_threads_org_id_lead_id_key;

create unique index if not exists conversation_threads_org_lead_channel_uidx
  on public.conversation_threads (org_id, lead_id, channel);

insert into public.conversation_threads (
  org_id,
  lead_id,
  phone_number,
  email,
  last_message_at,
  channel
)
select
  m.org_id,
  m.lead_id,
  '',
  max(t.email),
  max(m.sent_at),
  'email'
from public.messages m
left join public.conversation_threads t
  on t.org_id = m.org_id
 and t.lead_id = m.lead_id
 and t.channel = 'sms'
where coalesce(m.channel, 'sms') = 'email'
group by m.org_id, m.lead_id
on conflict (org_id, lead_id, channel) do nothing;

update public.messages m
set thread_id = e.id
from public.conversation_threads e
where coalesce(m.channel, 'sms') = 'email'
  and e.org_id = m.org_id
  and e.lead_id = m.lead_id
  and e.channel = 'email';

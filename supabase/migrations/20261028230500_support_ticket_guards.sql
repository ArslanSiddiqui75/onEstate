-- Customers reach support tickets through the server (service role). If they
-- ever write to these tables directly, they may only change a ticket's priority
-- and only add messages as the customer, never as staff or as an internal note.

create or replace function public.guard_support_ticket_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_caller() then
    return new;
  end if;
  if (to_jsonb(new) - 'priority' - 'updated_at')
     is distinct from (to_jsonb(old) - 'priority' - 'updated_at') then
    raise exception 'Support tickets can only be updated through the support desk'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_support_ticket_update on public.support_tickets;
create trigger guard_support_ticket_update
  before update on public.support_tickets
  for each row execute function public.guard_support_ticket_update();

create or replace function public.guard_support_ticket_message_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_privileged_caller() then
    return new;
  end if;
  if new.author_kind is distinct from 'org' then
    raise exception 'Customers can only post customer messages'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_support_ticket_message_insert on public.support_ticket_messages;
create trigger guard_support_ticket_message_insert
  before insert on public.support_ticket_messages
  for each row execute function public.guard_support_ticket_message_insert();

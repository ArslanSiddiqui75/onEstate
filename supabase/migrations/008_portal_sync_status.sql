-- Portal sync foundation: richer per-listing sync status.
-- Live Rightmove/Zoopla/MLS HTTP still requires commercial partner credentials;
-- connections are stored client-side for branch IDs until a partner feed is wired.

alter table public.listing_portal_syncs
  add column if not exists last_error text,
  add column if not exists last_message text;

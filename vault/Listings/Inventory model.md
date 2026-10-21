# Inventory model

Listings are the brokerage inventory entity (`listings` table / `Listing` type).

## Lifecycle (product)

Typical statuses include draft → active → under offer → sold/let (exact enums in `src/types/index.ts`).

Public websites only surface **active** / **under-offer** listings (capped). Publish requires at least one such listing.

## Portals

- UK: Rightmove, Zoopla, OnTheMarket (brand config).
- US: MLS via brokerage credentials.
- Connections persist per org (`portal_connections`); credentials encrypted server-side.
- Sync today: validate + feed JSON export. Live partner HTTP is waiting on commercial APIs.

## Related

Deals (`transactions`) link to a listing. Leads may optionally set `listingId`. Soft-archive uses `archived_at` where implemented.

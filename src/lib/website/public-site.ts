import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { normalizeHost } from "@/lib/website/slug";
import type { Listing, Market, WebsiteSite } from "@/types";

export interface PublicSite {
  orgId: string;
  orgName: string;
  market: Market;
  slug: string;
  site: WebsiteSite;
  listings: Listing[];
}

function mapPublicListing(row: Record<string, any>): Listing {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    address: String(row.address || ""),
    city: String(row.city || ""),
    market: row.market as Market,
    status: row.status,
    price: Number(row.price || 0),
    currency: row.currency || "GBP",
    beds: Number(row.beds || 0),
    baths: Number(row.baths || 0),
    sqft: Number(row.sqft || 0),
    agentId: String(row.agent_id || ""),
    portals: [],
    imageUrl: String(row.image_url || ""),
    description: String(row.description || ""),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

/**
 * Resolve a published tenant site from a slug or a custom domain.
 * Runs as the service role: public visitors have no Supabase session, and the
 * `websites` RLS policy is scoped to members of the owning org.
 */
export async function getPublicSite(
  slugOrHost: string,
): Promise<PublicSite | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;

  const candidate = slugOrHost.trim();
  if (!candidate) return null;
  const host = normalizeHost(candidate);

  const { data: rows } = await supabase
    .from("websites")
    .select("org_id, payload, slug, custom_domain, published, updated_at")
    .or(`slug.eq.${candidate},custom_domain.eq.${host}`)
    .limit(1);

  const row = rows?.[0];
  // Unpublished sites stay private even if someone guesses the slug.
  if (!row || !row.published) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, market")
    .eq("id", row.org_id)
    .maybeSingle();
  if (!org) return null;

  const market = (org.market as Market) || "uk";
  const payload = (row.payload || {}) as Partial<WebsiteSite>;

  const site: WebsiteSite = {
    id: String(row.org_id),
    orgId: String(row.org_id),
    headline: payload.headline || String(org.name || ""),
    tagline: payload.tagline || "",
    primaryCta: payload.primaryCta || "Book a valuation",
    phone: payload.phone || "",
    email: payload.email || "",
    published: true,
    updatedAt: String(row.updated_at || new Date().toISOString()),
    ...payload,
  };

  // Only live inventory belongs on a public site.
  const { data: listingRows } = await supabase
    .from("listings")
    .select("*")
    .eq("org_id", row.org_id)
    .in("status", ["active", "under_offer"])
    .order("created_at", { ascending: false })
    .limit(12);

  return {
    orgId: String(row.org_id),
    orgName: String(org.name || ""),
    market,
    slug: String(row.slug || candidate),
    site,
    listings: (listingRows || []).map(mapPublicListing),
  };
}

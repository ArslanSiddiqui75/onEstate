import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { fallbackSlug, normalizeHost } from "@/lib/website/slug";
import type { DomainCheck } from "@/lib/website/domain";
import type { WebsiteSite } from "@/types";

export async function persistDomain(
  orgId: string,
  check: DomainCheck,
  registrar?: "namecheap",
): Promise<string | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  const { data: row } = await supabase
    .from("websites")
    .select("payload, slug, published")
    .eq("org_id", orgId)
    .maybeSingle();

  const existing = (row?.payload || {}) as Partial<WebsiteSite>;
  const slug =
    (row?.slug ? String(row.slug) : existing.slug) ||
    fallbackSlug(orgId, String(org?.name || "site"));
  const payload: Partial<WebsiteSite> = {
    ...existing,
    slug,
    customDomain: check.host,
    domainStatus: check.status === "connected" ? "connected" : check.status,
    sslStatus: check.ssl,
    domainVerifiedAt:
      check.status === "connected" ? new Date().toISOString() : existing.domainVerifiedAt,
    ...(registrar ? { domainRegistrar: registrar } : {}),
  };

  const { error } = await supabase.from("websites").upsert(
    {
      org_id: orgId,
      payload,
      slug,
      custom_domain: normalizeHost(check.host) || null,
      published: Boolean(row?.published ?? existing.published),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  if (!error) return null;
  if (error.code === "23505") return "This domain is already connected to another workspace.";
  return error.message || "Could not save domain status.";
}

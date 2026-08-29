import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { fallbackSlug, normalizeHost } from "@/lib/website/slug";
import {
  attachVercelDomain,
  checkCustomDomain,
  dnsInstructions,
  type DomainCheck,
} from "@/lib/website/domain";
import type { WebsiteSite } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  domain: z.string().min(3).max(253),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid domain payload" }, { status: 400 });
  }

  const profile = await resolveProfileFromRequest(request);
  const check = await checkCustomDomain(parsed.data.domain);

  if (check.dnsOk) {
    const names = [...new Set([check.host, check.lookupHost].filter(Boolean))];
    let vercel: Awaited<ReturnType<typeof attachVercelDomain>> = null;
    for (const name of names) {
      const result = await attachVercelDomain(name);
      if (!result) continue;
      if (!vercel || result.attached) vercel = result;
    }
    if (vercel) {
      check.vercel = vercel;
      if (vercel.attached && check.ssl !== "active") {
        check.ssl = "provisioning";
      }
      if (!vercel.attached && vercel.detail) {
        check.message = `${check.message} Vercel: ${vercel.detail}`;
      }
    } else if (check.ssl === "provisioning") {
      check.message = `${check.message} HTTPS needs this hostname on the Vercel project — set VERCEL_TOKEN and VERCEL_PROJECT_ID to attach it automatically.`;
    }
  }

  if (profile && check.host) {
    const persistError = await persistDomain(profile.orgId, check);
    if (persistError) {
      return NextResponse.json(
        {
          error: persistError,
          domain: check.host,
          status: "failed",
          ssl: "none",
          message: persistError,
          apex: check.apex,
          instructions: check.instructions,
        },
        { status: persistError.includes("already connected") ? 409 : 500 },
      );
    }
  }

  return NextResponse.json({
    domain: check.host,
    status: check.status,
    ssl: check.ssl,
    message: check.message,
    apex: check.apex,
    instructions: check.instructions.length
      ? check.instructions
      : dnsInstructions(check.host),
    vercel: check.vercel || undefined,
  });
}

async function persistDomain(orgId: string, check: DomainCheck): Promise<string | null> {
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
      check.status === "connected"
        ? new Date().toISOString()
        : existing.domainVerifiedAt,
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
  if (error.code === "23505") {
    return "This domain is already connected to another workspace.";
  }
  return error.message || "Could not save domain status.";
}

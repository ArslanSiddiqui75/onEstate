import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoAnyModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  path: z.string().min(1),
  mimeType: z.string().optional(),
  leadId: z.string().optional(),
  listingId: z.string().optional(),
  dealId: z.string().optional(),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoAnyModule(profile, [
    ["crm", "view"],
    ["listings", "view"],
    ["transactions", "view"],
  ]);
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ documents: [] });
  }

  const [uploads, esign, media] = await Promise.all([
    supabase
      .from("org_documents")
      .select("id, title, path, kind, mime_type, created_at, lead_id, listing_id, deal_id")
      .eq("org_id", profile.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction_documents")
      .select("id, name, status, created_at, transaction_id")
      .eq("org_id", profile.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listing_media")
      .select("id, url, listing_id, created_at")
      .eq("org_id", profile.orgId)
      .order("created_at", { ascending: false }),
  ]);

  const documents = [
    ...(uploads.data || []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      kind: "upload" as const,
      href: String(row.path),
      createdAt: String(row.created_at),
    })),
    ...(esign.data || []).map((row) => ({
      id: `esign-${row.id}`,
      title: String(row.name || "E-sign document"),
      kind: "esign" as const,
      href: null,
      createdAt: String(row.created_at),
      meta: String(row.status || ""),
    })),
    ...(media.data || []).map((row) => ({
      id: `media-${row.id}`,
      title: "Listing media",
      kind: "listing" as const,
      href: row.url ? String(row.url) : null,
      createdAt: String(row.created_at || ""),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoAnyModule(profile, [
    ["crm", "edit"],
    ["listings", "edit"],
    ["transactions", "edit"],
  ]);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Title and path are required" }, { status: 400 });
  }
  if (!parsed.data.path.startsWith(`${profile.orgId}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }

  const { error } = await supabase.from("org_documents").insert({
    org_id: profile.orgId,
    title: parsed.data.title,
    path: parsed.data.path,
    kind: "upload",
    mime_type: parsed.data.mimeType,
    lead_id: parsed.data.leadId || null,
    listing_id: parsed.data.listingId || null,
    deal_id: parsed.data.dealId || null,
    created_by: profile.userId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

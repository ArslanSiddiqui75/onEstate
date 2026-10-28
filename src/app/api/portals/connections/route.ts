import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/social/crypto";
import type { PortalConnection, PortalId } from "@/types";

const PORTALS = ["rightmove", "zoopla", "onthemarket", "mls"] as const;

const saveSchema = z.object({
  portal: z.enum(PORTALS),
  connected: z.boolean(),
  branchId: z.string().trim().max(64).regex(/^[\w .\-/]*$/, "Invalid branch ID").optional(),
  networkId: z.string().trim().max(64).regex(/^[\w .\-/]*$/, "Invalid network ID").optional(),
  apiKey: z.string().trim().max(512).optional(),
  notes: z.string().trim().max(500).optional(),
});

function rowToConnection(row: {
  portal: string;
  connected: boolean;
  branch_id: string | null;
  network_id: string | null;
  api_key_ciphertext: string | null;
  connected_at: string | null;
  last_verified_at: string | null;
  notes: string | null;
}): PortalConnection {
  return {
    portal: row.portal as PortalId,
    connected: Boolean(row.connected),
    branchId: row.branch_id || undefined,
    networkId: row.network_id || undefined,
    apiKeyConfigured: Boolean(row.api_key_ciphertext),
    connectedAt: row.connected_at || undefined,
    lastVerifiedAt: row.last_verified_at || undefined,
    notes: row.notes || undefined,
  };
}

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (!supabase || !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const deniedView = forbiddenIfNoModule(profile, "listings", "view");
  if (deniedView) return deniedView;

  const { data, error } = await supabase
    .from("portal_connections")
    .select(
      "portal, connected, branch_id, network_id, api_key_ciphertext, connected_at, last_verified_at, notes",
    )
    .eq("org_id", profile.orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    connections: (data || []).map(rowToConnection),
  });
}

export async function PUT(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (!supabase || !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const deniedEdit = forbiddenIfNoModule(profile, "listings", "edit");
  if (deniedEdit) return deniedEdit;

  const json = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.connected && !input.branchId) {
    return NextResponse.json(
      { error: "Enter your branch ID to connect this portal." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  let ciphertext: string | null | undefined;
  if (!parsed.data.connected) {
    ciphertext = null;
  } else if (parsed.data.apiKey?.trim()) {
    try {
      ciphertext = encryptToken(parsed.data.apiKey.trim());
    } catch {
      return NextResponse.json(
        { error: "Portal keys can’t be stored yet." },
        { status: 503 },
      );
    }
  }

  const patch: Record<string, unknown> = {
    org_id: profile.orgId,
    portal: parsed.data.portal,
    connected: parsed.data.connected,
    branch_id: parsed.data.connected ? parsed.data.branchId?.trim() || null : null,
    network_id: parsed.data.connected ? parsed.data.networkId?.trim() || null : null,
    notes: parsed.data.notes || null,
    updated_at: now,
    last_verified_at: null,
    connected_at: parsed.data.connected ? now : null,
  };
  if (ciphertext !== undefined) {
    patch.api_key_ciphertext = ciphertext;
  }

  const { data, error } = await supabase
    .from("portal_connections")
    .upsert(patch, { onConflict: "org_id,portal" })
    .select(
      "portal, connected, branch_id, network_id, api_key_ciphertext, connected_at, last_verified_at, notes",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Failed to save portal connection" },
      { status: 500 },
    );
  }

  return NextResponse.json({ connection: rowToConnection(data) });
}

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/request-admin";
import { loadPlatformRegistryFromDb } from "@/lib/admin/platform-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ source: "local" });
  }

  const registry = await loadPlatformRegistryFromDb(supabase);
  return NextResponse.json({ source: "supabase", registry });
}

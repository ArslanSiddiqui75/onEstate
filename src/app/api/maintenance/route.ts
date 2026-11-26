import { NextResponse } from "next/server";
import { readMaintenanceSettings } from "@/lib/admin/maintenance-store";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Public: which workspace roles are currently under maintenance. */
export async function GET() {
  const supabase = createServiceSupabaseClient();
  const settings = await readMaintenanceSettings(supabase);
  return NextResponse.json({
    enabled: settings.enabled,
    roles: settings.enabled ? settings.roles : [],
    source: supabase ? "hosted" : "local",
  });
}

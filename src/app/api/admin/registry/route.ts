import { requireAdminRole } from "@/lib/admin/request-admin";
import { loadPlatformRegistryFromDb } from "@/lib/admin/platform-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adminJson } from "@/lib/admin/json";

export async function GET() {
  // All admin roles may read the registry.
  const check = await requireAdminRole();
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({ source: "local" });
  }

  try {
    const registry = await loadPlatformRegistryFromDb(supabase);
    return adminJson({ source: "supabase", registry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registry load failed";
    console.error("[api/admin/registry]", message);
    return adminJson({ error: message }, { status: 502 });
  }
}

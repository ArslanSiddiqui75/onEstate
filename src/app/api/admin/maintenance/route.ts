import { z } from "zod";
import { adminJson } from "@/lib/admin/json";
import { normalizeMaintenanceSettings } from "@/lib/admin/maintenance";
import type { Role } from "@/types";
import {
  readMaintenanceSettings,
  writeMaintenanceSettings,
} from "@/lib/admin/maintenance-store";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const roleSchema = z.enum([
  "owner",
  "broker",
  "team_lead",
  "agent",
  "assistant",
  "accountant",
]);

const bodySchema = z.object({
  enabled: z.boolean(),
  roles: z.array(roleSchema),
});

export async function GET() {
  const check = await requireAdminRole("super_admin");
  if (!check.ok) {
    return adminJson(
      { error: check.status === 401 ? "Unauthorized" : "Super admin only" },
      { status: check.status },
    );
  }

  const supabase = createServiceSupabaseClient();
  const settings = await readMaintenanceSettings(supabase);
  return adminJson({
    ...settings,
    source: supabase ? "hosted" : "local",
  });
}

export async function PUT(request: Request) {
  const check = await requireAdminRole("super_admin");
  if (!check.ok) {
    return adminJson(
      { error: check.status === 401 ? "Unauthorized" : "Super admin only" },
      { status: check.status },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return adminJson({ error: "Invalid maintenance payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({
      ...normalizeMaintenanceSettings({
        ...parsed.data,
        updatedAt: new Date().toISOString(),
        updatedBy: check.admin.email,
      }),
      source: "local",
    });
  }

  try {
    const saved = await writeMaintenanceSettings(
      supabase,
      {
        enabled: parsed.data.enabled,
        roles: parsed.data.roles as Role[],
        updatedAt: new Date().toISOString(),
        updatedBy: check.admin.email,
      },
      check.admin.email,
    );
    return adminJson({ ...saved, source: "hosted" });
  } catch (err) {
    return adminJson(
      {
        error:
          err instanceof Error ? err.message : "Could not save maintenance settings",
      },
      { status: 500 },
    );
  }
}

import { z } from "zod";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { applyPlatformMemberAction } from "@/lib/admin/platform-db";
import { MEMBER_ACTIONS, MEMBER_ROLES } from "@/lib/admin/member-actions";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adminJson } from "@/lib/admin/json";

const bodySchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  action: z.enum(MEMBER_ACTIONS),
  role: z.enum(MEMBER_ROLES).optional(),
});

export async function POST(request: Request) {
  const gate = await requireAdminRole("super_admin", "support_admin");
  if (!gate.ok) {
    return adminJson({ error: gate.error }, { status: gate.status });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({ source: "local" });
  }

  try {
    const message = await applyPlatformMemberAction(
      supabase,
      parsed.data.orgId,
      parsed.data.memberId,
      parsed.data.action,
      gate.admin.email,
      parsed.data.role,
    );
    return adminJson({ ok: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update this user";
    const status = /not available|not found|Choose a role/i.test(message) ? 409 : 502;
    return adminJson({ error: message }, { status });
  }
}

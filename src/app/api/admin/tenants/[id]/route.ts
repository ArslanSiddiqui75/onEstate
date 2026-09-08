import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin/request-admin";
import { patchPlatformTenant } from "@/lib/admin/platform-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  adminCanEditNotes,
  adminCanManageBilling,
  adminCanSuspendTenants,
} from "@/lib/admin/accounts";

const bodySchema = z.object({
  lifecycleStatus: z
    .enum(["trialing", "active", "past_due", "suspended", "canceled", "churned"])
    .optional(),
  notes: z.string().optional(),
  plan: z.enum(["solo", "team", "enterprise"]).optional(),
  subscriptionStatus: z
    .enum([
      "trialing",
      "active",
      "past_due",
      "canceled",
      "incomplete",
      "unpaid",
      "paused",
    ])
    .optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requirePlatformAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.plan || parsed.data.subscriptionStatus) {
    if (!adminCanManageBilling(admin.role)) {
      return NextResponse.json({ error: "Billing permission required" }, { status: 403 });
    }
  }
  if (parsed.data.lifecycleStatus === "suspended" && !adminCanSuspendTenants(admin.role)) {
    return NextResponse.json({ error: "Suspend permission required" }, { status: 403 });
  }
  if (parsed.data.notes != null && !adminCanEditNotes(admin.role)) {
    return NextResponse.json({ error: "Notes permission required" }, { status: 403 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ source: "local" });
  }

  await patchPlatformTenant(supabase, id, admin.email, parsed.data);
  return NextResponse.json({ ok: true });
}

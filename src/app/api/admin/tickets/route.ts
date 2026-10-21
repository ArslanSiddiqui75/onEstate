import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ tickets: [] });
  }
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, org_id, subject, status, priority, created_at, updated_at, organizations(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({
    tickets: (data || []).map((row) => {
      const org = row.organizations as { name?: string } | { name?: string }[] | null;
      const orgName = Array.isArray(org) ? org[0]?.name : org?.name;
      return {
        id: row.id,
        orgId: row.org_id,
        orgName: orgName || "Workspace",
        subject: row.subject,
        status: row.status,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  });
}

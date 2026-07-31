import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: account } = await supabase
    .from("social_accounts")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();
  if (!account || String(account.org_id) !== profile.orgId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await supabase.from("social_account_secrets").delete().eq("account_id", id);
  const { error } = await supabase
    .from("social_accounts")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

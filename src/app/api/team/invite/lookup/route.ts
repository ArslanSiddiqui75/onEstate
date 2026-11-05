import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/http/client-ip";

const schema = z.object({
  token: z.string().min(16).max(80),
});

const isLimited = createSlidingWindowLimiter({ windowMs: 60_000, max: 30 });


/** Public lookup for a pending invite (no auth). Token is the secret. */
export async function GET(request: Request) {
  if (isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many lookups" }, { status: 429 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Invites aren’t available yet." }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token") || "";
  const parsed = schema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, email, name, role, status, org_id, organizations(name)")
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const orgJoin = invite.organizations as { name?: string } | { name?: string }[] | null;
  const org = Array.isArray(orgJoin) ? orgJoin[0] : orgJoin;

  return NextResponse.json({
    email: String(invite.email),
    name: String(invite.name || ""),
    role: String(invite.role),
    orgName: String(org?.name || "your team"),
  });
}

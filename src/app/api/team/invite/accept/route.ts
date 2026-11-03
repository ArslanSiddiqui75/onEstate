import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { TERMS_VERSION } from "@/lib/team/invite-token";
import { checkSeatLimit } from "@/lib/access";
import type { PlanId } from "@/types";

const schema = z.object({
  token: z.string().min(16).max(80),
  password: z.string().min(6).max(200),
  name: z.string().min(2).max(100).optional(),
  acceptTerms: z.literal(true),
});

const isLimited = createSlidingWindowLimiter({ windowMs: 60_000, max: 10 });

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

/**
 * Accept a team invite without Stripe Checkout.
 * Creates the Auth user; handle_new_user joins the invite org.
 */
export async function POST(request: Request) {
  if (isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Invites aren’t available yet." }, { status: 503 });
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite acceptance" }, { status: 400 });
  }

  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, email, name, role, status, org_id")
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 404 });
  }

  const [{ count: memberCount }, { count: pendingCount }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", invite.org_id),
    supabase
      .from("team_invites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", invite.org_id)
      .eq("status", "pending"),
    supabase.from("organizations").select("plan").eq("id", invite.org_id).maybeSingle(),
  ]);

  const seatCheck = checkSeatLimit(
    (memberCount || 0) + Math.max((pendingCount || 1) - 1, 0),
    (org?.plan as PlanId) || "solo",
  );
  if (!seatCheck.allowed) {
    return NextResponse.json(
      { error: "This workspace is at its seat limit. Ask the owner to upgrade." },
      { status: 400 },
    );
  }

  const email = String(invite.email).trim().toLowerCase();
  const fullName = (parsed.data.name || invite.name || email.split("@")[0]).trim();
  const termsAt = new Date().toISOString();

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      name: fullName,
      org_name: "Invite join",
      market: "uk",
      accepted_terms_at: termsAt,
      accepted_terms_version: TERMS_VERSION,
      invite_token: parsed.data.token,
    },
  });

  if (error || !created.user) {
    const message = error?.message || "Could not create the account";
    if (/already|registered|exists/i.test(message)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Stamp terms again in case the trigger ran before metadata was visible.
  await supabase
    .from("profiles")
    .update({
      accepted_terms_at: termsAt,
      accepted_terms_version: TERMS_VERSION,
      full_name: fullName,
      email,
    })
    .eq("id", created.user.id);

  return NextResponse.json({
    ok: true,
    email,
    message: "Account created. Sign in with your email and password.",
  });
}

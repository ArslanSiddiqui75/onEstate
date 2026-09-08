import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { checkSeatLimit } from "@/lib/access";
import type { PlanId, Role } from "@/types";

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum([
    "owner",
    "broker",
    "team_lead",
    "agent",
    "assistant",
    "accountant",
  ]),
});

export async function POST(request: Request) {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Team invites require Supabase" },
      { status: 503 },
    );
  }

  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite payload" }, { status: 400 });
  }

  const [{ data: org }, { data: members }, { data: pending }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, plan")
      .eq("id", profile.orgId)
      .maybeSingle(),
    supabase.from("profiles").select("id").eq("org_id", profile.orgId),
    supabase
      .from("team_invites")
      .select("id")
      .eq("org_id", profile.orgId)
      .eq("status", "pending"),
  ]);

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const seatCheck = checkSeatLimit(
    (members?.length || 0) + (pending?.length || 0),
    org.plan as PlanId,
  );
  if (!seatCheck.allowed) {
    return NextResponse.json(
      {
        error: seatCheck.maxSeats
          ? `Seat limit reached (${seatCheck.maxSeats}). Upgrade your plan to invite more teammates.`
          : "Seat limit reached",
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  const role = parsed.data.role as Role;

  const { data: duplicateInvite } = await supabase
    .from("team_invites")
    .select("id")
    .eq("org_id", profile.orgId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (duplicateInvite) {
    return NextResponse.json(
      { error: "An invite is already pending for this email" },
      { status: 409 },
    );
  }

  const { error: insertError } = await supabase.from("team_invites").insert({
    org_id: profile.orgId,
    email,
    name,
    role,
    invited_by: profile.userId,
    status: "pending",
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Could not save invite" },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const signupUrl = `${appUrl}/app/signup?email=${encodeURIComponent(email)}`;

  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (resendKey && from) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: email,
          subject: `You're invited to ${org.name} on 0nEstate`,
          text: `Hi ${name},\n\nYou've been invited to join ${org.name} as ${role.replace("_", " ")}.\n\nCreate your account to accept:\n${signupUrl}\n\nUse this email address when signing up.`,
        }),
      });
      emailed = res.ok;
    } catch {
      emailed = false;
    }
  }

  return NextResponse.json({
    ok: true,
    emailed,
    signupUrl,
    message: emailed
      ? `Invite sent to ${email}`
      : `Invite saved for ${email}. Share the signup link with them.`,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { insertHostedTicket, TicketDeskError } from "@/lib/admin/ticket-db";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(3).max(4000),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ tickets: [] });
  }
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, body, status, priority, created_at, updated_at")
    .eq("org_id", profile.orgId)
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ tickets: data || [] });
}

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Subject and details are required" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  try {
    const id = await insertHostedTicket(supabase, {
      orgId: profile.orgId,
      userId: profile.userId,
      email: profile.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
      priority: parsed.data.priority || "normal",
    });
    return NextResponse.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create ticket";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

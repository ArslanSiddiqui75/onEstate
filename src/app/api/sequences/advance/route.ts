import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { advanceEnrollment } from "@/lib/sequences/engine";

const bodySchema = z.object({
  leadId: z.string().min(1),
  sequenceId: z.string().min(1),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  const result = await advanceEnrollment(supabase, {
    orgId: profile.orgId,
    leadId: parsed.data.leadId,
    sequenceId: parsed.data.sequenceId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to advance sequence" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}

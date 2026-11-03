import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  contactId: z.string().uuid(),
  enabled: z.boolean(),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ contactIds: [] as string[] });
  }

  const { data, error } = await supabase
    .from("contact_user_dnd")
    .select("contact_id")
    .eq("org_id", profile.orgId)
    .eq("profile_id", profile.userId);

  if (error) {
    return NextResponse.json({ error: "Could not load Do Not Disturb." }, { status: 502 });
  }

  return NextResponse.json({
    contactIds: (data || []).map((row) => String(row.contact_id)),
  });
}

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Do Not Disturb payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Do Not Disturb can’t be saved yet." },
      { status: 503 },
    );
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, org_id")
    .eq("id", parsed.data.contactId)
    .eq("org_id", profile.orgId)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (parsed.data.enabled) {
    const { error } = await supabase.from("contact_user_dnd").upsert(
      {
        profile_id: profile.userId,
        contact_id: parsed.data.contactId,
        org_id: profile.orgId,
      },
      { onConflict: "profile_id,contact_id" },
    );
    if (error) {
      return NextResponse.json({ error: "Could not enable Do Not Disturb." }, { status: 502 });
    }
  } else {
    const { error } = await supabase
      .from("contact_user_dnd")
      .delete()
      .eq("profile_id", profile.userId)
      .eq("contact_id", parsed.data.contactId)
      .eq("org_id", profile.orgId);
    if (error) {
      return NextResponse.json({ error: "Could not clear Do Not Disturb." }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    contactId: parsed.data.contactId,
    enabled: parsed.data.enabled,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";

/** True when this profile has personal DND on a contact linked to the lead. */
export async function profileHasDndForLead(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    profileId: string;
    leadId: string;
    email?: string | null;
    phone?: string | null;
  },
): Promise<boolean> {
  const { data: byLead } = await supabase
    .from("contacts")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .limit(20);

  const contactIds = new Set<string>((byLead || []).map((row) => String(row.id)));

  if (input.email) {
    const { data: byEmail } = await supabase
      .from("contacts")
      .select("id")
      .eq("org_id", input.orgId)
      .ilike("email", input.email.trim())
      .limit(20);
    for (const row of byEmail || []) contactIds.add(String(row.id));
  }

  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    if (digits.length >= 7) {
      const { data: byPhone } = await supabase
        .from("contacts")
        .select("id")
        .eq("org_id", input.orgId)
        .eq("phone", input.phone)
        .limit(20);
      for (const row of byPhone || []) contactIds.add(String(row.id));
    }
  }

  if (contactIds.size === 0) return false;

  const { data: dndRows } = await supabase
    .from("contact_user_dnd")
    .select("contact_id")
    .eq("org_id", input.orgId)
    .eq("profile_id", input.profileId)
    .in("contact_id", Array.from(contactIds));

  return Boolean(dndRows && dndRows.length > 0);
}

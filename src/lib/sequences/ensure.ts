import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultSequences,
  mapSequenceRow,
  stepsLookLegacy,
} from "@/lib/sequences/catalog";

export async function ensureDefaultSequences(
  supabase: SupabaseClient,
  orgId: string,
) {
  const { data, error } = await supabase
    .from("message_sequences")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;

  const rows = (data || []) as Record<string, unknown>[];
  const now = new Date().toISOString();

  for (const seed of defaultSequences(orgId, now)) {
    const raw = rows.find((row) => mapSequenceRow(row).kind === seed.kind);
    if (!raw) {
      const { data: inserted, error: insertError } = await supabase
        .from("message_sequences")
        .insert({
          org_id: orgId,
          title: seed.title,
          description: seed.description,
          status: seed.status,
          kind: seed.kind,
          steps: seed.steps,
        })
        .select("*")
        .maybeSingle();
      if (insertError) throw insertError;
      if (inserted) rows.push(inserted as Record<string, unknown>);
      continue;
    }

    const mapped = mapSequenceRow(raw);
    const storedKind = String(raw.kind || "custom");
    if (storedKind !== seed.kind || stepsLookLegacy(mapped.steps)) {
      const { error: updateError } = await supabase
        .from("message_sequences")
        .update({
          kind: seed.kind,
          description: seed.description,
          steps: stepsLookLegacy(mapped.steps) ? seed.steps : mapped.steps,
          status: "active",
        })
        .eq("id", mapped.id)
        .eq("org_id", orgId);
      if (updateError) throw updateError;
    }
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

const OPT_OUT_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout"]);

/** Carrier-standard keywords. Only an exact one-word reply counts, so "please don't stop" does not. */
export function isOptOutMessage(body: string): boolean {
  const word = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return word.length > 0 && body.trim().split(/\s+/).length === 1 && OPT_OUT_KEYWORDS.has(word);
}

/** Record the opt-out on every number for the lead and stop anything still queued to them. */
export async function applyLeadOptOut(supabase: SupabaseClient, input: { orgId: string; leadId: string }) {
  const now = new Date().toISOString();
  await supabase
    .from("lead_phone_numbers")
    .update({ consent: "opted_out" })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId);
  await supabase
    .from("automation_runs")
    .update({ status: "cancelled", last_error: "Lead opted out", completed_at: now, updated_at: now })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .in("status", ["pending", "waiting", "running"]);
  await supabase
    .from("sequence_enrollments")
    .update({ status: "paused" })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .eq("status", "active");
}

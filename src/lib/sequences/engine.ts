import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOutboundEmail } from "@/lib/email/service";
import { sendOutboundSms } from "@/lib/messaging/service";
import { isE164 } from "@/lib/phone/e164";
import {
  mapSequenceRow,
  renderSequenceTemplate,
  sequenceVarsFromLead,
} from "@/lib/sequences/catalog";
import type { SequenceStep } from "@/types";

export interface AdvanceResult {
  ok: boolean;
  completed?: boolean;
  detail?: string;
  currentStep?: number;
  error?: string;
}

async function executeSequenceStep(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    leadId: string;
    step: SequenceStep;
    vars: Record<string, string | undefined>;
    lead: { phone?: string; email?: string };
  },
): Promise<{ ok: boolean; detail: string }> {
  const { orgId, leadId, step, vars, lead } = input;

  if (step.type === "sms") {
    const body = renderSequenceTemplate(step.body || "", vars).trim();
    if (!body) return { ok: false, detail: "Empty SMS body" };
    const { data: phones } = await supabase
      .from("lead_phone_numbers")
      .select("number, consent, preferred")
      .eq("lead_id", leadId)
      .eq("org_id", orgId);
    const preferred =
      (phones || []).find((p) => p.preferred) || (phones || [])[0];
    const dest = (preferred?.number || lead.phone || "").trim();
    if (!dest) return { ok: false, detail: "Lead has no phone number" };
    if (!isE164(dest)) {
      return {
        ok: false,
        detail: "Phone needs a country code (save as +92… or +44…, not 0333…).",
      };
    }
    if (preferred?.consent === "opted_out") {
      return { ok: false, detail: "Contact opted out of SMS" };
    }
    const result = await sendOutboundSms(supabase, {
      orgId,
      leadId,
      to: dest,
      body,
      consent:
        (preferred?.consent as "unknown" | "opted_in" | "opted_out") || "unknown",
    });
    if (!result.ok) return { ok: false, detail: result.error || "SMS send failed" };
    return { ok: true, detail: `SMS sent (${result.mode})` };
  }

  if (step.type === "email") {
    const to = (lead.email || "").trim();
    if (!to) return { ok: false, detail: "Lead has no email address" };
    const subject = renderSequenceTemplate(
      step.subject || "Following up",
      vars,
    ).trim();
    const body = renderSequenceTemplate(step.body || "", vars).trim();
    if (!body) return { ok: false, detail: "Empty email body" };
    const result = await sendOutboundEmail(supabase, {
      orgId,
      leadId,
      to,
      subject,
      body,
    });
    if (!result.ok) return { ok: false, detail: result.error || "Email send failed" };
    return { ok: true, detail: `Email sent (${result.mode})` };
  }

  const title = renderSequenceTemplate(step.label || "Follow up", vars);
  const { error } = await supabase.from("lead_tasks").insert({
    lead_id: leadId,
    org_id: orgId,
    title,
    channel: step.channel || "Call",
    status: "open",
    due_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  });
  if (error) return { ok: false, detail: error.message };
  return { ok: true, detail: `Task created: ${title}` };
}

export async function advanceEnrollment(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string; sequenceId: string },
): Promise<AdvanceResult> {
  const { data: seqRow, error: seqError } = await supabase
    .from("message_sequences")
    .select("*")
    .eq("id", input.sequenceId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (seqError) return { ok: false, error: seqError.message };
  if (!seqRow) return { ok: false, error: "Sequence not found" };

  const sequence = mapSequenceRow(seqRow as Record<string, unknown>);
  if (sequence.status !== "active") {
    return { ok: false, error: "Sequence is not active" };
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, name, email, phone, stage, source")
    .eq("id", input.leadId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (leadError) return { ok: false, error: leadError.message };
  if (!lead) return { ok: false, error: "Lead not found" };

  const { data: enrollment, error: enrError } = await supabase
    .from("sequence_enrollments")
    .select("*")
    .eq("org_id", input.orgId)
    .eq("sequence_id", input.sequenceId)
    .eq("lead_id", input.leadId)
    .maybeSingle();
  if (enrError) return { ok: false, error: enrError.message };
  if (!enrollment) return { ok: false, error: "Lead is not enrolled" };
  if (enrollment.status === "paused") {
    return { ok: false, error: "Enrollment is paused" };
  }

  const steps = sequence.steps;
  const currentStep = Number(enrollment.current_step || 0);
  if (currentStep >= steps.length) {
    await supabase
      .from("sequence_enrollments")
      .update({ status: "completed" })
      .eq("id", enrollment.id);
    return {
      ok: true,
      completed: true,
      currentStep,
      detail: "Sequence already finished",
    };
  }

  const step = steps[currentStep];
  const vars = sequenceVarsFromLead(lead);
  const result = await executeSequenceStep(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    step,
    vars,
    lead,
  });

  if (!result.ok) {
    return { ok: false, error: result.detail, currentStep };
  }

  const next = currentStep + 1;
  const done = next >= steps.length;
  await supabase
    .from("sequence_enrollments")
    .update({
      current_step: next,
      last_ran_at: new Date().toISOString(),
      status: done ? "completed" : "active",
    })
    .eq("id", enrollment.id);

  await supabase.from("lead_activities").insert({
    org_id: input.orgId,
    lead_id: input.leadId,
    activity_type: "sequence_step",
    body: result.detail,
    metadata: {
      sequenceId: input.sequenceId,
      stepId: step.id,
      stepIndex: currentStep,
    },
  });

  return {
    ok: true,
    completed: done,
    currentStep: next,
    detail: result.detail,
  };
}

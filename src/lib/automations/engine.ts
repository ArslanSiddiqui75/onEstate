import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutomationActionType,
  AutomationStep,
  AutomationTrigger,
  LeadStage,
} from "@/types";
import { sendOutboundSms } from "@/lib/messaging/service";
import { sendOutboundEmail } from "@/lib/email/service";

/**
 * Automation runtime.
 *
 * `automations` rows are just config; nothing executed them before this.
 * Triggers create an `automation_runs` row, and the engine walks that run's
 * steps until it finishes or hits a `wait` (which parks the run until
 * `run_after`). A cron hit or an in-app flush resumes parked runs.
 */

/** Steps executed per pass. A `wait` parks the run, so this only caps bursts. */
const MAX_STEPS_PER_PASS = 25;
/** Runs claimed per processing pass, keeping cron invocations bounded. */
const DEFAULT_RUN_BATCH = 25;

export interface EnqueueInput {
  orgId: string;
  leadId: string;
  trigger: AutomationTrigger;
  /** Required for `stage_changed` so per-stage workflows can match. */
  stage?: LeadStage;
  /** Only run this automation (manual start from the UI). */
  automationId?: string;
}

export interface EnqueueSummary {
  enqueued: number;
  automationIds: string[];
}

export interface ProcessSummary {
  processed: number;
  completed: number;
  waiting: number;
  failed: number;
}

interface LeadRow {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string | null;
  assigned_to: string | null;
  tags: unknown;
}

interface RunRow {
  id: string;
  org_id: string;
  automation_id: string;
  lead_id: string;
  trigger: string;
  status: string;
  step_index: number;
  context: Record<string, unknown> | null;
}

/** Substitute {{token}} placeholders in an SMS/task template. */
export function renderTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, rawKey) => {
    const key = String(rawKey).toLowerCase();
    const value = vars[key];
    return value !== undefined && value !== "" ? value : match;
  });
}

function templateVarsFromLead(
  lead: LeadRow,
  extra: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  const parts = String(lead.name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "there",
    last_name: parts.slice(1).join(" ") || "",
    full_name: lead.name || "",
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    stage: lead.stage || "",
    source: lead.source || "",
    ...extra,
  };
}

async function logActivity(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    leadId: string;
    activityType: string;
    body: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("lead_activities").insert({
    org_id: input.orgId,
    lead_id: input.leadId,
    activity_type: input.activityType,
    body: input.body,
    metadata: input.metadata || {},
  });
}

async function recordRunStep(
  supabase: SupabaseClient,
  input: {
    runId: string;
    orgId: string;
    stepIndex: number;
    stepType: AutomationActionType | string;
    label?: string;
    status: "completed" | "failed" | "skipped" | "waiting";
    detail?: string;
  },
) {
  await supabase.from("automation_run_steps").insert({
    run_id: input.runId,
    org_id: input.orgId,
    step_index: input.stepIndex,
    step_type: input.stepType,
    label: input.label || null,
    status: input.status,
    detail: input.detail || null,
  });
}

/**
 * Create runs for every active automation matching a trigger.
 * Safe to call on every lead create / stage change — it no-ops when nothing matches.
 */
export async function enqueueAutomationRuns(
  supabase: SupabaseClient,
  input: EnqueueInput,
): Promise<EnqueueSummary> {
  let query = supabase
    .from("automations")
    .select("id, trigger, trigger_stage, status, steps")
    .eq("org_id", input.orgId)
    .eq("status", "active");

  // Manual starts target one workflow and ignore the trigger filter, so an
  // agent can kick off a `manual` workflow on demand.
  if (input.automationId) {
    query = query.eq("id", input.automationId);
  } else {
    query = query.eq("trigger", input.trigger);
  }

  const { data: automations, error } = await query;
  if (error || !automations?.length) {
    return { enqueued: 0, automationIds: [] };
  }

  const matching = automations.filter((automation) => {
    const steps = Array.isArray(automation.steps) ? automation.steps : [];
    if (!steps.length) return false;
    if (input.automationId) return true;
    if (automation.trigger !== "stage_changed") return true;
    // A stage-scoped workflow only fires for its configured stage.
    if (!automation.trigger_stage) return true;
    return automation.trigger_stage === input.stage;
  });

  if (!matching.length) return { enqueued: 0, automationIds: [] };

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("automation_runs")
    .insert(
      matching.map((automation) => ({
        org_id: input.orgId,
        automation_id: automation.id,
        lead_id: input.leadId,
        trigger: input.automationId ? "manual" : input.trigger,
        status: "pending",
        step_index: 0,
        run_after: now,
        context: input.stage ? { stage: input.stage } : {},
      })),
    )
    .select("id, automation_id");

  if (insertError) return { enqueued: 0, automationIds: [] };

  return {
    enqueued: inserted?.length || 0,
    automationIds: (inserted || []).map((row) => String(row.automation_id)),
  };
}

async function executeStep(
  supabase: SupabaseClient,
  input: {
    step: AutomationStep;
    run: RunRow;
    lead: LeadRow;
  },
): Promise<
  | { outcome: "completed"; detail?: string }
  | { outcome: "skipped"; detail: string }
  | { outcome: "waiting"; runAfter: string; detail: string }
  | { outcome: "failed"; detail: string }
> {
  const { step, run, lead } = input;
  const vars = templateVarsFromLead(lead);

  switch (step.type) {
    case "wait": {
      const hours = Number(step.config.delayHours) || 0;
      const runAfter = new Date(Date.now() + hours * 3_600_000).toISOString();
      return {
        outcome: "waiting",
        runAfter,
        detail: `Waiting ${hours}h until ${runAfter}`,
      };
    }

    case "send_sms": {
      const body = renderTemplate(step.config.body || "", vars).trim();
      if (!body) return { outcome: "skipped", detail: "Empty SMS body" };

      const { data: phones } = await supabase
        .from("lead_phone_numbers")
        .select("number, consent, preferred")
        .eq("lead_id", lead.id)
        .eq("org_id", run.org_id);

      const preferred =
        (phones || []).find((p) => p.preferred) || (phones || [])[0];
      const to = preferred?.number || lead.phone || "";
      if (!to) return { outcome: "skipped", detail: "Lead has no phone number" };
      if (preferred?.consent === "opted_out") {
        return { outcome: "skipped", detail: "Contact opted out of SMS" };
      }

      const result = await sendOutboundSms(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        to,
        body,
        consent:
          (preferred?.consent as "unknown" | "opted_in" | "opted_out") || "unknown",
      });
      if (!result.ok) {
        return { outcome: "failed", detail: result.error || "SMS send failed" };
      }

      await logActivity(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        activityType: "automation_sms",
        body,
        metadata: { runId: run.id, mode: result.mode, sid: result.sid },
      });
      return { outcome: "completed", detail: `SMS sent (${result.mode}) to ${to}` };
    }

    case "send_email": {
      const to = (lead.email || "").trim();
      if (!to) return { outcome: "skipped", detail: "Lead has no email address" };

      const subject = renderTemplate(
        step.config.subject || "Following up",
        vars,
      ).trim();
      const body = renderTemplate(step.config.body || "", vars).trim();
      if (!body) return { outcome: "skipped", detail: "Empty email body" };

      const result = await sendOutboundEmail(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        to,
        subject,
        body,
      });
      if (!result.ok) {
        return { outcome: "failed", detail: result.error || "Email send failed" };
      }

      await logActivity(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        activityType: "automation_email",
        body: subject,
        metadata: { runId: run.id, mode: result.mode, sid: result.sid },
      });
      return {
        outcome: "completed",
        detail: `Email sent (${result.mode}) to ${to}`,
      };
    }

    case "create_task": {
      const title = renderTemplate(step.config.taskTitle || "Follow up", vars);
      const { error } = await supabase.from("lead_tasks").insert({
        lead_id: lead.id,
        org_id: run.org_id,
        title,
        channel: step.config.channel || "Call",
        status: "open",
        due_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      });
      if (error) return { outcome: "failed", detail: error.message };

      await logActivity(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        activityType: "automation_task",
        body: title,
        metadata: { runId: run.id },
      });
      return { outcome: "completed", detail: `Task created: ${title}` };
    }

    case "update_stage": {
      const stage = step.config.stage;
      if (!stage) return { outcome: "skipped", detail: "No stage configured" };
      if (lead.stage === stage) {
        return { outcome: "skipped", detail: `Already at ${stage}` };
      }

      const { error } = await supabase
        .from("leads")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("org_id", run.org_id);
      if (error) return { outcome: "failed", detail: error.message };

      lead.stage = stage;
      await logActivity(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        activityType: "automation_stage",
        body: `Stage moved to ${stage}`,
        metadata: { runId: run.id, stage },
      });
      // Deliberately does NOT re-enqueue `stage_changed` automations — that
      // would let two workflows bounce a lead between stages forever.
      return { outcome: "completed", detail: `Stage moved to ${stage}` };
    }

    case "add_tag": {
      const tag = renderTemplate(step.config.tag || "", vars).trim();
      if (!tag) return { outcome: "skipped", detail: "No tag configured" };

      const current = Array.isArray(lead.tags)
        ? (lead.tags as unknown[]).map((t) => String(t))
        : [];
      if (current.includes(tag)) {
        return { outcome: "skipped", detail: `Tag already present: ${tag}` };
      }
      const next = [...current, tag];

      const { error } = await supabase
        .from("leads")
        .update({ tags: next, updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("org_id", run.org_id);
      if (error) return { outcome: "failed", detail: error.message };

      lead.tags = next;
      return { outcome: "completed", detail: `Tag added: ${tag}` };
    }

    case "notify_owner": {
      // In-app activity + task. Lead-facing mail uses `send_email`.
      const message = `${lead.name} needs attention (${lead.stage})`;
      await logActivity(supabase, {
        orgId: run.org_id,
        leadId: lead.id,
        activityType: "automation_notify",
        body: message,
        metadata: { runId: run.id, assignedTo: lead.assigned_to },
      });
      await supabase.from("lead_tasks").insert({
        lead_id: lead.id,
        org_id: run.org_id,
        title: `Review ${lead.name}`,
        channel: "Call",
        status: "open",
      });
      return { outcome: "completed", detail: message };
    }

    default:
      return { outcome: "skipped", detail: `Unsupported step: ${step.type}` };
  }
}

/** Walk one run's steps until it completes, parks on a wait, or fails. */
async function processRun(
  supabase: SupabaseClient,
  run: RunRow,
): Promise<"completed" | "waiting" | "failed"> {
  const { data: automation } = await supabase
    .from("automations")
    .select("id, name, status, steps")
    .eq("id", run.automation_id)
    .maybeSingle();

  const steps: AutomationStep[] = Array.isArray(automation?.steps)
    ? (automation!.steps as AutomationStep[])
    : [];

  // Pausing a workflow mid-run should stop it, not finish it silently.
  if (!automation || automation.status !== "active") {
    await supabase
      .from("automation_runs")
      .update({
        status: "cancelled",
        last_error: "Automation is no longer active",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return "failed";
  }

  const { data: leadRow } = await supabase
    .from("leads")
    .select("id, org_id, name, email, phone, stage, source, assigned_to, tags")
    .eq("id", run.lead_id)
    .eq("org_id", run.org_id)
    .maybeSingle();

  if (!leadRow) {
    await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        last_error: "Lead no longer exists",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return "failed";
  }

  const lead = leadRow as LeadRow;
  let stepIndex = run.step_index;
  let executed = 0;

  while (stepIndex < steps.length && executed < MAX_STEPS_PER_PASS) {
    const step = steps[stepIndex];
    executed += 1;

    let result: Awaited<ReturnType<typeof executeStep>>;
    try {
      result = await executeStep(supabase, { step, run, lead });
    } catch (error) {
      result = {
        outcome: "failed",
        detail: error instanceof Error ? error.message : "Step threw",
      };
    }

    if (result.outcome === "waiting") {
      await recordRunStep(supabase, {
        runId: run.id,
        orgId: run.org_id,
        stepIndex,
        stepType: step.type,
        label: step.label,
        status: "waiting",
        detail: result.detail,
      });
      await supabase
        .from("automation_runs")
        .update({
          status: "waiting",
          // resume at the step after the wait
          step_index: stepIndex + 1,
          run_after: result.runAfter,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      return "waiting";
    }

    await recordRunStep(supabase, {
      runId: run.id,
      orgId: run.org_id,
      stepIndex,
      stepType: step.type,
      label: step.label,
      status: result.outcome === "failed" ? "failed" : result.outcome,
      detail: result.detail,
    });

    if (result.outcome === "failed") {
      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          step_index: stepIndex,
          last_error: result.detail,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      return "failed";
    }

    stepIndex += 1;
  }

  const done = stepIndex >= steps.length;
  await supabase
    .from("automation_runs")
    .update({
      status: done ? "completed" : "pending",
      step_index: stepIndex,
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return done ? "completed" : "waiting";
}

/**
 * Execute every run that is due. Scoped to one org for in-app flushes,
 * or across all orgs when called from cron.
 */
export async function processAutomationRuns(
  supabase: SupabaseClient,
  options: { orgId?: string; limit?: number } = {},
): Promise<ProcessSummary> {
  const limit = options.limit ?? DEFAULT_RUN_BATCH;
  let query = supabase
    .from("automation_runs")
    .select("id, org_id, automation_id, lead_id, trigger, status, step_index, context")
    .in("status", ["pending", "waiting"])
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(limit);

  if (options.orgId) query = query.eq("org_id", options.orgId);

  const { data: runs, error } = await query;
  if (error || !runs?.length) {
    return { processed: 0, completed: 0, waiting: 0, failed: 0 };
  }

  const summary: ProcessSummary = {
    processed: 0,
    completed: 0,
    waiting: 0,
    failed: 0,
  };

  for (const row of runs) {
    const run = row as RunRow;
    await supabase
      .from("automation_runs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    let outcome: "completed" | "waiting" | "failed";
    try {
      outcome = await processRun(supabase, run);
    } catch (error) {
      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message : "Run threw",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      outcome = "failed";
    }

    summary.processed += 1;
    summary[outcome] += 1;
  }

  return summary;
}

/** Enqueue matching runs for a trigger, then immediately execute what is due. */
export async function triggerAndProcess(
  supabase: SupabaseClient,
  input: EnqueueInput,
): Promise<EnqueueSummary & ProcessSummary> {
  const enqueued = await enqueueAutomationRuns(supabase, input);
  if (!enqueued.enqueued) {
    return { ...enqueued, processed: 0, completed: 0, waiting: 0, failed: 0 };
  }
  const processed = await processAutomationRuns(supabase, {
    orgId: input.orgId,
  });
  return { ...enqueued, ...processed };
}

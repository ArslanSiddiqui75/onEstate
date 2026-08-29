import type { MessageSequence, SequenceKind, SequenceStep } from "@/types";

export function renderSequenceTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, rawKey) => {
    const key = String(rawKey).toLowerCase();
    const value = vars[key];
    return value !== undefined && value !== "" ? value : match;
  });
}

export function sequenceVarsFromLead(lead: {
  name?: string;
  email?: string;
  phone?: string;
  stage?: string;
  source?: string;
}): Record<string, string | undefined> {
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
  };
}

export function parseSequenceSteps(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      return {
        id: `step_${index}`,
        type: "task" as const,
        label: item,
        channel: "Call" as const,
      };
    }
    if (!item || typeof item !== "object") {
      return { id: `step_${index}`, type: "task" as const, label: "Follow up" };
    }
    const row = item as Record<string, unknown>;
    const type: SequenceStep["type"] =
      row.type === "sms" || row.type === "email" || row.type === "task"
        ? row.type
        : "task";
    const channel =
      row.channel === "SMS" || row.channel === "Call" || row.channel === "Email"
        ? row.channel
        : type === "sms"
          ? "SMS"
          : type === "email"
            ? "Email"
            : "Call";
    return {
      id: String(row.id || `step_${index}`),
      type,
      label: String(row.label || type),
      body: row.body ? String(row.body) : undefined,
      subject: row.subject ? String(row.subject) : undefined,
      channel,
    };
  });
}

export function guessSequenceKind(title: string): SequenceKind {
  const t = title.toLowerCase();
  if (t.includes("nurture") || t.includes("long-tail") || t.includes("long tail")) {
    return "nurture";
  }
  if (t.includes("follow-up") || t.includes("follow up") || t.includes("buyer")) {
    return "follow_up";
  }
  return "custom";
}

const LEGACY_STRING_STEPS = new Set([
  "Intro SMS",
  "Call attempt",
  "Reminder SMS",
  "Valuation SMS",
  "FAQ pack",
  "Re-engage",
]);

export function stepsLookLegacy(steps: SequenceStep[]): boolean {
  return (
    steps.length > 0 &&
    steps.every((s) => s.type === "task" && !s.body && LEGACY_STRING_STEPS.has(s.label))
  );
}

export function defaultSequences(
  orgId: string,
  now = new Date().toISOString(),
): Omit<MessageSequence, "id">[] {
  return [
    {
      orgId,
      title: "New buyer follow-up",
      description:
        "Intro text, a call task, then a reminder. Timed waits live on Automations — Send next fires the following step.",
      status: "active",
      kind: "follow_up",
      createdAt: now,
      steps: [
        {
          id: "fu_intro",
          type: "sms",
          label: "Intro SMS",
          channel: "SMS",
          body: "Hi {{first_name}}, thanks for getting in touch — I'll send a few options that match shortly.",
        },
        {
          id: "fu_call",
          type: "task",
          label: "Call attempt",
          channel: "Call",
        },
        {
          id: "fu_reminder",
          type: "sms",
          label: "Reminder SMS",
          channel: "SMS",
          body: "Hi {{first_name}}, just checking you saw my last note. Want me to keep sending listings?",
        },
      ],
    },
    {
      orgId,
      title: "Long-tail nurture",
      description:
        "Keep colder leads warm. No Day-N timer — enroll, then Send next when you want the next touch.",
      status: "active",
      kind: "nurture",
      createdAt: now,
      steps: [
        {
          id: "nu_checkin",
          type: "sms",
          label: "Soft check-in",
          channel: "SMS",
          body: "Hi {{first_name}}, still looking, or should I pause updates for now?",
        },
        {
          id: "nu_email",
          type: "email",
          label: "Nurture email",
          channel: "Email",
          subject: "Still house-hunting?",
          body: "Hi {{first_name}}, I can keep a short list coming if useful — reply and I'll tailor it.",
        },
        {
          id: "nu_task",
          type: "task",
          label: "Owner check-in",
          channel: "Call",
        },
      ],
    },
  ];
}

export function mapSequenceRow(row: Record<string, unknown>) {
  const title = String(row.title || "");
  const steps = parseSequenceSteps(row.steps);
  const kind = (row.kind as SequenceKind | undefined) || guessSequenceKind(title);
  return {
    id: String(row.id),
    orgId: String(row.org_id || row.orgId || ""),
    title,
    description: String(row.description || ""),
    status: (row.status as "draft" | "active" | "paused") || "active",
    kind,
    steps,
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
  };
}

export function findSequenceByKind(
  sequences: MessageSequence[],
  kind: SequenceKind,
): MessageSequence | undefined {
  return sequences.find((s) => s.kind === kind && s.status !== "draft");
}

export function mergeDefaultSequences(
  existing: MessageSequence[],
  orgId: string,
  makeId: () => string,
): MessageSequence[] {
  const now = new Date().toISOString();
  const mapped = existing.map((seq) =>
    mapSequenceRow({
      ...seq,
      org_id: seq.orgId,
      created_at: seq.createdAt,
    }),
  );
  const out = [...mapped];
  for (const seed of defaultSequences(orgId, now)) {
    const idx = out.findIndex((s) => s.kind === seed.kind);
    if (idx < 0) {
      out.push({ ...seed, id: makeId() });
      continue;
    }
    if (stepsLookLegacy(out[idx].steps)) {
      out[idx] = { ...out[idx], ...seed, id: out[idx].id };
    } else {
      out[idx] = { ...out[idx], kind: seed.kind };
    }
  }
  return out;
}

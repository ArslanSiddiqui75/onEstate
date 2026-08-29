import type { Lead, LeadRoutingSettings, LeadStage, PlanId, Role } from "@/types";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";
import { scoreLead, type LeadScoreResult } from "@/lib/crm/scoring";

export const DEFAULT_LEAD_ROUTING: LeadRoutingSettings = {
  mode: "round_robin",
  includeRoles: ["agent", "team_lead", "broker"],
  includeOwner: false,
  territories: {},
};

const WORKING_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "offer",
];

export function hydrateLeadRouting(
  raw?: LeadRoutingSettings | Record<string, unknown> | null,
): LeadRoutingSettings {
  const data = (raw || {}) as Partial<LeadRoutingSettings>;
  const mode =
    data.mode === "creator" ||
    data.mode === "round_robin" ||
    data.mode === "territory" ||
    data.mode === "least_open"
      ? data.mode
      : DEFAULT_LEAD_ROUTING.mode;
  const includeRoles =
    Array.isArray(data.includeRoles) && data.includeRoles.length
      ? data.includeRoles
      : DEFAULT_LEAD_ROUTING.includeRoles;
  return {
    mode,
    includeRoles,
    includeOwner: Boolean(data.includeOwner),
    territories: data.territories && typeof data.territories === "object" ? data.territories : {},
  };
}

export function eligibleAssignees(
  members: { id: string; role: Role }[],
  settings: LeadRoutingSettings,
): { id: string; role: Role }[] {
  return members.filter((m) => {
    if (m.role === "owner") return settings.includeOwner;
    return settings.includeRoles.includes(m.role);
  });
}

function nextRoundRobin(
  eligible: { id: string }[],
  existing: { assignedTo: string; createdAt: string }[],
): string | null {
  if (!eligible.length) return null;
  const newest = [...existing]
    .filter((l) => eligible.some((e) => e.id === l.assignedTo))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!newest) return eligible[0].id;
  const idx = eligible.findIndex((e) => e.id === newest.assignedTo);
  const next = eligible[(idx + 1) % eligible.length];
  return next.id;
}

function matchTerritory(
  territory: string | undefined,
  settings: LeadRoutingSettings,
  eligible: { id: string }[],
): string | null {
  const needle = (territory || "").trim().toLowerCase();
  if (!needle) return null;
  for (const member of eligible) {
    const tokens = settings.territories[member.id] || [];
    if (tokens.some((t) => needle.includes(t.toLowerCase()) || t.toLowerCase().includes(needle))) {
      return member.id;
    }
  }
  return null;
}

function leastOpen(
  eligible: { id: string }[],
  existing: { assignedTo: string; stage: string }[],
): string | null {
  if (!eligible.length) return null;
  let best = eligible[0].id;
  let bestCount = Infinity;
  for (const member of eligible) {
    const count = existing.filter(
      (l) => l.assignedTo === member.id && WORKING_STAGES.includes(l.stage as LeadStage),
    ).length;
    if (count < bestCount) {
      best = member.id;
      bestCount = count;
    }
  }
  return best;
}

export interface RouteInput {
  plan: PlanId;
  settings: LeadRoutingSettings;
  members: { id: string; role: Role }[];
  existingLeads: { assignedTo: string; stage: string; createdAt: string }[];
  /** Signed-in user creating the lead. Empty for public website capture. */
  creatorId?: string;
  /** Org owner — last resort so website enquiries are never unassigned. */
  fallbackId: string;
  territory?: string;
  /** User picked someone in the form. */
  explicitAssignee?: string;
}

export interface RouteResult {
  assignedTo: string;
  reason: string;
}

export function routeLead(input: RouteInput): RouteResult {
  if (input.explicitAssignee) {
    return { assignedTo: input.explicitAssignee, reason: "Assigned by the person who added the lead" };
  }

  const routingOn = PLAN_FEATURE_FLAGS[input.plan]?.leadRouting;
  if (!routingOn || input.settings.mode === "creator") {
    const id = input.creatorId || input.fallbackId;
    return {
      assignedTo: id,
      reason: routingOn
        ? "Routing is set to the person who adds the lead"
        : "Lead routing is not on this plan — assigned to you",
    };
  }

  const eligible = eligibleAssignees(input.members, input.settings);
  const pool = eligible.length ? eligible : input.members;
  const fallback = pool[0]?.id || input.creatorId || input.fallbackId;

  if (input.settings.mode === "territory") {
    const hit = matchTerritory(input.territory, input.settings, pool);
    if (hit) return { assignedTo: hit, reason: `Territory match · ${input.territory}` };
    const rr = nextRoundRobin(pool, input.existingLeads) || fallback;
    return {
      assignedTo: rr,
      reason: input.territory
        ? "No territory match — used round-robin"
        : "No territory on the lead — used round-robin",
    };
  }

  if (input.settings.mode === "least_open") {
    const id = leastOpen(pool, input.existingLeads) || fallback;
    return { assignedTo: id, reason: "Fewest open pipeline leads" };
  }

  const id = nextRoundRobin(pool, input.existingLeads) || fallback;
  return { assignedTo: id, reason: "Round-robin among eligible agents" };
}

export function prepareNewLead(
  lead: Pick<Lead, "email" | "phone" | "source" | "type" | "priority"> & {
    budget?: number;
    notes?: string;
    phones?: { number?: string }[];
    territory?: string;
    assignedTo?: string;
  },
  route: RouteInput,
): LeadScoreResult & RouteResult {
  const scored = scoreLead(lead);
  const routed = routeLead({
    ...route,
    territory: lead.territory || route.territory,
    explicitAssignee: lead.assignedTo || route.explicitAssignee,
  });
  return { ...scored, ...routed };
}

export function ownerId(members: { id: string; role: Role }[]): string | undefined {
  return members.find((m) => m.role === "owner")?.id;
}

export const ROUTING_MODE_LABELS: Record<LeadRoutingSettings["mode"], string> = {
  creator: "Person who adds the lead",
  round_robin: "Round-robin",
  territory: "Territory, then round-robin",
  least_open: "Fewest open leads",
};

import type { Lead, LeadType, Priority } from "@/types";

export interface ScoreFactor {
  label: string;
  points: number;
}

export interface LeadScoreResult {
  score: number;
  factors: ScoreFactor[];
}

function sourcePoints(source: string): { label: string; points: number } {
  const s = (source || "").toLowerCase();
  if (s.includes("referral")) return { label: "Source · referral", points: 22 };
  if (s.includes("website") || s.includes("web")) return { label: "Source · website", points: 18 };
  if (
    s.includes("rightmove") ||
    s.includes("zoopla") ||
    s.includes("onthemarket") ||
    s.includes("portal") ||
    s.includes("mls") ||
    s.includes("zillow")
  ) {
    return { label: "Source · portal", points: 16 };
  }
  if (s.includes("call") || s.includes("phone") || s.includes("telephony")) {
    return { label: "Source · call", points: 12 };
  }
  if (s.includes("sms") || s.includes("text")) return { label: "Source · SMS", points: 10 };
  if (s.includes("csv") || s.includes("import")) return { label: "Source · import", points: 6 };
  if (s.includes("manual")) return { label: "Source · manual", points: 8 };
  return { label: "Source · other", points: 8 };
}

function typePoints(type: LeadType): { label: string; points: number } {
  switch (type) {
    case "seller":
      return { label: "Type · seller", points: 10 };
    case "landlord":
      return { label: "Type · landlord", points: 8 };
    case "buyer":
      return { label: "Type · buyer", points: 6 };
    case "tenant":
      return { label: "Type · tenant", points: 6 };
    default:
      return { label: "Type", points: 6 };
  }
}

function priorityPoints(priority?: Priority): { label: string; points: number } {
  switch (priority) {
    case "urgent":
      return { label: "Priority · urgent", points: 18 };
    case "high":
      return { label: "Priority · high", points: 14 };
    case "low":
      return { label: "Priority · low", points: 2 };
    default:
      return { label: "Priority · medium", points: 8 };
  }
}

/** Transparent 0–100 score from fields we actually have. Not a black-box model. */
export function scoreLead(
  lead: Pick<Lead, "email" | "phone" | "source" | "type" | "priority"> & {
    budget?: number;
    notes?: string;
    phones?: { number?: string }[];
  },
): LeadScoreResult {
  const factors: ScoreFactor[] = [];
  const phone = lead.phone || lead.phones?.[0]?.number || "";

  if (lead.email?.includes("@")) factors.push({ label: "Has email", points: 10 });
  if (phone.trim()) factors.push({ label: "Has phone", points: 12 });
  if (lead.budget && lead.budget > 0) factors.push({ label: "Has budget", points: 10 });
  if (lead.notes?.trim()) factors.push({ label: "Has notes", points: 5 });

  factors.push(sourcePoints(lead.source));
  factors.push(typePoints(lead.type));
  factors.push(priorityPoints(lead.priority));

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)));
  return { score, factors };
}

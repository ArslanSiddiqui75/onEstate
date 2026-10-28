import type { EmergencyKind, Trade, Urgency } from "@/lib/lettings/types";

export interface TriageResult {
  title: string;
  category: Trade;
  urgency: Urgency;
  emergency: EmergencyKind | null;
  replyBy: string;
  fixBy: string;
  guidance: { title: string; body: string } | null;
}

const EMERGENCY_RULES: { kind: EmergencyKind; pattern: RegExp }[] = [
  {
    kind: "gas",
    pattern:
      /\b(gas leaks?|leak(?:ing|s)? gas|gas (?:is |was |keeps )?(?:leaking|escaping|hissing)|smell(?:s|ing|ed)? (?:of |like )?(?:\w+ ){0,2}gas|gas (?:smell|odou?r)|whiff of gas|hissing gas)\b/i,
  },
  {
    kind: "co",
    pattern: /\b(carbon monoxide|co alarm|co detector|carbon-monoxide)\b/i,
  },
  {
    kind: "electrical",
    pattern:
      /\b(sparks?|sparking|electric shock|shocked|burning socket|exposed wires?|live wires?)\b/i,
  },
  {
    kind: "fire",
    pattern: /\b(fire|flames?|on fire|smoke alarm|burning smell)\b/i,
  },
  {
    kind: "flood",
    pattern:
      /\b(flood(?:ing)?|burst pipe|water pouring|water everywhere|ceiling (?:is )?coming down)\b/i,
  },
];

const CATEGORY_RULES: { category: Trade; pattern: RegExp }[] = [
  {
    category: "pests",
    pattern: /\b(mouse|mice|rat|rats|ants?|cockroach|pest|wasp|wasps|bed ?bugs?|fleas?)\b/i,
  },
  {
    category: "locks",
    pattern: /\b(locks?|keys?|locked out|door won'?t (?:open|lock)|handle)\b/i,
  },
  {
    category: "damp",
    pattern: /\b(damp|mould|mold|condensation|black spots)\b/i,
  },
  {
    category: "appliances",
    pattern:
      /\b(oven|fridge|freezer|washer|washing machine|dishwasher|cooker|hob|tumble dryer)\b/i,
  },
  {
    category: "heating",
    pattern: /\b(boiler|heating|radiators?|thermostat|hot water|immersion)\b/i,
  },
  {
    category: "electrical",
    pattern: /\b(sockets?|lights?|fuse|electrics?|electrical|power|spark|switches?)\b/i,
  },
  {
    category: "plumbing",
    pattern:
      /\b(taps?|leaks?|leaking|toilet|pipes?|drains?|sinks?|showers?|baths?|water|gutters?)\b/i,
  },
];

const CLOCKS: Record<Urgency, { replyHours: number; fixHours: number }> = {
  emergency: { replyHours: 1, fixHours: 24 },
  urgent: { replyHours: 24, fixHours: 24 * 5 },
  routine: { replyHours: 24 * 3, fixHours: 24 * 14 },
};

export function emergencyGuidance(kind: EmergencyKind): { title: string; body: string } {
  switch (kind) {
    case "gas":
      return {
        title: "Gas emergency",
        body: "Leave the building. Don't touch switches. Call the National Gas Emergency Service on 0800 111 999.",
      };
    case "co":
      return {
        title: "Carbon monoxide",
        body: "Get everyone out into fresh air. Call 0800 111 999. Call 999 if anyone feels unwell.",
      };
    case "fire":
      return {
        title: "Fire",
        body: "Get everyone out and call 999. Don't go back in.",
      };
    case "flood":
      return {
        title: "Flood or uncontrolled water",
        body: "Keep clear of water if it is near electrics. If anyone is in danger, call 999. The office is on the clock to stop the leak.",
      };
    case "electrical":
      return {
        title: "Dangerous electrics",
        body: "Don't touch the fitting. Switch off at the mains only if you can do it safely. Call 999 if someone is hurt.",
      };
  }
}

function titleFrom(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const first = (cleaned.split(/[.!\n]/)[0] || cleaned).trim();
  const base = first.length <= 64 ? first : `${first.slice(0, 61).trim()}…`;
  if (!base) return "Repair report";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function categoryFor(text: string, emergency: EmergencyKind | null): Trade {
  if (emergency === "gas" || emergency === "co") return "heating";
  if (emergency === "electrical") return "electrical";
  if (emergency === "flood") return "plumbing";
  if (emergency === "fire") {
    return /\b(socket|wire|electri)/i.test(text) ? "electrical" : "other";
  }
  return CATEGORY_RULES.find((rule) => rule.pattern.test(text))?.category ?? "other";
}

function urgencyFor(text: string, emergency: EmergencyKind | null): Urgency {
  if (emergency) return "emergency";
  if (/\bdrip/i.test(text) && !/\b(burst|flood|pouring)\b/i.test(text)) return "routine";
  if (
    /\b(no heating|boiler (?:is )?(?:dead|broken|not|out)|no hot water|locked out|can(?:not|'t) (?:get in|lock)|lock (?:is )?broken|burst|won'?t stop leaking|water coming through|toilet (?:is )?blocked|no water|power cut|no power|fuse (?:keeps )?tripping)\b/i.test(
      text,
    )
  ) {
    return "urgent";
  }
  if (/\bleak/i.test(text)) return "urgent";
  return "routine";
}

export function triageReport(text: string, now = new Date()): TriageResult {
  const emergency = EMERGENCY_RULES.find((rule) => rule.pattern.test(text))?.kind ?? null;
  const urgency = urgencyFor(text, emergency);
  const clocks = CLOCKS[urgency];
  const at = now.getTime();
  return {
    title: titleFrom(text),
    category: categoryFor(text, emergency),
    urgency,
    emergency,
    replyBy: new Date(at + clocks.replyHours * 3_600_000).toISOString(),
    fixBy: new Date(at + clocks.fixHours * 3_600_000).toISOString(),
    guidance: emergency ? emergencyGuidance(emergency) : null,
  };
}

export function nextReference(references: string[], now = new Date()): string {
  const year = now.getFullYear();
  let max = 0;
  for (const reference of references) {
    const match = /^R-(\d{4})-(\d+)$/.exec(reference.trim().toUpperCase());
    if (match && Number(match[1]) === year) max = Math.max(max, Number(match[2]));
  }
  return `R-${year}-${String(max + 1).padStart(4, "0")}`;
}

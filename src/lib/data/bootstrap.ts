import type { Market, OrgMember, PlanId, Role } from "@/types";
import { defaultSequences } from "@/lib/sequences/catalog";
import {
  newId,
  type WorkspaceOrg,
  type WorkspaceSnapshot,
  type WorkspaceUser,
} from "@/lib/data/workspace-store";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Bootstrap a real empty product workspace (no demo seed data). */
export function createEmptyWorkspace(input: {
  user: WorkspaceUser;
  org: WorkspaceOrg;
}): WorkspaceSnapshot {
  const now = new Date().toISOString();
  const members: OrgMember[] = [
    {
      id: input.user.id,
      name: input.user.name,
      email: input.user.email,
      role: input.user.role,
      avatarInitials: initials(input.user.name),
    },
  ];

  return {
    version: 1,
    org: input.org,
    user: input.user,
    members,
    leads: [],
    contacts: [],
    listings: [],
    deals: [],
    messages: [],
    threads: [],
    callLogs: [],
    sequences: defaultSequences(input.org.id, now).map((seq) => ({
      ...seq,
      id: newId("seq"),
    })),
    automations: [
      {
        id: newId("auto"),
        orgId: input.org.id,
        name: "New lead welcome",
        description: "Greet new leads, create a first-touch task, then wait for a reply.",
        trigger: "lead_created",
        status: "active",
        steps: [
          {
            id: newId("step"),
            type: "send_sms",
            label: "Send welcome SMS",
            config: {
              body: "Hi {{first_name}}, thanks for reaching out — I'll send a few options shortly.",
            },
          },
          {
            id: newId("step"),
            type: "create_task",
            label: "Create follow-up task",
            config: { taskTitle: "First outreach call", channel: "Call" },
          },
          {
            id: newId("step"),
            type: "wait",
            label: "Wait 24 hours",
            config: { delayHours: 24 },
          },
          {
            id: newId("step"),
            type: "notify_owner",
            label: "Notify owner if no reply",
            config: {},
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: newId("auto"),
        orgId: input.org.id,
        name: "Qualified → viewing chase",
        description: "When a lead hits qualified, push a viewing booking sequence.",
        trigger: "stage_changed",
        triggerStage: "qualified",
        status: "active",
        steps: [
          {
            id: newId("step"),
            type: "send_sms",
            label: "Ask for viewing times",
            config: {
              body: "Great news — you're pre-qualified. Which days this week work for viewings?",
            },
          },
          {
            id: newId("step"),
            type: "wait",
            label: "Wait 48 hours",
            config: { delayHours: 48 },
          },
          {
            id: newId("step"),
            type: "create_task",
            label: "Book viewing",
            config: { taskTitle: "Schedule viewing", channel: "Call" },
          },
          {
            id: newId("step"),
            type: "update_stage",
            label: "Move to viewing",
            config: { stage: "viewing" },
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: newId("auto"),
        orgId: input.org.id,
        name: "No-reply re-engage",
        description: "Re-open cold threads after 48 hours of silence.",
        trigger: "no_reply",
        status: "paused",
        steps: [
          {
            id: newId("step"),
            type: "send_sms",
            label: "Soft check-in",
            config: {
              body: "Just checking in — still looking, or should I pause updates for now?",
            },
          },
          {
            id: newId("step"),
            type: "add_tag",
            label: "Tag as cold",
            config: { tag: "cold" },
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    enrollments: [],
    tasks: [],
    website: {
      id: newId("site"),
      orgId: input.org.id,
      headline: `${input.org.name}`,
      tagline: "Find your next home with a team that actually follows through.",
      primaryCta: "Book a valuation",
      phone: "",
      email: input.user.email,
      published: false,
      updatedAt: now,
    },
    socialAccounts: [],
    socialPosts: [],
  };
}

export function createLocalIdentity(input: {
  email: string;
  name?: string;
  orgName?: string;
  plan?: PlanId;
  role?: Role;
  market: Market;
}) {
  const userId = newId("user");
  const orgId = newId("org");
  const user: WorkspaceUser = {
    id: userId,
    name: input.name || input.email.split("@")[0],
    email: input.email,
    role: input.role || "owner",
    orgId,
  };
  const org: WorkspaceOrg = {
    id: orgId,
    name: input.orgName || `${user.name}'s Realty`,
    plan: input.plan || "solo",
    market: input.market,
  };
  return { user, org };
}

import type {
  CallLog,
  Contact,
  ConversationMessage,
  ConversationThread,
  Automation,
  Lead,
  LeadTask,
  Listing,
  MessageSequence,
  OrgMember,
  PlanId,
  Role,
  SequenceEnrollment,
  SocialAccount,
  SocialPost,
  TransactionDeal,
  WebsiteSite,
} from "@/types";

export interface WorkspaceOrg {
  id: string;
  name: string;
  plan: PlanId;
  market: "uk" | "us";
  stripeCustomerId?: string;
  /** Everything below is written only by the Stripe webhook (service role) — never by the client. */
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string;
  lastPaymentStatus?: string;
  lastPaymentAt?: string;
}

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  orgId: string;
}

export interface WorkspaceSnapshot {
  version: number;
  org: WorkspaceOrg;
  user: WorkspaceUser;
  members: OrgMember[];
  leads: Lead[];
  contacts: Contact[];
  listings: Listing[];
  deals: TransactionDeal[];
  messages: ConversationMessage[];
  threads: ConversationThread[];
  callLogs: CallLog[];
  sequences: MessageSequence[];
  automations: Automation[];
  enrollments: SequenceEnrollment[];
  tasks: LeadTask[];
  website: WebsiteSite | null;
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
}

const STORE_PREFIX = "certified_workspace_v1:";

function keyFor(orgId: string) {
  return `${STORE_PREFIX}${orgId}`;
}

export function loadWorkspace(orgId: string): WorkspaceSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyFor(orgId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSnapshot;
  } catch {
    return null;
  }
}

export function saveWorkspace(snapshot: WorkspaceSnapshot) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(snapshot.org.id), JSON.stringify(snapshot));
}

export function deleteWorkspace(orgId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(keyFor(orgId));
}

export function listWorkspaceKeys() {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX));
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

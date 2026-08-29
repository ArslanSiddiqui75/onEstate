import type {
  Automation,
  CallLog,
  Contact,
  ConversationMessage,
  Lead,
  LeadStage,
  Listing,
  ListingStatus,
  MessageSequence,
  OrgMember,
  PlanId,
  SequenceEnrollment,
  TransactionDeal,
} from "@/types";
import type { WorkspaceRepository } from "@/lib/data/repository";
import { mergeDefaultSequences } from "@/lib/sequences/catalog";
import {
  loadWorkspace,
  newId,
  saveWorkspace,
  type WorkspaceOrg,
  type WorkspaceSnapshot,
  type WorkspaceUser,
} from "@/lib/data/workspace-store";

const AUTH_KEY = "certified_workspace_auth_v1";
const EMAIL_INDEX_KEY = "certified_workspace_email_index_v1";

function readAuth(): { user: WorkspaceUser; org: WorkspaceOrg } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as { user: WorkspaceUser; org: WorkspaceOrg }) : null;
  } catch {
    return null;
  }
}

function writeAuth(user: WorkspaceUser, org: WorkspaceOrg) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ user, org }));
  try {
    const index = JSON.parse(
      localStorage.getItem(EMAIL_INDEX_KEY) || "{}",
    ) as Record<string, string>;
    index[user.email.toLowerCase()] = org.id;
    localStorage.setItem(EMAIL_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

function orgIdForEmail(email: string): string | null {
  try {
    const index = JSON.parse(
      localStorage.getItem(EMAIL_INDEX_KEY) || "{}",
    ) as Record<string, string>;
    return index[email.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem(AUTH_KEY);
}

function requireSnapshot(): WorkspaceSnapshot {
  const auth = readAuth();
  if (!auth) throw new Error("Not authenticated");
  const snap = loadWorkspace(auth.org.id);
  if (!snap) throw new Error("Workspace not found");
  if (!snap.website) {
    snap.website = {
      id: newId("site"),
      orgId: snap.org.id,
      headline: snap.org.name,
      tagline: "Find your next home with a team that actually follows through.",
      primaryCta: "Book a valuation",
      phone: "",
      email: snap.user.email,
      published: false,
      updatedAt: new Date().toISOString(),
    };
  }
  if (!snap.socialPosts) snap.socialPosts = [];
  if (!snap.socialAccounts) snap.socialAccounts = [];
  snap.socialPosts = (snap.socialPosts || []).map((post) => ({
    ...post,
    accountIds: Array.isArray(post.accountIds) ? post.accountIds : [],
    media: Array.isArray(post.media) ? post.media : [],
  }));
  if (!snap.contacts) snap.contacts = [];
  if (!snap.tasks) snap.tasks = [];
  if (!Array.isArray(snap.enrollments)) snap.enrollments = [];
  snap.enrollments = (snap.enrollments || []).map((e) => ({
    ...e,
    currentStep: e.currentStep ?? 0,
  }));
  snap.sequences = mergeDefaultSequences(
    snap.sequences || [],
    snap.org.id,
    () => newId("seq"),
  );
  if (!Array.isArray(snap.automations)) {
    const now = new Date().toISOString();
    snap.automations = [
      {
        id: newId("auto"),
        orgId: snap.org.id,
        name: "New lead welcome",
        description: "Greet new leads, create a first-touch task, then wait for a reply.",
        trigger: "lead_created" as const,
        status: "active" as const,
        steps: [
          {
            id: newId("step"),
            type: "send_sms" as const,
            label: "Send welcome SMS",
            config: {
              body: "Hi {{first_name}}, thanks for reaching out — I'll send a few options shortly.",
            },
          },
          {
            id: newId("step"),
            type: "create_task" as const,
            label: "Create follow-up task",
            config: { taskTitle: "First outreach call", channel: "Call" as const },
          },
          {
            id: newId("step"),
            type: "wait" as const,
            label: "Wait 24 hours",
            config: { delayHours: 24 },
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
  return snap;
}

function commit(snap: WorkspaceSnapshot) {
  saveWorkspace(snap);
  writeAuth(snap.user, snap.org);
  return snap;
}

export function createLocalRepository(
  initial?: WorkspaceSnapshot,
): WorkspaceRepository {
  if (initial) {
    saveWorkspace(initial);
    writeAuth(initial.user, initial.org);
  }

  return {
    mode: "local",

    async getSnapshot() {
      const auth = readAuth();
      if (!auth) return null;
      try {
        return requireSnapshot();
      } catch {
        return loadWorkspace(auth.org.id);
      }
    },

    async saveAuth(user, org) {
      writeAuth(user, org);
    },

    async clearAuth() {
      clearAuthStorage();
    },

    async setPlan(plan: PlanId) {
      const snap = requireSnapshot();
      snap.org.plan = plan;
      commit(snap);
      return snap.org;
    },

    async saveLeadRouting(settings) {
      const snap = requireSnapshot();
      snap.org.leadRouting = settings;
      commit(snap);
      writeAuth(snap.user, snap.org);
      return snap.org;
    },

    async listMembers() {
      return requireSnapshot().members;
    },

    async listLeads() {
      return requireSnapshot().leads;
    },

    async createLead(lead) {
      const snap = requireSnapshot();
      const now = new Date().toISOString();
      const created: Lead = {
        ...lead,
        id: newId("lead"),
        createdAt: now,
        updatedAt: now,
      };
      snap.leads = [created, ...snap.leads];
      if (created.nextAction) {
        snap.tasks = [
          {
            id: newId("task"),
            leadId: created.id,
            orgId: snap.org.id,
            title: created.nextAction,
            dueAt: created.nextActionDueAt,
            channel: created.phones?.[0]?.consent === "opted_in" ? "SMS" : "Call",
            status: "open",
          },
          ...snap.tasks,
        ];
      }
      commit(snap);
      return created;
    },

    async updateLeadStage(id: string, stage: LeadStage) {
      const snap = requireSnapshot();
      const idx = snap.leads.findIndex((l) => l.id === id);
      if (idx < 0) throw new Error("Lead not found");
      snap.leads[idx] = {
        ...snap.leads[idx],
        stage,
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.leads[idx];
    },

    async updateLead(id, patch) {
      const snap = requireSnapshot();
      const idx = snap.leads.findIndex((l) => l.id === id);
      if (idx < 0) throw new Error("Lead not found");
      snap.leads[idx] = {
        ...snap.leads[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.leads[idx];
    },

    async listContacts() {
      return requireSnapshot().contacts;
    },

    async createContact(contact) {
      const snap = requireSnapshot();
      const now = new Date().toISOString();
      const created: Contact = {
        ...contact,
        id: newId("contact"),
        createdAt: now,
        updatedAt: now,
      };
      snap.contacts = [created, ...snap.contacts];
      commit(snap);
      return created;
    },

    async updateContact(id, patch) {
      const snap = requireSnapshot();
      const idx = snap.contacts.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error("Contact not found");
      snap.contacts[idx] = {
        ...snap.contacts[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.contacts[idx];
    },

    async deleteContact(id) {
      const snap = requireSnapshot();
      snap.contacts = snap.contacts.filter((c) => c.id !== id);
      commit(snap);
    },

    async listListings() {
      return requireSnapshot().listings;
    },

    async createListing(listing) {
      const snap = requireSnapshot();
      const created: Listing = {
        ...listing,
        id: listing.id || newId("lst"),
        createdAt: listing.createdAt || new Date().toISOString(),
      };
      snap.listings = [created, ...snap.listings];
      commit(snap);
      return created;
    },

    async updateListingStatus(id: string, status: ListingStatus) {
      const snap = requireSnapshot();
      const idx = snap.listings.findIndex((l) => l.id === id);
      if (idx < 0) throw new Error("Listing not found");
      snap.listings[idx] = { ...snap.listings[idx], status };
      commit(snap);
      return snap.listings[idx];
    },

    async updateListing(id, patch) {
      const snap = requireSnapshot();
      const idx = snap.listings.findIndex((l) => l.id === id);
      if (idx < 0) throw new Error("Listing not found");
      snap.listings[idx] = { ...snap.listings[idx], ...patch };
      commit(snap);
      return snap.listings[idx];
    },

    async listDeals() {
      return requireSnapshot().deals;
    },

    async createDeal(deal) {
      const snap = requireSnapshot();
      const created: TransactionDeal = {
        ...deal,
        id: deal.id || newId("deal"),
        updatedAt: new Date().toISOString(),
      };
      snap.deals = [created, ...snap.deals];
      commit(snap);
      return created;
    },

    async updateDealChecklistItem(dealId, checklistId, done) {
      const snap = requireSnapshot();
      const idx = snap.deals.findIndex((d) => d.id === dealId);
      if (idx < 0) throw new Error("Deal not found");
      snap.deals[idx] = {
        ...snap.deals[idx],
        checklist: snap.deals[idx].checklist.map((item) =>
          item.id === checklistId ? { ...item, done } : item,
        ),
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.deals[idx];
    },

    async updateDealMeta(dealId, patch) {
      const snap = requireSnapshot();
      const idx = snap.deals.findIndex((d) => d.id === dealId);
      if (idx < 0) throw new Error("Deal not found");
      snap.deals[idx] = {
        ...snap.deals[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.deals[idx];
    },

    async listMessages(leadId) {
      return requireSnapshot().messages.filter((m) => m.leadId === leadId);
    },

    async appendMessage(message) {
      const snap = requireSnapshot();
      const channel = message.channel === "email" ? "email" : "sms";
      let thread = snap.threads.find(
        (t) => t.leadId === message.leadId && (t.channel || "sms") === channel,
      );
      if (!thread) {
        const lead = snap.leads.find((l) => l.id === message.leadId);
        thread = {
          id: newId("thread"),
          orgId: snap.org.id,
          leadId: message.leadId,
          phoneNumber: channel === "sms" ? lead?.phones?.[0]?.number || lead?.phone || "" : "",
          lastMessageAt: message.sentAt,
          channel,
          email: channel === "email" ? lead?.email : undefined,
        };
        snap.threads = [thread, ...snap.threads];
      }
      const created: ConversationMessage = {
        ...message,
        id: message.id || newId("msg"),
        threadId: thread.id,
        orgId: snap.org.id,
      };
      snap.messages = [...snap.messages, created];
      thread.lastMessageAt = created.sentAt;
      commit(snap);
      return created;
    },

    async listCallLogs(leadId) {
      const logs = requireSnapshot().callLogs;
      return leadId ? logs.filter((l) => l.leadId === leadId) : logs;
    },

    async logCall(input) {
      const snap = requireSnapshot();
      const created: CallLog = {
        ...input,
        id: input.id || newId("call"),
        createdAt: new Date().toISOString(),
      };
      snap.callLogs = [created, ...snap.callLogs];
      commit(snap);
      return created;
    },

    async listSequences() {
      const snap = requireSnapshot();
      const next = mergeDefaultSequences(snap.sequences || [], snap.org.id, () =>
        newId("seq"),
      );
      const changed =
        next.length !== snap.sequences.length ||
        next.some((seq, i) => seq.kind !== snap.sequences[i]?.kind);
      if (changed) {
        snap.sequences = next;
        commit(snap);
      }
      return next;
    },

    async listAutomations() {
      return requireSnapshot().automations;
    },

    async createAutomation(automation) {
      const snap = requireSnapshot();
      const now = new Date().toISOString();
      const created: Automation = {
        ...automation,
        id: newId("auto"),
        createdAt: now,
        updatedAt: now,
      };
      snap.automations = [created, ...snap.automations];
      commit(snap);
      return created;
    },

    async updateAutomation(id, patch) {
      const snap = requireSnapshot();
      const idx = snap.automations.findIndex((a) => a.id === id);
      if (idx < 0) throw new Error("Automation not found");
      snap.automations[idx] = {
        ...snap.automations[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      commit(snap);
      return snap.automations[idx];
    },

    async deleteAutomation(id) {
      const snap = requireSnapshot();
      snap.automations = snap.automations.filter((a) => a.id !== id);
      commit(snap);
    },

    // The automation engine is server-side (service role), so local workspace
    // mode has no runs or engine-written activity to report.
    async listAutomationRuns() {
      return [];
    },

    async listLeadActivities() {
      return [];
    },

    async listEnrollments(leadId) {
      const rows = requireSnapshot().enrollments;
      return leadId ? rows.filter((e) => e.leadId === leadId) : rows;
    },

    async upsertEnrollment(input) {
      const snap = requireSnapshot();
      const existing = snap.enrollments.findIndex(
        (e) => e.leadId === input.leadId && e.sequenceId === input.sequenceId,
      );
      const row: SequenceEnrollment = {
        ...input,
        currentStep: input.currentStep ?? 0,
        id: input.id || newId("enr"),
      };
      if (existing >= 0) snap.enrollments[existing] = row;
      else snap.enrollments = [row, ...snap.enrollments];
      commit(snap);
      return row;
    },

    async createLeadTask(input) {
      const snap = requireSnapshot();
      const created = {
        id: input.id || newId("task"),
        leadId: input.leadId,
        orgId: input.orgId,
        title: input.title,
        dueAt: input.dueAt,
        channel: input.channel,
        status: input.status || "open",
      };
      snap.tasks = [created, ...snap.tasks];
      commit(snap);
      return created;
    },

    async resolveTask(taskId) {
      const snap = requireSnapshot();
      snap.tasks = snap.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "done" } : t,
      );
      commit(snap);
    },

    async listOpenTasks() {
      return requireSnapshot().tasks.filter((t) => t.status === "open");
    },

    async getWebsite() {
      const snap = requireSnapshot();
      return snap.website || null;
    },

    async saveWebsite(site) {
      const snap = requireSnapshot();
      snap.website = { ...site, updatedAt: new Date().toISOString() };
      commit(snap);
      return snap.website;
    },

    async listSocialAccounts() {
      const snap = requireSnapshot();
      return snap.socialAccounts || [];
    },

    async upsertSocialAccount(account) {
      const snap = requireSnapshot();
      if (!snap.socialAccounts) snap.socialAccounts = [];
      if (account.id) {
        const idx = snap.socialAccounts.findIndex((a) => a.id === account.id);
        if (idx >= 0) {
          snap.socialAccounts[idx] = {
            ...snap.socialAccounts[idx],
            ...account,
            id: account.id,
          };
          commit(snap);
          return snap.socialAccounts[idx];
        }
      }
      const created = {
        ...account,
        id: account.id || newId("sacc"),
      };
      snap.socialAccounts = [created, ...snap.socialAccounts];
      commit(snap);
      return created;
    },

    async deleteSocialAccount(id) {
      const snap = requireSnapshot();
      snap.socialAccounts = (snap.socialAccounts || []).filter((a) => a.id !== id);
      commit(snap);
    },

    async listSocialPosts() {
      const snap = requireSnapshot();
      return snap.socialPosts || [];
    },

    async createSocialPost(post) {
      const snap = requireSnapshot();
      if (!snap.socialPosts) snap.socialPosts = [];
      const created = {
        ...post,
        accountIds: post.accountIds || [],
        media: post.media || [],
        id: post.id || newId("post"),
        createdAt: new Date().toISOString(),
      };
      snap.socialPosts = [created, ...snap.socialPosts];
      commit(snap);
      return created;
    },

    async updateSocialPost(id, patch) {
      const snap = requireSnapshot();
      const idx = (snap.socialPosts || []).findIndex((p) => p.id === id);
      if (idx < 0) throw new Error("Post not found");
      snap.socialPosts[idx] = { ...snap.socialPosts[idx], ...patch };
      commit(snap);
      return snap.socialPosts[idx];
    },

    async deleteSocialPost(id) {
      const snap = requireSnapshot();
      snap.socialPosts = (snap.socialPosts || []).filter((p) => p.id !== id);
      commit(snap);
    },
  };
}

export function getLocalAuth() {
  return readAuth();
}

export function findLocalWorkspaceByEmail(email: string) {
  const orgId = orgIdForEmail(email);
  if (!orgId) return null;
  return loadWorkspace(orgId);
}

export type { OrgMember, MessageSequence };

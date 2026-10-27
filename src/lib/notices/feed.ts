import type { Appointment, ClientOffer, FeeRequest } from "@/lib/agency/types";
import type { LettingsBook } from "@/lib/lettings/types";
import { REPAIR_STAGES } from "@/lib/lettings/types";
import { dueLabel, dueState, localToday } from "@/lib/tasks/due";
import type {
  CallLog,
  ConversationMessage,
  Lead,
  LeadTask,
  Listing,
  Market,
  PortalId,
  SocialAccount,
  SocialPost,
  TransactionDeal,
} from "@/types";
import type { TicketPriority, TicketStatus } from "@/lib/admin/ticket-desk";

export type NoticeKind =
  | "conversation"
  | "call"
  | "enquiry"
  | "task"
  | "diary"
  | "offer"
  | "fee"
  | "deal"
  | "listing"
  | "letting"
  | "social"
  | "support";

export type NoticeTone = "danger" | "warning" | "neutral";

export interface Notice {
  id: string;
  kind: NoticeKind;
  label: string;
  title: string;
  detail: string;
  href: string;
  at: string;
  tone: NoticeTone;
  taskId?: string;
}

export interface SupportNotice {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: string;
}

export interface NoticeFeedInput {
  now?: Date;
  market: Market;
  /** Diary in the UK, Calendar in the US. */
  diaryLabel: string;
  access: {
    crm: boolean;
    listings: boolean;
    transactions: boolean;
    social: boolean;
  };
  leads: Lead[];
  messages: ConversationMessage[];
  callLogs: CallLog[];
  tasks: LeadTask[];
  listings: Listing[];
  deals: TransactionDeal[];
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
  appointments: Appointment[];
  offers: ClientOffer[];
  fees: FeeRequest[];
  lettings: LettingsBook | null;
  tickets: SupportNotice[];
}

const PORTAL_LABELS: Record<PortalId, string> = {
  rightmove: "Rightmove",
  zoopla: "Zoopla",
  onthemarket: "OnTheMarket",
  mls: "MLS",
};

const PLATFORM_LABELS: Record<SocialAccount["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

const KIND_ORDER: NoticeKind[] = [
  "conversation",
  "call",
  "enquiry",
  "task",
  "diary",
  "offer",
  "fee",
  "deal",
  "listing",
  "letting",
  "social",
  "support",
];

export function noticeKindLabel(kind: NoticeKind, diaryLabel: string) {
  if (kind === "diary") return diaryLabel;
  if (kind === "enquiry") return "Enquiries";
  if (kind === "conversation") return "Conversations";
  if (kind === "call") return "Calls";
  if (kind === "task") return "Tasks";
  if (kind === "offer") return "Offers";
  if (kind === "fee") return "Fees";
  if (kind === "deal") return "Deals";
  if (kind === "listing") return "Listings";
  if (kind === "letting") return "Lettings";
  if (kind === "social") return "Social";
  return "Support";
}

function clip(text: string, max = 72) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function addDays(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(year, (month || 1) - 1, date || 1);
  next.setDate(next.getDate() + days);
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const d = String(next.getDate()).padStart(2, "0");
  return `${next.getFullYear()}-${m}-${d}`;
}

function toneRank(tone: NoticeTone) {
  return tone === "danger" ? 0 : tone === "warning" ? 1 : 2;
}

export function buildNotices(input: NoticeFeedInput): Notice[] {
  const now = input.now ?? new Date();
  const today = localToday(now);
  const soon = addDays(today, 7);
  const notices: Notice[] = [];
  const leads = input.leads.filter((lead) => lead.market === input.market && !lead.archivedAt);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  const conversationLeads = new Set<string>();
  if (input.access.crm) {
    const byLead = new Map<string, ConversationMessage[]>();
    for (const message of input.messages) {
      const list = byLead.get(message.leadId) || [];
      list.push(message);
      byLead.set(message.leadId, list);
    }
    for (const [leadId, thread] of byLead) {
      const lead = leadById.get(leadId);
      if (!lead) continue;
      const latest = [...thread].sort((a, b) => a.sentAt.localeCompare(b.sentAt)).at(-1);
      if (!latest || latest.direction !== "inbound") continue;
      conversationLeads.add(leadId);
      const channel = latest.channel === "email" ? "Email" : "Text";
      notices.push({
        id: `conversation:${leadId}`,
        kind: "conversation",
        label: "Conversation",
        title: lead.name,
        detail: `${channel} waiting · ${clip(latest.body)}`,
        href: `/app/conversations?lead=${encodeURIComponent(leadId)}`,
        at: latest.sentAt,
        tone: "warning",
      });
    }

    const callsByLead = new Map<string, CallLog[]>();
    for (const call of input.callLogs) {
      if (!call.leadId) continue;
      const list = callsByLead.get(call.leadId) || [];
      list.push(call);
      callsByLead.set(call.leadId, list);
    }
    for (const [leadId, calls] of callsByLead) {
      const lead = leadById.get(leadId);
      if (!lead) continue;
      const latest = [...calls].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      if (!latest || latest.direction !== "inbound") continue;
      if (latest.outcome !== "no_answer" && latest.outcome !== "voicemail") continue;
      const replied = input.messages.some(
        (message) =>
          message.leadId === leadId &&
          message.direction === "outbound" &&
          message.sentAt > latest.createdAt,
      );
      if (replied) continue;
      const missed = latest.outcome === "no_answer";
      notices.push({
        id: `call:${latest.id}`,
        kind: "call",
        label: "Call",
        title: lead.name,
        detail: missed ? `Missed call · ${latest.phoneNumber}` : `Voicemail · ${latest.phoneNumber}`,
        href: `/app/conversations?lead=${encodeURIComponent(leadId)}`,
        at: latest.createdAt,
        tone: missed ? "danger" : "warning",
      });
    }

    for (const lead of leads) {
      if (lead.stage !== "new" || conversationLeads.has(lead.id)) continue;
      notices.push({
        id: `enquiry:${lead.id}`,
        kind: "enquiry",
        label: "Enquiry",
        title: lead.name,
        detail: `New ${lead.type} enquiry · ${lead.source || "office"}`,
        href: `/app/opportunities?lead=${encodeURIComponent(lead.id)}`,
        at: lead.createdAt,
        tone: "neutral",
      });
    }

    for (const task of input.tasks) {
      if (task.status !== "open") continue;
      const lead = leadById.get(task.leadId);
      const state = dueState(task.dueAt, today);
      notices.push({
        id: `task:${task.id}`,
        kind: "task",
        label: "Task",
        title: task.title,
        detail: `${lead?.name || "Lead"} · ${dueLabel(task.dueAt, today)}`,
        href: "/app/tasks",
        at: task.dueAt || "",
        tone: state === "overdue" ? "danger" : state === "today" ? "warning" : "neutral",
        taskId: task.id,
      });
    }
  }

  for (const appointment of input.appointments) {
    const day = appointment.at.slice(0, 10);
    const kind = appointment.kind === "valuation" ? "Valuation" : "Viewing";
    if (appointment.status === "requested") {
      const passed = day < today;
      notices.push({
        id: `diary:${appointment.id}`,
        kind: "diary",
        label: input.diaryLabel,
        title: appointment.clientName,
        detail: passed
          ? `${kind} request · the time has passed · ${appointment.address}`
          : `${kind} request · ${appointment.address}`,
        href: "/app/diary",
        at: appointment.at,
        tone: passed ? "warning" : "neutral",
      });
      continue;
    }
    if (appointment.status === "confirmed" && day === today) {
      notices.push({
        id: `diary:${appointment.id}`,
        kind: "diary",
        label: input.diaryLabel,
        title: appointment.clientName,
        detail: `${kind} today · ${appointment.address}`,
        href: "/app/diary",
        at: appointment.at,
        tone: "warning",
      });
    }
  }

  for (const offer of input.offers) {
    if (offer.status !== "submitted") continue;
    notices.push({
      id: `offer:${offer.id}`,
      kind: "offer",
      label: "Offer",
      title: offer.buyerName,
      detail: `Offer in · ${offer.address}`,
      href: "/app/diary",
      at: offer.at,
      tone: "warning",
    });
  }

  for (const fee of input.fees) {
    if (fee.status !== "requested") continue;
    notices.push({
      id: `fee:${fee.id}`,
      kind: "fee",
      label: "Fee",
      title: fee.label,
      detail: `Fee requested · ${fee.address}`,
      href: "/app/diary",
      at: fee.at,
      tone: "neutral",
    });
  }

  if (input.access.transactions) {
    for (const deal of input.deals) {
      if (deal.market !== input.market || deal.archivedAt) continue;
      const close = deal.targetCloseDate?.slice(0, 10);
      const choices: { detail: string; tone: NoticeTone; at: string }[] = [];
      if (deal.complianceStatus === "blocked") {
        choices.push({ detail: "Compliance is blocked", tone: "danger", at: deal.updatedAt });
      } else if (deal.complianceStatus === "attention") {
        choices.push({ detail: "Compliance needs a look", tone: "warning", at: deal.updatedAt });
      }
      if (deal.eSignStatus === "sent") {
        choices.push({ detail: "Signature is still out", tone: "warning", at: deal.updatedAt });
      }
      if (close && close < today) {
        choices.push({ detail: "Close date has passed", tone: "danger", at: deal.updatedAt });
      } else if (close && close <= soon) {
        choices.push({ detail: "Closing this week", tone: "warning", at: deal.updatedAt });
      }
      if (!choices.length) continue;
      const pick = choices.reduce((best, item) => (toneRank(item.tone) < toneRank(best.tone) ? item : best));
      notices.push({
        id: `deal:${deal.id}`,
        kind: "deal",
        label: "Deal",
        title: deal.listingTitle,
        detail: pick.detail,
        href: "/app/opportunities?view=deals",
        at: pick.at,
        tone: pick.tone,
      });
    }
  }

  if (input.access.listings) {
    for (const listing of input.listings) {
      if (listing.market !== input.market || listing.archivedAt) continue;
      const failed = listing.portals.filter((portal) => portal.status === "error");
      const compliance = (listing.complianceIssues || []).length > 0;
      if (!failed.length && !compliance) continue;
      const names = failed.map((portal) => PORTAL_LABELS[portal.portal]).join(" and ");
      notices.push({
        id: `listing:${listing.id}`,
        kind: "listing",
        label: "Listing",
        title: listing.title,
        detail: failed.length
          ? `${names} ${failed.length === 1 ? "needs" : "need"} a retry`
          : "Compliance needs a look",
        href: "/app/listings",
        at: listing.lastSyncAt || listing.createdAt,
        tone: failed.length ? "danger" : "warning",
      });
    }
  }

  if (input.market === "uk" && input.lettings) {
    const address = new Map(input.lettings.properties.map((property) => [property.id, property.address]));
    for (const repair of input.lettings.repairs) {
      if (repair.status === "fixed" || repair.status === "tenant_confirmed") continue;
      const stage = REPAIR_STAGES.find((item) => item.id === repair.status)?.label || repair.status;
      const urgent = repair.urgency === "emergency" || repair.emergency;
      notices.push({
        id: `letting:repair:${repair.id}`,
        kind: "letting",
        label: "Letting",
        title: repair.title,
        detail: `${address.get(repair.propertyId) || "Property"} · ${stage}`,
        href: "/app/lettings",
        at: repair.createdAt,
        tone: urgent ? "danger" : repair.urgency === "urgent" ? "warning" : "neutral",
      });
    }
    for (const item of input.lettings.compliance) {
      if (item.status !== "overdue" && item.status !== "due") continue;
      notices.push({
        id: `letting:certificate:${item.id}`,
        kind: "letting",
        label: "Letting",
        title: item.title,
        detail: `${address.get(item.propertyId) || "Property"} · ${item.status === "overdue" ? "Overdue" : "Due"}`,
        href: "/app/lettings",
        at: item.dueAt,
        tone: item.status === "overdue" ? "danger" : "warning",
      });
    }
    for (const property of input.lettings.properties) {
      for (const room of property.rooms) {
        if (room.rentStatus === "late") {
          notices.push({
            id: `letting:rent:${room.id}`,
            kind: "letting",
            label: "Letting",
            title: room.tenantName,
            detail: `Rent is late · ${property.address}`,
            href: "/app/lettings",
            at: room.paidAt || "",
            tone: "danger",
          });
        }
        if (room.rightToRent === "expired") {
          notices.push({
            id: `letting:rent-check:${room.id}`,
            kind: "letting",
            label: "Letting",
            title: room.tenantName,
            detail: `Right to rent has expired · ${property.address}`,
            href: "/app/lettings",
            at: "",
            tone: "danger",
          });
        }
      }
    }
  }

  if (input.access.social) {
    for (const post of input.socialPosts) {
      const missed = post.status === "scheduled" && post.scheduledFor && post.scheduledFor.slice(0, 10) < today;
      if (post.status !== "failed" && !missed) continue;
      notices.push({
        id: `social:post:${post.id}`,
        kind: "social",
        label: "Social",
        title: clip(post.caption || "Social post", 48),
        detail: post.status === "failed" ? post.lastError || "Failed to publish" : "Missed its scheduled time",
        href: "/app/social",
        at: post.scheduledFor || post.createdAt,
        tone: "danger",
      });
    }
    for (const account of input.socialAccounts) {
      if (account.status !== "expired" && !account.lastError) continue;
      notices.push({
        id: `social:account:${account.id}`,
        kind: "social",
        label: "Social",
        title: account.displayName,
        detail: account.lastError || `${PLATFORM_LABELS[account.platform]} connection expired`,
        href: "/app/settings/social",
        at: account.connectedAt || "",
        tone: "warning",
      });
    }
  }

  for (const ticket of input.tickets) {
    if (ticket.status !== "open" && ticket.status !== "pending") continue;
    const waiting = ticket.status === "pending";
    const high = ticket.priority === "high";
    notices.push({
      id: `support:${ticket.id}`,
      kind: "support",
      label: "Support",
      title: ticket.subject,
      detail: waiting ? "Waiting on you" : "Open with support",
      href: `/app/settings/support/${encodeURIComponent(ticket.id)}`,
      at: ticket.updatedAt,
      tone: waiting && high ? "danger" : waiting || high ? "warning" : "neutral",
    });
  }

  return notices.sort(
    (a, b) => toneRank(a.tone) - toneRank(b.tone) || b.at.localeCompare(a.at) || a.title.localeCompare(b.title),
  );
}

export function noticeKinds(notices: Notice[], diaryLabel: string) {
  const present = new Set(notices.map((notice) => notice.kind));
  return KIND_ORDER.filter((kind) => present.has(kind)).map((kind) => ({
    kind,
    label: noticeKindLabel(kind, diaryLabel),
    count: notices.filter((notice) => notice.kind === kind).length,
  }));
}

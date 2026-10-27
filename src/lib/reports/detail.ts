import type { AgencyBook } from "@/lib/agency/types";
import { PORTAL_ROLE_LABELS } from "@/lib/agency/types";
import { gbp } from "@/lib/lettings/format";
import { insuranceExpired, placeLabel, rentSummary } from "@/lib/lettings/book";
import {
  CHANNEL_LABELS,
  COMPLIANCE_LABELS,
  INSPECTION_LABELS,
  JURISDICTION_LABELS,
  REPAIR_STAGES,
  TRADE_LABELS,
  URGENCY_LABELS,
  type LettingsBook,
} from "@/lib/lettings/types";
import { PORTAL_LABEL } from "@/lib/portals/connections";
import { rowsToCsv, snapshotCutoff, type SnapshotRange } from "@/lib/reports/snapshot";
import { dueLabel, dueState, localToday } from "@/lib/tasks/due";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { formatMoney } from "@/lib/utils";
import type {
  Automation,
  CallLog,
  Contact,
  ConversationMessage,
  Lead,
  LeadTask,
  Listing,
  Market,
  MessageSequence,
  OrgMember,
  PortalConnection,
  SequenceEnrollment,
  SocialAccount,
  SocialPost,
  TransactionDeal,
  WebsiteSite,
} from "@/types";

export interface ReportFact {
  label: string;
  value: string;
}

export interface ReportRecord {
  title: string;
  detail: string;
  note?: string;
}

export interface ReportGroup {
  title: string;
  records: ReportRecord[];
  empty: string;
}

export interface ReportSection {
  id: string;
  title: string;
  summary: string;
  facts: ReportFact[];
  groups: ReportGroup[];
}

export interface ReportOverview {
  label: string;
  value: string;
  hint: string;
}

export interface WorkspaceReport {
  headline: string;
  overview: ReportOverview[];
  sections: ReportSection[];
}

export interface WorkspaceReportInput {
  range: SnapshotRange;
  market: Market;
  now?: number;
  orgName: string;
  members: OrgMember[];
  leads: Lead[];
  contacts: Contact[];
  listings: Listing[];
  deals: TransactionDeal[];
  messages: ConversationMessage[];
  callLogs: CallLog[];
  sequences: MessageSequence[];
  automations: Automation[];
  enrollments: SequenceEnrollment[];
  tasks: LeadTask[];
  website: WebsiteSite | null;
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
  portals: PortalConnection[];
  agency: AgencyBook | null;
  /** Null while the lettings book is still loading. Omitted entirely outside the UK book. */
  lettings: LettingsBook | null;
}

const LEAD_STAGE: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  viewing: "Viewing",
  offer: "Offer",
  won: "Won",
  lost: "Lost",
};
const LEAD_TYPE: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  landlord: "Landlord",
  tenant: "Tenant",
};
const LISTING_STATUS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  under_offer: "Under offer",
  sold: "Sold",
  let: "Let",
  withdrawn: "Withdrawn",
};
const PRIORITY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
const CONTACT_CATEGORY: Record<string, string> = {
  lead: "Lead",
  client: "Client",
  past_client: "Past client",
  vendor: "Vendor",
  partner: "Partner",
  other: "Other",
};
const ESIGN: Record<string, string> = {
  not_started: "E-sign not started",
  sent: "E-sign sent",
  signed: "E-sign signed",
  voided: "E-sign voided",
};
const LEDGER: Record<string, string> = {
  not_started: "Ledger not started",
  in_progress: "Ledger in progress",
  reconciled: "Ledger reconciled",
};
const DEAL_COMPLIANCE: Record<string, string> = {
  on_track: "Compliance on track",
  attention: "Compliance needs attention",
  blocked: "Compliance blocked",
};
const SEQUENCE_KIND: Record<string, string> = {
  follow_up: "Follow-up",
  nurture: "Nurture",
  custom: "Custom",
};
const FLOW_STATUS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
};
const TRIGGER: Record<string, string> = {
  lead_created: "When a lead is created",
  stage_changed: "When a stage changes",
  lead_contacted: "When a lead is contacted",
  no_reply: "When there is no reply",
  manual: "Manual",
};
const CALL_OUTCOME: Record<string, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No answer",
  logged: "Logged",
};
const MESSAGE_STATUS: Record<string, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  received: "Received",
};
const SOCIAL_STATUS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  connected: "Connected",
  disconnected: "Disconnected",
  expired: "Expired",
};
const PLATFORM: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};
const TENANCY_STAGE: Record<string, string> = {
  marketing: "Marketing",
  let_agreed: "Let agreed",
  move_in: "Move-in",
  active: "Active",
  move_out: "Move-out",
};
const RENT_STATUS: Record<string, string> = {
  received: "Received",
  late: "Late",
  due: "Due",
};
const RIGHT_TO_RENT: Record<string, string> = {
  clear: "Right to Rent clear",
  pending: "Right to Rent pending",
  expired: "Right to Rent expired",
};
const COMPLIANCE_STATUS: Record<string, string> = {
  ok: "In date",
  due: "Due",
  overdue: "Overdue",
  proof_held: "Proof held",
};
const APPOINTMENT_STATUS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  done: "Done",
  cancelled: "Cancelled",
};
const OFFER_STATUS: Record<string, string> = {
  submitted: "Submitted",
  accepted: "Accepted",
  declined: "Declined",
};
const FEE_STATUS: Record<string, string> = {
  requested: "Requested",
  received: "Received",
};
const REFERRAL_STATUS: Record<string, string> = {
  introduced: "Introduced",
  agreed: "Agreed",
  paid: "Paid",
};
const DOMAIN_STATUS: Record<string, string> = {
  none: "No domain",
  pending: "Domain pending",
  verifying: "Domain verifying",
  connected: "Domain connected",
  failed: "Domain failed",
};
const SSL_STATUS: Record<string, string> = {
  none: "No SSL",
  provisioning: "SSL provisioning",
  active: "SSL active",
  error: "SSL error",
};

function named(map: Record<string, string>, value: string | undefined, fallback = "—") {
  if (!value) return fallback;
  return map[value] || value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function join(parts: Array<string | false | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

function snippet(text: string | undefined, length = 140) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

function tally(labels: string[]): ReportFact[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, value: String(count) }));
}

function stamp(iso: string | undefined, market: Market) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  return new Intl.DateTimeFormat(market === "uk" ? "en-GB" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function day(iso: string | undefined, market: Market) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "";
  return new Intl.DateTimeFormat(market === "uk" ? "en-GB" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function money(amount: number | undefined, market: Market) {
  if (amount == null || !Number.isFinite(amount)) return "";
  return formatMoney(amount, market);
}

function cash(amount: number, currency: "GBP" | "USD") {
  return formatMoney(amount, currency === "GBP" ? "uk" : "us");
}

function duration(seconds?: number) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}s`;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function group(title: string, records: ReportRecord[], empty: string): ReportGroup {
  return { title, records, empty };
}

function section(
  id: string,
  title: string,
  summary: string,
  facts: ReportFact[],
  groups: ReportGroup[],
): ReportSection {
  return { id, title, summary, facts, groups };
}

export function buildWorkspaceReport(input: WorkspaceReportInput): WorkspaceReport {
  const now = input.now ?? Date.now();
  const cutoff = snapshotCutoff(input.range, now);
  const today = localToday(new Date(now));
  const market = input.market;
  const span = cutoff === null ? null : now - cutoff;
  const dated = (iso: string | undefined) => {
    if (cutoff === null) return true;
    if (!iso) return false;
    const time = Date.parse(iso);
    return Number.isFinite(time) && time >= cutoff && time <= now;
  };
  const upcoming = (iso: string | undefined) => {
    if (cutoff === null) return true;
    if (!iso || span === null) return false;
    const time = Date.parse(iso);
    return Number.isFinite(time) && time >= cutoff && time <= now + span;
  };
  const names = new Map(input.members.map((member) => [member.id, member.name]));
  const who = (id?: string) => (id && names.get(id)) || "Unassigned";
  const region = market === "uk" ? "UK book" : "US book";
  const diary = market === "uk" ? "Diary" : "Calendar";
  const viewing = market === "uk" ? "Viewing" : "Showing";

  const marketLeads = input.leads.filter((lead) => lead.market === market);
  const otherLeadIds = new Set(
    input.leads.filter((lead) => lead.market !== market).map((lead) => lead.id),
  );
  const onThisBook = (leadId?: string) => !leadId || !otherLeadIds.has(leadId);
  const listingTitle = new Map(input.listings.map((listing) => [listing.id, listing.title]));

  const rangedLeads = marketLeads.filter((lead) => dated(lead.createdAt));
  const openLeads = rangedLeads.filter((lead) => !lead.archivedAt);
  const archivedLeads = rangedLeads.filter((lead) => lead.archivedAt);
  const budget = openLeads.reduce((sum, lead) => sum + (lead.budget || 0), 0);
  const liveLeads = marketLeads.filter((lead) => !lead.archivedAt && lead.stage !== "won" && lead.stage !== "lost");

  const rangedListings = input.listings.filter(
    (listing) => listing.market === market && dated(listing.createdAt),
  );
  const liveListings = rangedListings.filter((listing) => !listing.archivedAt);
  const stock = liveListings.reduce((sum, listing) => sum + (listing.price || 0), 0);

  const rangedDeals = input.deals.filter((deal) => deal.market === market && dated(deal.updatedAt));
  const liveDeals = rangedDeals.filter((deal) => !deal.archivedAt);
  const pipeline = liveDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  const bookTasks = input.tasks.filter((task) => onThisBook(task.leadId));
  const rangedTasks = bookTasks.filter((task) => {
    if (cutoff === null) return true;
    if (task.status === "open" && dueState(task.dueAt, today) === "overdue") return true;
    if (task.dueAt) return upcoming(task.dueAt);
    return task.status === "open";
  });
  const openTasks = rangedTasks.filter((task) => task.status === "open");
  const overdueTasks = openTasks.filter((task) => dueState(task.dueAt, today) === "overdue");

  const rangedCalls = input.callLogs.filter(
    (call) => onThisBook(call.leadId) && dated(call.createdAt),
  );
  const rangedMessages = input.messages.filter(
    (message) => onThisBook(message.leadId) && dated(message.sentAt),
  );

  const appointments = (input.agency?.appointments ?? []).filter((item) => upcoming(item.at));
  const offers = (input.agency?.offers ?? []).filter((item) => dated(item.at));
  const openRepairs = (input.lettings?.repairs ?? []).filter(
    (repair) => repair.status !== "fixed" && repair.status !== "tenant_confirmed",
  );

  const rangeLabel =
    input.range === "all" ? "All time" : input.range === "7d" ? "Last 7 days" : input.range === "30d" ? "Last 30 days" : "Last 90 days";

  const overview: ReportOverview[] = [
    {
      label: "Opportunities",
      value: String(openLeads.length),
      hint: budget > 0 ? `${money(budget, market)} stated budget` : archivedLeads.length ? `${archivedLeads.length} archived` : "No budgets set",
    },
    {
      label: "Listings",
      value: String(liveListings.length),
      hint: stock > 0 ? `${money(stock, market)} on the market` : "No asking prices",
    },
    {
      label: "Deals",
      value: String(liveDeals.length),
      hint: pipeline > 0 ? `${money(pipeline, market)} pipeline` : "No deal value",
    },
    {
      label: "Open tasks",
      value: String(openTasks.length),
      hint: overdueTasks.length ? `${overdueTasks.length} overdue` : "Nothing overdue",
    },
    {
      label: diary,
      value: String(appointments.length),
      hint: offers.length ? `${offers.length} offer${offers.length === 1 ? "" : "s"}` : "No offers in range",
    },
    input.market === "uk"
      ? {
          label: "Open repairs",
          value: String(openRepairs.length),
          hint: input.lettings ? `Live · ${rentSummary(input.lettings).collectedPct}% rent in` : "Lettings book",
        }
      : {
          label: "Calls",
          value: String(rangedCalls.length),
          hint: `${rangedMessages.length} message${rangedMessages.length === 1 ? "" : "s"}`,
        },
  ];

  const leadName = new Map(input.leads.map((lead) => [lead.id, lead.name]));

  function opportunitiesSection(): ReportSection {
    const records = [...rangedLeads]
      .sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)) || b.score - a.score)
      .map((lead) => ({
        title: lead.name,
        detail: join([
          named(LEAD_TYPE, lead.type),
          named(LEAD_STAGE, lead.stage),
          lead.source ? `Source ${named({}, lead.source)}` : "",
          who(lead.assignedTo),
          lead.listingId ? listingTitle.get(lead.listingId) || "Linked property" : "",
          lead.budget ? money(lead.budget, market) : "",
          lead.priority ? named(PRIORITY, lead.priority) : "",
          `Score ${lead.score}`,
          lead.archivedAt ? "Archived" : "",
        ]),
        note: join([
          lead.nextAction ? `Next: ${lead.nextAction}` : "",
          lead.nextActionDueAt ? dueLabel(lead.nextActionDueAt, today) : "",
          lead.tags?.length ? lead.tags.join(", ") : "",
          snippet(lead.notes),
        ]) || undefined,
      }));
    return section(
      "opportunities",
      "Opportunities",
      join([
        `${openLeads.length} open`,
        budget > 0 ? `${money(budget, market)} of stated budget` : "",
        archivedLeads.length ? `${archivedLeads.length} archived` : "",
        "Website, portal, and office enquiries are in this list.",
      ]),
      [
        ...tally(openLeads.map((lead) => named(LEAD_STAGE, lead.stage))),
        ...tally(openLeads.map((lead) => named(LEAD_TYPE, lead.type))).map((fact) => ({
          ...fact,
          label: fact.label,
        })),
      ],
      [group("", records, "No opportunities in this range.")],
    );
  }

  function contactsSection(): ReportSection {
    const rows = input.contacts.filter((contact) => contact.market === market && dated(contact.createdAt));
    return section(
      "contacts",
      "Contacts",
      rows.length ? `${rows.length} contact${rows.length === 1 ? "" : "s"} in this range.` : "No contacts in this range.",
      tally(rows.map((contact) => named(CONTACT_CATEGORY, contact.category))),
      [
        group(
          "",
          rows.map((contact) => ({
            title: contact.name,
            detail: join([
              named(CONTACT_CATEGORY, contact.category),
              contact.company,
              contact.email,
              contact.phone,
              contact.assignedTo ? who(contact.assignedTo) : "",
              contact.tags.length ? contact.tags.join(", ") : "",
            ]),
            note: join([
              contact.lastContactedAt ? `Last contact ${day(contact.lastContactedAt, market)}` : "",
              snippet(contact.notes),
            ]) || undefined,
          })),
          "No contacts in this range.",
        ),
      ],
    );
  }

  function listingsSection(): ReportSection {
    const issues = liveListings.reduce((sum, listing) => sum + (listing.complianceIssues?.length || 0), 0);
    const records = [...rangedListings]
      .sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)) || b.price - a.price)
      .map((listing) => {
        const errors = listing.portals.filter((portal) => portal.status === "error");
        const synced = listing.portals.filter((portal) => portal.status === "synced").length;
        return {
          title: listing.title,
          detail: join([
            named(LISTING_STATUS, listing.status),
            money(listing.price, market),
            listing.city,
            listing.beds || listing.baths ? `${listing.beds} bed · ${listing.baths} bath` : "",
            listing.sqft ? `${listing.sqft.toLocaleString(market === "uk" ? "en-GB" : "en-US")} sq ft` : "",
            listing.tenure === "freehold" ? "Freehold" : listing.tenure === "leasehold" ? "Leasehold" : "",
            who(listing.agentId),
            listing.archivedAt ? "Archived" : "",
          ]),
          note: join([
            errors.length
              ? `Portal error on ${errors.map((portal) => PORTAL_LABEL[portal.portal]).join(", ")}`
              : listing.portals.length
                ? `${synced} of ${listing.portals.length} portals synced`
                : "",
            listing.complianceIssues?.length ? listing.complianceIssues.join("; ") : "",
            listing.syncReadiness != null ? `Readiness ${listing.syncReadiness}%` : "",
            listing.nextMilestone,
            listing.mlsDisclosureComplete === false ? "MLS disclosure incomplete" : "",
          ]) || undefined,
        };
      });
    return section(
      "listings",
      "Listings",
      join([
        `${liveListings.length} live`,
        stock > 0 ? `${money(stock, market)} asking prices` : "",
        issues ? `${issues} compliance note${issues === 1 ? "" : "s"}` : "",
        rangedListings.length - liveListings.length
          ? `${rangedListings.length - liveListings.length} archived`
          : "",
      ]),
      tally(liveListings.map((listing) => named(LISTING_STATUS, listing.status))),
      [group("", records, "No listings in this range.")],
    );
  }

  function dealsSection(): ReportSection {
    const records = [...rangedDeals]
      .sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)) || b.value - a.value)
      .map((deal) => {
        const done = deal.checklist.filter((item) => item.done).length;
        const openItems = deal.checklist.filter((item) => !item.done).map((item) => item.label);
        return {
          title: deal.listingTitle,
          detail: join([
            deal.stage,
            money(deal.value, market),
            deal.parties.length ? deal.parties.join(", ") : "",
            named(ESIGN, deal.eSignStatus),
            deal.checklist.length ? `${done} of ${deal.checklist.length} checklist` : "",
            deal.riskLevel ? `${named(PRIORITY, deal.riskLevel)} risk` : "",
            deal.complianceStatus ? named(DEAL_COMPLIANCE, deal.complianceStatus) : "",
            deal.ledgerStatus ? named(LEDGER, deal.ledgerStatus) : "",
            deal.coordinator ? who(deal.coordinator) : "",
            deal.targetCloseDate ? `Target ${day(deal.targetCloseDate, market)}` : "",
            deal.archivedAt ? "Archived" : "",
          ]),
          note: join([
            openItems.length ? `Still open: ${openItems.join(", ")}` : deal.checklist.length ? "Checklist complete" : "",
            snippet(deal.notes),
          ]) || undefined,
        };
      });
    return section(
      "deals",
      "Deals",
      join([
        `${liveDeals.length} live`,
        pipeline > 0 ? `${money(pipeline, market)} pipeline` : "",
        rangedDeals.length - liveDeals.length ? `${rangedDeals.length - liveDeals.length} archived` : "",
      ]),
      tally(liveDeals.map((deal) => deal.stage || "No stage")),
      [group("", records, "No deals in this range.")],
    );
  }

  function tasksSection(): ReportSection {
    const rank = { overdue: 0, today: 1, later: 2, none: 3 };
    const records = [...rangedTasks]
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "open" ? -1 : 1;
        return rank[dueState(a.dueAt, today)] - rank[dueState(b.dueAt, today)];
      })
      .map((task) => ({
        title: task.title,
        detail: join([
          task.status === "open" ? "Open" : "Done",
          leadName.get(task.leadId) || "No lead",
          task.channel,
          dueLabel(task.dueAt, today),
        ]),
      }));
    return section(
      "tasks",
      "Tasks",
      join([
        `${openTasks.length} open`,
        `${rangedTasks.length - openTasks.length} done`,
        overdueTasks.length ? `${overdueTasks.length} overdue` : "",
        cutoff ? "Undated open tasks stay visible on every range." : "",
      ]),
      tally(openTasks.map((task) => task.channel)),
      [group("", records, "No tasks in this range.")],
    );
  }

  function callsSection(): ReportSection {
    const connected = rangedCalls.filter((call) => call.outcome === "connected");
    const seconds = connected.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
    const records = [...rangedCalls]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((call) => ({
        title: leadName.get(call.leadId || "") || call.phoneNumber || "Call",
        detail: join([
          stamp(call.createdAt, market),
          call.direction === "inbound" ? "Inbound" : "Outbound",
          named(CALL_OUTCOME, call.outcome),
          duration(call.durationSeconds),
          call.phoneNumber,
        ]),
        note: snippet(call.notes) || undefined,
      }));
    return section(
      "calls",
      "Calls",
      join([
        `${rangedCalls.length} logged`,
        `${connected.length} connected`,
        seconds ? duration(seconds) + " connected" : "",
      ]),
      tally(rangedCalls.map((call) => named(CALL_OUTCOME, call.outcome))),
      [group("", records, "No calls in this range.")],
    );
  }

  function messagesSection(): ReportSection {
    const channelOf = (message: ConversationMessage) => (message.channel === "email" ? "Email" : "SMS");
    const failed = rangedMessages.filter((message) => message.status === "failed").length;
    const records = [...rangedMessages]
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      .map((message) => ({
        title: leadName.get(message.leadId) || "Message",
        detail: join([
          stamp(message.sentAt, market),
          channelOf(message),
          message.direction === "inbound" ? "In" : message.direction === "outbound" ? "Out" : "System",
          named(MESSAGE_STATUS, message.status),
          message.subject,
        ]),
        note: snippet(message.body) || undefined,
      }));
    return section(
      "messages",
      "Messages",
      join([
        `${rangedMessages.length} in this range`,
        `${rangedMessages.filter((message) => channelOf(message) === "SMS").length} SMS`,
        `${rangedMessages.filter((message) => channelOf(message) === "Email").length} email`,
        failed ? `${failed} failed` : "",
      ]),
      tally(rangedMessages.map(channelOf)),
      [group("", records, "No messages in this range.")],
    );
  }

  function diarySection(): ReportSection {
    const referrals = input.agency?.referrals ?? [];
    const portals = input.agency?.portals ?? [];
    const fees = (input.agency?.fees ?? []).filter((fee) => dated(fee.at));
    return section(
      diary.toLowerCase(),
      diary,
      input.agency
        ? join([
            `${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`,
            `${offers.length} offer${offers.length === 1 ? "" : "s"}`,
            `${fees.length} fee${fees.length === 1 ? "" : "s"}`,
            "Referrals and client portals are the live book.",
          ])
        : "Reading the diary…",
      tally(appointments.map((item) => (item.kind === "viewing" ? viewing : "Valuation"))),
      [
        group(
          "Appointments",
          [...appointments]
            .sort((a, b) => a.at.localeCompare(b.at))
            .map((item) => ({
              title: `${item.kind === "viewing" ? viewing : "Valuation"} · ${item.clientName}`,
              detail: join([
                stamp(item.at, market),
                named(APPOINTMENT_STATUS, item.status),
                item.address,
                item.email,
                item.phone,
              ]),
              note: snippet(item.notes) || undefined,
            })),
          "No appointments in this range.",
        ),
        group(
          "Offers",
          offers.map((offer) => ({
            title: `${offer.buyerName} · ${cash(offer.amount, offer.currency)}`,
            detail: join([stamp(offer.at, market), named(OFFER_STATUS, offer.status), offer.address]),
            note: snippet(offer.notes) || undefined,
          })),
          "No offers in this range.",
        ),
        group(
          "Fees",
          fees.map((fee) => ({
            title: `${fee.label} · ${cash(fee.amount, fee.currency)}`,
            detail: join([stamp(fee.at, market), named(FEE_STATUS, fee.status), fee.address]),
          })),
          "No fees in this range.",
        ),
        group(
          "Referrals",
          referrals.map((referral) => ({
            title: `${referral.introducer} · ${cash(referral.fee, referral.currency)}`,
            detail: join([named(REFERRAL_STATUS, referral.status), referral.address]),
          })),
          "No referrals.",
        ),
        group(
          "Client portals",
          portals.map((portal) => ({
            title: `${portal.name} · ${PORTAL_ROLE_LABELS[portal.role]}`,
            detail: join([portal.address, portal.approvedAt ? `Approved ${day(portal.approvedAt, market)}` : "Waiting on approval"]),
            note: snippet(portal.feedback) || undefined,
          })),
          "No client portals.",
        ),
      ],
    );
  }

  function lettingsSection(): ReportSection {
    if (!input.lettings) {
      return section("lettings", "Lettings", "Reading the lettings book…", [], []);
    }
    const book = input.lettings;
    const rent = rentSummary(book);
    const repairs = book.repairs.filter((repair) => dated(repair.createdAt));
    const compliance = book.compliance.filter(
      (item) => item.status === "overdue" || upcoming(item.dueAt),
    );
    const inspections = book.inspections.filter((item) => upcoming(item.at));
    const propertyName = new Map(book.properties.map((property) => [property.id, property.address]));
    return section(
      "lettings",
      "Lettings",
      join([
        `${gbp(rent.received)} received`,
        `${gbp(rent.late)} late`,
        `${gbp(rent.due)} due`,
        `${rent.collectedPct}% of ${gbp(rent.booked)} booked`,
        "Properties, rent, keys, and contractors are live. Repairs and inspections follow the range. Overdue certificates stay visible.",
      ]),
      [
        { label: "Properties", value: String(book.properties.length) },
        { label: "Open repairs", value: String(openRepairs.length) },
        { label: "Overdue certificates", value: String(book.compliance.filter((item) => item.status === "overdue").length) },
      ],
      [
        group(
          "Properties",
          book.properties.map((property) => ({
            title: property.address,
            detail: join([
              property.city,
              property.postcode,
              named(JURISDICTION_LABELS, property.jurisdiction),
              named(TENANCY_STAGE, property.tenancyStage || "active"),
              property.hmo ? "HMO" : "",
            ]),
            note: property.rooms
              .map((room) =>
                join([
                  room.name,
                  room.tenantName,
                  `${gbp(room.rentPcm)} pcm`,
                  named(RENT_STATUS, room.rentStatus),
                  room.rightToRent ? named(RIGHT_TO_RENT, room.rightToRent) : "",
                  room.depositProtected ? room.depositScheme || "Deposit protected" : "Deposit not protected",
                ]),
              )
              .join("\n") || undefined,
          })),
          "No lets on the book.",
        ),
        group(
          "Repairs",
          [...repairs]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((repair) => ({
              title: `${repair.reference} · ${repair.title}`,
              detail: join([
                placeLabel(book, repair.propertyId, repair.roomId),
                named(URGENCY_LABELS, repair.urgency),
                REPAIR_STAGES.find((stage) => stage.id === repair.status)?.label || repair.status,
                named(TRADE_LABELS, repair.category),
                named(CHANNEL_LABELS, repair.channel),
                repair.tradesperson,
                repair.appointmentAt ? `Visit ${stamp(repair.appointmentAt, market)}` : "",
              ]),
              note: snippet(repair.body) || undefined,
            })),
          "No repairs in this range.",
        ),
        group(
          "Certificates",
          compliance.map((item) => ({
            title: item.title,
            detail: join([
              propertyName.get(item.propertyId) || "Property",
              named(COMPLIANCE_LABELS, item.kind),
              named(COMPLIANCE_STATUS, item.status),
              item.dueAt ? `Due ${day(item.dueAt, market)}` : "",
              item.proofName ? `Proof ${item.proofName}` : "",
            ]),
            note: snippet(item.detail) || undefined,
          })),
          "No certificates due in this range.",
        ),
        group(
          "Inspections",
          inspections.map((item) => ({
            title: named(INSPECTION_LABELS, item.kind),
            detail: join([
              propertyName.get(item.propertyId) || "Property",
              stamp(item.at, market),
              item.signedOffBy ? `Signed by ${item.signedOffBy}` : "Not signed",
            ]),
            note: snippet(item.notes) || undefined,
          })),
          "No inspections in this range.",
        ),
        group(
          "Contractors",
          book.contractors.map((contractor) => ({
            title: contractor.name,
            detail: join([
              named(TRADE_LABELS, contractor.trade),
              contractor.phone,
              insuranceExpired(contractor, new Date(now))
                ? `Insurance expired ${day(contractor.insuranceExpires, market)}`
                : `Insurance to ${day(contractor.insuranceExpires, market)}`,
            ]),
          })),
          "No contractors.",
        ),
        group(
          "Keys",
          book.keys.map((key) => ({
            title: key.label,
            detail: join([propertyName.get(key.propertyId) || "Property", `Held by ${key.heldBy}`, `Updated ${stamp(key.updatedAt, market)}`]),
          })),
          "No keys logged.",
        ),
      ],
    );
  }

  function teamSection(): ReportSection {
    return section(
      "team",
      "Team",
      `${input.members.length} people. This is the live roster, not limited by the date range.`,
      tally(input.members.map((member) => ROLE_LABELS[member.role])),
      [
        group(
          "",
          input.members.map((member) => {
            const owned = liveLeads.filter((lead) => lead.assignedTo === member.id).length;
            const theirs = bookTasks.filter(
              (task) => task.status === "open" && marketLeads.find((lead) => lead.id === task.leadId)?.assignedTo === member.id,
            ).length;
            const stocked = input.listings.filter(
              (listing) => listing.market === market && !listing.archivedAt && listing.agentId === member.id,
            ).length;
            return {
              title: member.name,
              detail: join([
                ROLE_LABELS[member.role],
                member.email,
                `${owned} open opportunit${owned === 1 ? "y" : "ies"}`,
                `${theirs} open task${theirs === 1 ? "" : "s"}`,
                `${stocked} listing${stocked === 1 ? "" : "s"}`,
              ]),
            };
          }),
          "No one on the team.",
        ),
      ],
    );
  }

  function sequencesSection(): ReportSection {
    return section(
      "sequences",
      "Sequences",
      `${input.sequences.length} sequence${input.sequences.length === 1 ? "" : "s"}. Live setup, so the date range does not hide them.`,
      tally(input.sequences.map((sequence) => named(FLOW_STATUS, sequence.status))),
      [
        group(
          "",
          input.sequences.map((sequence) => {
            const enrolled = input.enrollments.filter((row) => row.sequenceId === sequence.id);
            const active = enrolled.filter((row) => row.status === "active").length;
            return {
              title: sequence.title,
              detail: join([
                named(FLOW_STATUS, sequence.status),
                named(SEQUENCE_KIND, sequence.kind),
                `${sequence.steps.length} step${sequence.steps.length === 1 ? "" : "s"}`,
                enrolled.length
                  ? `${active} active of ${enrolled.length} enrolled`
                  : "No one enrolled",
              ]),
              note: sequence.steps.map((step) => step.label).join(" → ") || undefined,
            };
          }),
          "No sequences.",
        ),
      ],
    );
  }

  function automationsSection(): ReportSection {
    return section(
      "automations",
      "Automations",
      `${input.automations.length} automation${input.automations.length === 1 ? "" : "s"}. Live setup, so the date range does not hide them.`,
      tally(input.automations.map((automation) => named(FLOW_STATUS, automation.status))),
      [
        group(
          "",
          input.automations.map((automation) => ({
            title: automation.name,
            detail: join([
              named(FLOW_STATUS, automation.status),
              named(TRIGGER, automation.trigger),
              automation.triggerStage ? named(LEAD_STAGE, automation.triggerStage) : "",
              `${automation.steps.length} step${automation.steps.length === 1 ? "" : "s"}`,
            ]),
            note: join([
              snippet(automation.description, 180),
              automation.steps.map((step) => step.label).join(" → "),
            ]) || undefined,
          })),
          "No automations.",
        ),
      ],
    );
  }

  function websiteSection(): ReportSection {
    const site = input.website;
    return section(
      "website",
      "Website",
      site
        ? site.published
          ? "The public site is published."
          : "The public site is still a draft."
        : "No website on this office.",
      site
        ? [
            { label: "Status", value: site.published ? "Published" : "Draft" },
            { label: "Domain", value: named(DOMAIN_STATUS, site.domainStatus || "none") },
            { label: "SSL", value: named(SSL_STATUS, site.sslStatus || "none") },
          ]
        : [],
      [
        group(
          "",
          site
            ? [
                {
                  title: site.headline || input.orgName,
                  detail: join([
                    site.published ? "Published" : "Draft",
                    site.slug ? `/site/${site.slug}` : "",
                    site.customDomain,
                    site.templateId ? named({}, site.templateId) : "",
                    site.phone,
                    site.email,
                    site.updatedAt ? `Updated ${day(site.updatedAt, market)}` : "",
                  ]),
                  note: snippet(site.tagline) || undefined,
                },
              ]
            : [],
          "No website on this office.",
        ),
      ],
    );
  }

  function socialSection(): ReportSection {
    const posts = input.socialPosts.filter((post) =>
      upcoming(post.publishedAt || post.scheduledFor || post.createdAt),
    );
    const accountName = new Map(input.socialAccounts.map((account) => [account.id, account.displayName]));
    return section(
      "social",
      "Social",
      join([
        `${input.socialAccounts.length} account${input.socialAccounts.length === 1 ? "" : "s"} connected in setup`,
        `${posts.length} post${posts.length === 1 ? "" : "s"} in this range`,
      ]),
      tally(posts.map((post) => named(SOCIAL_STATUS, post.status))),
      [
        group(
          "Accounts",
          input.socialAccounts.map((account: SocialAccount) => ({
            title: account.displayName,
            detail: join([
              named(PLATFORM, account.platform),
              account.handle ? `@${account.handle.replace(/^@/, "")}` : "",
              named(SOCIAL_STATUS, account.status),
              account.connectedAt ? `Since ${day(account.connectedAt, market)}` : "",
            ]),
            note: snippet(account.lastError) || undefined,
          })),
          "No social accounts connected.",
        ),
        group(
          "Posts",
          posts.map((post: SocialPost) => ({
            title: snippet(post.caption, 80) || "Untitled post",
            detail: join([
              named(SOCIAL_STATUS, post.status),
              stamp(post.publishedAt || post.scheduledFor || post.createdAt, market),
              post.accountIds.map((id) => accountName.get(id)).filter((name): name is string => Boolean(name)).join(", ")
                || (post.channel ? named(PLATFORM, post.channel) : ""),
              post.media.length ? `${post.media.length} file${post.media.length === 1 ? "" : "s"}` : "No media",
            ]),
            note: snippet(post.lastError) || undefined,
          })),
          "No posts in this range.",
        ),
      ],
    );
  }

  function portalsSection(): ReportSection {
    const connected = input.portals.filter((portal) => portal.connected).length;
    return section(
      "portals",
      "Listing portals",
      `${connected} of ${input.portals.length} portal feed${input.portals.length === 1 ? "" : "s"} connected. This is live setup.`,
      [],
      [
        group(
          "",
          input.portals.map((portal) => ({
            title: PORTAL_LABEL[portal.portal],
            detail: join([
              portal.connected ? "Connected" : "Not connected",
              portal.branchId ? `Branch ${portal.branchId}` : "",
              portal.networkId ? `Network ${portal.networkId}` : "",
              portal.apiKeyConfigured ? "Key stored" : "",
              portal.lastVerifiedAt ? `Checked ${day(portal.lastVerifiedAt, market)}` : "",
            ]),
            note: snippet(portal.notes) || undefined,
          })),
          "No portal feeds for this book.",
        ),
      ],
    );
  }

  const sections: ReportSection[] = [
    opportunitiesSection(),
    contactsSection(),
    listingsSection(),
    dealsSection(),
    tasksSection(),
    callsSection(),
    messagesSection(),
    diarySection(),
  ];
  if (market === "uk") sections.push(lettingsSection());
  sections.push(
    teamSection(),
    sequencesSection(),
    automationsSection(),
    websiteSection(),
    socialSection(),
    portalsSection(),
  );

  return {
    headline: `${input.orgName} · ${region} · ${rangeLabel}`,
    overview,
    sections,
  };
}

export function reportToCsv(report: WorkspaceReport): string {
  const rows: string[][] = [
    ["Report", report.headline],
    [],
    ["Overview", "Value", "Detail"],
    ...report.overview.map((item) => [item.label, item.value, item.hint]),
  ];
  for (const block of report.sections) {
    rows.push([], [block.title], ["Summary", block.summary]);
    if (block.facts.length) {
      rows.push(["Breakdown", "Value"]);
      for (const fact of block.facts) rows.push([fact.label, fact.value]);
    }
    for (const bundle of block.groups) {
      rows.push([], [bundle.title || block.title, "Detail", "Note"]);
      if (!bundle.records.length) {
        rows.push([bundle.empty]);
        continue;
      }
      for (const record of bundle.records) rows.push([record.title, record.detail, record.note || ""]);
    }
  }
  return rowsToCsv(rows);
}

"use client";

import { MenuSelect } from "@/components/ui/select";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import { findDuplicateLead } from "@/lib/crm/duplicates";
import { isE164 } from "@/lib/phone/e164";
import { buildPhoneContactMethod, formatDate, formatMoney, asErrorMessage } from "@/lib/utils";
import { PhoneField } from "@/components/crm/phone-field";
import { SequenceProgress } from "@/components/crm/sequence-panel";
import { findSequenceByKind } from "@/lib/sequences/catalog";
import type {
  AutomationRun,
  Contact,
  ContactCategory,
  ContactSource,
  Lead,
  LeadActivity,
  LeadStage,
  LeadType,
  Market,
  Priority,
} from "@/types";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR, TableShell } from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ConversationInbox } from "@/components/crm/conversation-inbox";
import { AutomationBuilder } from "@/components/crm/automation-builder";
import { LeadRoutingPanel } from "@/components/crm/lead-routing-panel";
import { scoreLead } from "@/lib/crm/scoring";
import {
  Download,
  Eye,
  Inbox as InboxIcon,
  Mail,
  Pencil,
  Phone,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

function humanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "offer",
  "won",
  "lost",
];

const PHONE_SOURCES: ContactSource[] = [
  "website",
  "portal",
  "mls",
  "telephony",
  "sms",
  "import",
  "manual",
  "referral",
];

const CATEGORIES: ContactCategory[] = [
  "lead",
  "client",
  "past_client",
  "vendor",
  "partner",
  "other",
];

const CATEGORY_LABELS: Record<ContactCategory, string> = {
  lead: "Lead",
  client: "Active client",
  past_client: "Past client",
  vendor: "Vendor",
  partner: "Partner",
  other: "Other",
};

const CATEGORY_TONE: Record<
  ContactCategory,
  "neutral" | "success" | "warning" | "danger" | "accent"
> = {
  lead: "accent",
  client: "success",
  past_client: "neutral",
  vendor: "warning",
  partner: "accent",
  other: "neutral",
};

export type CrmView = "conversations" | "pipeline" | "contacts" | "automations" | "routing";

const VIEW_TAB: Record<CrmView, string> = {
  conversations: "inbox",
  pipeline: "pipeline",
  contacts: "contacts",
  automations: "automations",
  routing: "routing",
};

export function CrmDesk({ view }: { view: CrmView }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    org,
    members,
    leads,
    contacts,
    listings,
    messages,
    automations,
    sequences,
    enrollments,
    tasks,
    addLead,
    assignLead,
    saveLeadRouting,
    updateLeadStage,
    updateLead,
    archiveLead,
    addContact,
    updateContact,
    deleteContact,
    promoteContactToLead,
    sendSms,
    sendEmail,
    setLeadWorkflow,
    advanceSequence,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    runAutomationNow,
    runDueAutomations,
    listAutomationRuns,
    listLeadActivities,
    resolveTask,
    market,
    persistence,
  } = useAppSession();
  const [tab, setTab] = useState(VIEW_TAB[view]);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    () => searchParams.get("lead"),
  );
  const [viewDetailLead, setViewDetailLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opening the CRM flushes automation waits that came due, so runs advance
  // even on hosting plans without a frequent cron.
  useEffect(() => {
    void (async () => {
      await runDueAutomations();
      const runs = await listAutomationRuns().catch(() => []);
      setAutomationRuns(runs);
    })();
  }, [listAutomationRuns, runDueAutomations]);

  const detailLeadId = viewDetailLead?.id;
  useEffect(() => {
    if (!detailLeadId) {
      setLeadActivities([]);
      return;
    }
    void listLeadActivities(detailLeadId)
      .then(setLeadActivities)
      .catch(() => setLeadActivities([]));
  }, [detailLeadId, listLeadActivities]);

  useEffect(() => {
    const lead = searchParams.get("lead");
    if (lead) setSelectedLeadId(lead);
  }, [searchParams]);

  const selectConversation = useCallback(
    (id: string | null) => {
      setSelectedLeadId(id);
      if (view !== "conversations") return;
      if (!id) {
        router.replace("/app/conversations", { scroll: false });
        return;
      }
      const params = new URLSearchParams({ lead: id });
      const channel = searchParams.get("channel");
      if ((channel === "sms" || channel === "email") && searchParams.get("lead") === id) {
        params.set("channel", channel);
      }
      router.replace(`/app/conversations?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, view],
  );

  async function refreshAutomationRuns() {
    const runs = await listAutomationRuns().catch(() => []);
    setAutomationRuns(runs);
  }

  function exportLeadsCsv(leadsToExport: Lead[]) {
    if (!leadsToExport.length) {
      toast.error("No leads to export");
      return;
    }
    const headers = ["ID", "Name", "Email", "Phone", "Type", "Stage", "Score", "Source", "Budget", "Priority", "Created At"];
    const rows = leadsToExport.map((l) => [
      l.id,
      l.name,
      l.email || "",
      l.phone || "",
      l.type,
      l.stage,
      l.score,
      l.source || "",
      l.budget || 0,
      l.priority || "medium",
      l.createdAt,
    ]);
    downloadCsv(`leads_export_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([headers, ...rows]));
    toast.success(`Exported ${leadsToExport.length} leads to CSV`);
  }

  const marketListings = useMemo(
    () =>
      org
        ? listings.filter((listing) => listing.market === market && !listing.archivedAt)
        : [],
    [listings, org, market],
  );

  const allMarketLeads = useMemo(
    () =>
      org
        ? leads
            .filter((l) => l.market === market)
            .filter((l) => stageFilter === "all" || l.stage === stageFilter)
            .filter((l) => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return (
                l.name.toLowerCase().includes(q) ||
                l.email?.toLowerCase().includes(q) ||
                l.phone?.toLowerCase().includes(q) ||
                l.source?.toLowerCase().includes(q) ||
                l.nextAction?.toLowerCase().includes(q) ||
                marketListings.some(
                  (listing) =>
                    listing.id === l.listingId && listing.title.toLowerCase().includes(q),
                )
              );
            })
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        : [],
    [leads, org, market, stageFilter, searchQuery, marketListings],
  );

  // Pagination — slice the full list into pages of PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(allMarketLeads.length / PAGE_SIZE));
  const marketLeads = allMarketLeads.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const marketContacts = useMemo(
    () => (org ? contacts.filter((c) => c.market === market) : []),
    [contacts, org, market],
  );

  if (!user || !org) return null;

  const allowed = hasModuleAccess(user, org.plan, "crm", "view");
  const canEdit = hasModuleAccess(user, org.plan, "crm", "edit");
  const flags = PLAN_FEATURE_FLAGS[org.plan];

  if (!allowed) {
    const lockedCopy: Record<CrmView, { title: string; reason: string }> = {
      conversations: {
        title: "Conversations locked",
        reason: "Your role cannot open conversations.",
      },
      pipeline: {
        title: "Opportunities locked",
        reason: "Your role cannot open the pipeline.",
      },
      contacts: {
        title: "Contacts locked",
        reason: "Your role cannot open contacts.",
      },
      automations: {
        title: "Automations locked",
        reason: "Your role cannot open automations.",
      },
      routing: {
        title: "Routing locked",
        reason: "Your role cannot change lead routing.",
      },
    };
    return (
      <LockedModule
        title={lockedCopy[view].title}
        reason={lockedCopy[view].reason}
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
      />
    );
  }

  const activeLead =
    marketLeads.find((lead) => lead.id === selectedLeadId) || marketLeads[0] || null;

  const followSeq = findSequenceByKind(sequences, "follow_up") || sequences[0];
  const nurtureSeq = findSequenceByKind(sequences, "nurture");
  const followEnrollment = activeLead && followSeq
    ? enrollments.find(
        (e) => e.leadId === activeLead.id && e.sequenceId === followSeq.id,
      )
    : undefined;
  const nurtureEnrollment = activeLead && nurtureSeq
    ? enrollments.find(
        (e) => e.leadId === activeLead.id && e.sequenceId === nurtureSeq.id,
      )
    : undefined;
  const activeWorkflow = {
    followUp: followEnrollment?.status === "active",
    nurture: nurtureEnrollment?.status === "active",
  };

  const callQueue = marketLeads
    .filter((lead) => lead.phones?.length || lead.phone)
    .slice(0, 4);

  const inboxTasks = tasks.filter((t) => t.status === "open").slice(0, 8);

  function goToLeadThread(leadId: string, channel?: "sms" | "email") {
    setSelectedLeadId(leadId);
    const params = new URLSearchParams({ lead: leadId });
    if (channel) params.set("channel", channel);
    const href = `/app/conversations?${params.toString()}`;
    if (view !== "conversations") {
      router.push(href);
      return;
    }
    setTab("inbox");
    router.replace(href, { scroll: false });
  }

  const inboxLeads = org ? leads.filter((lead) => lead.market === market) : [];

  return (
    <div
      className={
        view === "conversations" ? "flex min-h-0 flex-1 flex-col" : "space-y-6"
      }
    >
      {error ? (
        <div className={view === "conversations" ? "px-4 pt-3" : undefined}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={setTab}
        className={view === "conversations" ? "flex min-h-0 flex-1 flex-col" : undefined}
      >
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search bar */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                placeholder="Search leads…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            {/* Stage filter */}
            <MenuSelect
              className="h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value as LeadStage | "all"); setCurrentPage(1); }}
            >
              <option value="all">All stages</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {humanLabel(stage)}
                </option>
              ))}
            </MenuSelect>
            {/* Result count */}
            <span className="text-sm text-[var(--muted)]">
              {allMarketLeads.length} lead{allMarketLeads.length !== 1 ? "s" : ""}
            </span>
            {canEdit ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportLeadsCsv(allMarketLeads)}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCsvImport(true)}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Button>
                <Button onClick={() => setShowLeadForm((v) => !v)}>
                  {showLeadForm ? "Close form" : "Add lead"}
                </Button>
              </div>
            ) : null}
          </div>

          {showLeadForm && canEdit ? (
            <form
              className="hero-card grid gap-3 rounded-[1.75rem] p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const formEl = e.currentTarget;
                const form = new FormData(formEl);
                void (async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const leadName = String(form.get("name"));
                    const leadEmail = String(form.get("email") || "").trim();
                    const leadPhone = String(form.get("phone") || "").trim();
                    if (!leadEmail && !leadPhone) {
                      toast.error("Add an email or a phone number.");
                      return;
                    }
                    const duplicate = findDuplicateLead(leads, { email: leadEmail, phone: leadPhone });
                    if (duplicate) {
                      const msg = `${duplicate.name} is already a lead with these details.`;
                      setError(msg);
                      toast.error(msg);
                      return;
                    }
                    await addLead({
                      name: leadName,
                      email: leadEmail,
                      phone: leadPhone,
                      type: String(form.get("type")) as LeadType,
                      stage: "new",
                      score: 0,
                      assignedTo: flags.leadRouting ? String(form.get("assignedTo") || "") : user.id,
                      market,
                      source: String(form.get("source") || "Manual"),
                      phones: String(form.get("phone") || "")
                        ? [
                            buildPhoneContactMethod({
                              number: String(form.get("phone")),
                              source: String(form.get("phoneSource") || "manual") as ContactSource,
                              consent: String(form.get("phoneConsent") || "unknown") as
                                | "unknown"
                                | "opted_in"
                                | "opted_out",
                              verification: String(
                                form.get("phoneVerification") || "unverified",
                              ) as "unverified" | "valid" | "invalid",
                            }),
                          ]
                        : [],
                      budget: Number(form.get("budget") || 0) || undefined,
                      listingId: String(form.get("listingId") || "") || undefined,
                      nextAction: String(form.get("nextAction") || "First outreach"),
                      nextActionDueAt: new Date().toISOString(),
                      priority: String(form.get("priority") || "medium") as Priority,
                      territory: String(form.get("territory") || "") || undefined,
                    });
                    formEl.reset();
                    setShowLeadForm(false);
                    toast.success(`Lead "${leadName}" added to pipeline`);
                  } catch (err) {
                    const msg = asErrorMessage(err, "Failed to add lead");
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <Input name="name" placeholder="Name" required />
              <Input name="email" type="email" placeholder="Email (or phone below)" />
              <PhoneField name="phone" market={market} className="sm:col-span-1" />
              <MenuSelect
                name="phoneSource"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="manual"
              >
                {PHONE_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {humanLabel(source)}
                  </option>
                ))}
              </MenuSelect>
              <Input name="source" placeholder="Source (Website, Portal, Phone)" />
              <MenuSelect
                name="listingId"
                aria-label="Property"
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                defaultValue=""
              >
                <option value="">Property interest</option>
                {marketListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.title}
                  </option>
                ))}
              </MenuSelect>
              <MenuSelect
                name="type"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="buyer"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="landlord">Landlord</option>
                <option value="tenant">Tenant</option>
              </MenuSelect>
              <Input name="budget" type="number" min={0} step="any" placeholder="Budget" />
              <Input name="nextAction" placeholder="Next action" />
              <MenuSelect
                name="phoneConsent"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="unknown"
              >
                <option value="unknown">Consent unknown</option>
                <option value="opted_in">Opted in</option>
                <option value="opted_out">Opted out</option>
              </MenuSelect>
              <MenuSelect
                name="priority"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="medium"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
                <option value="urgent">Urgent</option>
              </MenuSelect>
              <MenuSelect
                name="phoneVerification"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="unverified"
              >
                <option value="unverified">Unverified number</option>
                <option value="valid">Verified valid</option>
                <option value="invalid">Marked invalid</option>
              </MenuSelect>
              <Input name="territory" placeholder="Territory (city or postcode area)" />
              {flags.leadRouting ? (
                <MenuSelect
                  name="assignedTo"
                  className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Auto-assign (routing rules)</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </MenuSelect>
              ) : null}
              {flags.leadScoring ? (
                <p className="text-xs text-[var(--muted)] sm:col-span-2">
                  Score is calculated from source, completeness, type, and priority — not typed in.
                </p>
              ) : null}
              <Button type="submit" className="sm:col-span-2" disabled={busy}>
                {busy ? "Saving…" : "Save lead"}
              </Button>
            </form>
          ) : null}

          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH className="sticky left-0 z-10 bg-[var(--surface)]">Name</TH>
                  <TH>Phone</TH>
                  <TH>Owner</TH>
                  <TH>Type</TH>
                  <TH>Property</TH>
                  <TH>Stage</TH>
                  <TH>Next action</TH>
                  <TH>Budget</TH>
                  <TH>Score</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {marketLeads.map((lead) => {
                  const owner = members.find((member) => member.id === lead.assignedTo);
                  const primaryPhone =
                    lead.phones?.find((phone) => phone.preferred) || lead.phones?.[0];
                  return (
                    <TR key={lead.id}>
                      <TD className="sticky left-0 z-10 bg-[var(--surface)]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLead(false);
                            setViewDetailLead(lead);
                          }}
                          className="font-medium hover:underline text-left"
                        >
                          {lead.name}
                        </button>
                        <p className="text-xs text-[var(--muted)]">{lead.source}</p>
                      </TD>
                      <TD>
                        <p className="font-medium">
                          {primaryPhone?.number || lead.phone || "—"}
                        </p>
                        {primaryPhone ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge className="capitalize">{primaryPhone.source}</Badge>
                            <Badge
                              tone={
                                primaryPhone.verification === "valid"
                                  ? "success"
                                  : primaryPhone.verification === "invalid"
                                    ? "danger"
                                    : "neutral"
                              }
                            >
                              {primaryPhone.verification}
                            </Badge>
                          </div>
                        ) : null}
                      </TD>
                      <TD>{owner?.name ?? "Unassigned"}</TD>
                      <TD className="capitalize">{lead.type}</TD>
                      <TD>
                        {marketListings.find((listing) => listing.id === lead.listingId)?.title ||
                          "—"}
                      </TD>
                      <TD>
                        {canEdit ? (
                          <MenuSelect
                            className="h-8 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                            value={lead.stage}
                            onChange={(e) =>
                              void updateLeadStage(
                                lead.id,
                                e.target.value as LeadStage,
                              )
                            }
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {humanLabel(s)}
                              </option>
                            ))}
                          </MenuSelect>
                        ) : (
                          <Badge className="capitalize">{lead.stage}</Badge>
                        )}
                      </TD>
                      <TD>
                        <p className="max-w-[220px] text-sm">{lead.nextAction || "—"}</p>
                      </TD>
                      <TD>{lead.budget ? formatMoney(lead.budget, market) : "—"}</TD>
                      <TD>{flags.leadScoring ? lead.score : "—"}</TD>
                      <TD className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingLead(false);
                            setViewDetailLead(lead);
                          }}
                          title="View lead details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEdit ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setViewDetailLead(lead);
                              setEditingLead(true);
                            }}
                            title="Edit lead"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>
          {allMarketLeads.length === 0 ? (
            <EmptyState
              className="mt-4"
              title={searchQuery ? "No opportunities match your search" : "No opportunities yet"}
              description={
                searchQuery
                  ? "Try a different name, email, source, or property."
                  : "Website, portal, and office enquiries show up here. Add one to start the pipeline."
              }
            />
          ) : null}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <p className="text-sm text-[var(--muted)]">
                Page {currentPage} of {totalPages} · {allMarketLeads.length} leads
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <ContactsDirectory
            contacts={marketContacts}
            leads={leads}
            members={members}
            canEdit={canEdit}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            market={market}
            userId={user.id}
            addContact={addContact}
            updateContact={updateContact}
            deleteContact={deleteContact}
            promoteContactToLead={promoteContactToLead}
            onOpenThread={goToLeadThread}
          />
        </TabsContent>

        <TabsContent
          value="inbox"
          className="mt-0 min-h-0 flex-1 flex-col data-[state=active]:flex"
        >
          <ConversationInbox
            leads={inboxLeads}
            contacts={marketContacts}
            messages={messages}
            members={members}
            market={market}
            userId={user.id}
            orgName={org.name}
            canEdit={canEdit}
            selectedLeadId={selectedLeadId}
            pinnedLeadId={searchParams.get("lead")}
            onSelect={selectConversation}
            onError={setError}
            composeChannel={
              searchParams.get("channel") === "email"
                ? "email"
                : searchParams.get("channel") === "sms"
                  ? "sms"
                  : undefined
            }
            sendSms={sendSms}
            sendEmail={sendEmail}
            addLead={addLead}
            promoteContactToLead={promoteContactToLead}
          />
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <section className="hero-card rounded-[2rem] p-4">
            <h2 className="font-semibold">Call queue</h2>
            <p className="text-sm text-[var(--muted)]">
              Call people who are waiting on a reply.
            </p>
            {callQueue.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {callQueue.map((lead) => {
                  const phone = lead.phones?.[0]?.number || lead.phone;
                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                    >
                      <p className="font-medium">{lead.name}</p>
                      <p className="mt-2 text-sm">{phone}</p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {lead.nextAction || "Call required"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => goToLeadThread(lead.id, "sms")}>
                          <Phone className="h-3.5 w-3.5" aria-hidden />
                          Message
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="mt-4"
                title="No calls queued"
                description="Leads with a phone number will appear here."
              />
            )}
          </section>
        </TabsContent>

        <TabsContent value="automations" className="space-y-4">
          <section className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-sm text-[var(--foreground)]">
              A workflow is a list of steps that starts when something happens, such as a new lead or a quiet thread.
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">Changes save to this workspace.</p>
          </section>

          <AutomationBuilder
            automations={automations}
            canEdit={canEdit}
            busy={busy}
            onCreate={async (automation) => {
              setBusy(true);
              setError(null);
              try {
                await createAutomation(automation);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to create automation",
                );
              } finally {
                setBusy(false);
              }
            }}
            onUpdate={async (id, patch) => {
              setBusy(true);
              setError(null);
              try {
                await updateAutomation(id, patch);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to update automation",
                );
              } finally {
                setBusy(false);
              }
            }}
            onDelete={async (id) => {
              setBusy(true);
              setError(null);
              try {
                await deleteAutomation(id);
                await refreshAutomationRuns();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to delete automation",
                );
              } finally {
                setBusy(false);
              }
            }}
            onRunNow={
              activeLead && persistence === "supabase"
                ? async (id) => {
                    setBusy(true);
                    setError(null);
                    try {
                      const result = await runAutomationNow({
                        leadId: activeLead.id,
                        automationId: id,
                      });
                      await refreshAutomationRuns();
                      if (!result?.enqueued) {
                        toast.error(
                          "Nothing ran — activate the workflow and give it at least one step.",
                        );
                      } else {
                        toast.success(`Workflow started for ${activeLead.name}`);
                      }
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Failed to run automation",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }
                : undefined
            }
            runNowLabel={activeLead ? `Run for ${activeLead.name}` : undefined}
          />

          <section className="hero-card rounded-[2rem] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Run history</h2>
                <p className="text-sm text-[var(--muted)]">
                  Every automation execution, including waits still counting down.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await runDueAutomations();
                      await refreshAutomationRuns();
                      toast.success("Checked for due steps");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Run due steps
              </Button>
            </div>

            {automationRuns.length ? (
              <div className="mt-4 space-y-3">
                {automationRuns.slice(0, 12).map((run) => {
                  const automation = automations.find((a) => a.id === run.automationId);
                  const lead = leads.find((l) => l.id === run.leadId);
                  const tone =
                    run.status === "completed"
                      ? "success"
                      : run.status === "failed" || run.status === "cancelled"
                        ? "danger"
                        : run.status === "waiting"
                          ? "warning"
                          : "neutral";
                  return (
                    <div
                      key={run.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {automation?.name || "Workflow"}
                            <span className="text-[var(--muted)]">
                              {" · "}
                              {lead?.name || "Lead"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {run.trigger.replace(/_/g, " ")} ·{" "}
                            {formatDate(run.createdAt, market)}
                            {run.status === "waiting"
                              ? ` · resumes ${formatDate(run.runAfter, market)}`
                              : ""}
                          </p>
                        </div>
                        <Badge tone={tone} className="capitalize">
                          {run.status}
                        </Badge>
                      </div>

                      {run.steps?.length ? (
                        <ol className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3">
                          {run.steps.map((step) => (
                            <li
                              key={step.id}
                              className="flex flex-wrap items-baseline gap-2 text-xs"
                            >
                              <span className="font-medium">
                                {step.stepIndex + 1}. {step.label || step.stepType}
                              </span>
                              <span className="text-[var(--muted)]">{step.detail}</span>
                              {step.status !== "completed" ? (
                                <Badge
                                  tone={step.status === "failed" ? "danger" : "warning"}
                                  className="capitalize"
                                >
                                  {step.status}
                                </Badge>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}

                      {run.lastError ? (
                        <p className="mt-2 text-xs text-[var(--danger)]">
                          {run.lastError}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="mt-4"
                title="No runs yet"
                description="Activate a workflow, then add a lead, change a stage, send a first CRM message, or wait 48h of silence."
              />
            )}
          </section>

          {activeLead ? (
            <section className="hero-card rounded-[2rem] p-4">
              <h2 className="font-semibold">Lead enrollment</h2>
              <p className="text-sm text-[var(--muted)]">
                Enroll {activeLead.name}. The first unsent step goes out when you
                switch a sequence on.
              </p>
              <div className="mt-4 space-y-3">
                <WorkflowRow
                  title="Follow-up sequence"
                  description="Intro SMS, a call task, then a reminder."
                  checked={Boolean(activeWorkflow.followUp)}
                  onChange={(checked) => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await setLeadWorkflow({
                          leadId: activeLead.id,
                          followUp: checked,
                          nurture: Boolean(activeWorkflow.nurture),
                        });
                        toast.success(
                          checked
                            ? "Follow-up on — first unsent step sent"
                            : "Follow-up paused",
                        );
                      } catch (err) {
                        const msg = asErrorMessage(err, "Could not update enrollment");
                        setError(msg);
                        toast.error(msg);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                />
                {followSeq ? (
                  <SequenceProgress
                    sequence={followSeq}
                    enrollment={followEnrollment}
                    busy={busy}
                    onAdvance={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const result = await advanceSequence({
                            leadId: activeLead.id,
                            sequenceId: followSeq.id,
                          });
                          toast.success(result.detail || "Next step sent");
                        } catch (err) {
                          const msg = asErrorMessage(err, "Could not send next step");
                          setError(msg);
                          toast.error(msg);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  />
                ) : null}
                <WorkflowRow
                  title="Long-tail nurture"
                  description="Keep colder leads warm. No automatic Day-N wait."
                  checked={Boolean(activeWorkflow.nurture)}
                  onChange={(checked) => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await setLeadWorkflow({
                          leadId: activeLead.id,
                          followUp: Boolean(activeWorkflow.followUp),
                          nurture: checked,
                        });
                        toast.success(
                          checked
                            ? "Nurture on — first unsent step sent"
                            : "Nurture paused",
                        );
                      } catch (err) {
                        const msg = asErrorMessage(err, "Could not update enrollment");
                        setError(msg);
                        toast.error(msg);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                />
                {nurtureSeq ? (
                  <SequenceProgress
                    sequence={nurtureSeq}
                    enrollment={nurtureEnrollment}
                    busy={busy}
                    onAdvance={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          const result = await advanceSequence({
                            leadId: activeLead.id,
                            sequenceId: nurtureSeq.id,
                          });
                          toast.success(result.detail || "Next step sent");
                        } catch (err) {
                          const msg = asErrorMessage(err, "Could not send next step");
                          setError(msg);
                          toast.error(msg);
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="hero-card rounded-[2rem] p-4">
            <h2 className="font-semibold">Open tasks</h2>
            <p className="text-sm text-[var(--muted)]">
              Inbox-zero follow-ups waiting on your team.
            </p>
            {inboxTasks.length ? (
              <div className="mt-4 space-y-3">
                {inboxTasks.map((task) => {
                  const lead = leads.find((l) => l.id === task.leadId);
                  return (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                    >
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {lead?.name || "Lead"} · {task.channel}
                          {task.dueAt ? ` · due ${formatDate(task.dueAt, market)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{task.channel}</Badge>
                        <Button size="sm" onClick={() => void resolveTask(task.id)}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Inbox zero — no open tasks.
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="routing" className="mt-4">
          <LeadRoutingPanel
            plan={org.plan}
            role={user.role}
            moduleAccess={user.moduleAccess}
            settings={org.leadRouting}
            members={members}
            leads={leads}
            canEdit={canEdit}
            onSave={async (next) => {
              await saveLeadRouting(next);
              toast.success("Lead routing saved");
            }}
          />
        </TabsContent>
      </Tabs>

      {viewDetailLead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="surface-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[1.75rem] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={viewDetailLead.name} size="md" />
                <div>
                  <h2 className="text-xl font-semibold">{viewDetailLead.name}</h2>
                  <p className="text-xs text-[var(--muted)]">
                    {viewDetailLead.email} · {viewDetailLead.phone || "No phone"} · {viewDetailLead.source}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && !editingLead ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingLead(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive ${viewDetailLead.name}? They leave the pipeline but stay in history.`,
                          )
                        ) {
                          void archiveLead(viewDetailLead.id)
                            .then(() => {
                              setViewDetailLead(null);
                              toast.success("Lead archived");
                            })
                            .catch((err) =>
                              toast.error(
                                err instanceof Error ? err.message : "Could not archive",
                              ),
                            );
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Archive
                    </Button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEditingLead(false);
                    setViewDetailLead(null);
                  }}
                  className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {editingLead && canEdit ? (
              <LeadEditForm
                lead={viewDetailLead}
                busy={busy}
                market={market}
                listings={listings.filter((l) => l.market === market)}
                showTerritory={flags.leadRouting}
                onCancel={() => setEditingLead(false)}
                onSubmit={(form) => {
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const saved = await updateLead(viewDetailLead.id, {
                        name: String(form.get("name") || "").trim(),
                        email: String(form.get("email") || "").trim(),
                        phone: String(form.get("phone") || "").trim(),
                        source: String(form.get("source") || "").trim(),
                        type: String(form.get("type")) as LeadType,
                        stage: String(form.get("stage")) as LeadStage,
                        budget: Number(form.get("budget") || 0) || 0,
                        nextAction: String(form.get("nextAction") || "").trim(),
                        priority: String(form.get("priority") || "medium") as Priority,
                        territory: String(form.get("territory") || "").trim(),
                        notes: String(form.get("notes") || "").trim(),
                        assignedTo: String(form.get("assignedTo") || ""),
                        listingId: String(form.get("listingId") || "") || undefined,
                      });
                      setViewDetailLead(saved);
                      setEditingLead(false);
                      toast.success("Lead updated");
                    } catch (err) {
                      const msg = asErrorMessage(err, "Failed to update lead");
                      setError(msg);
                      toast.error(msg);
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                members={members}
              />
            ) : null}

            {!editingLead ? (
              <>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
              <Badge tone="accent">Type: {viewDetailLead.type}</Badge>
              <Badge tone="success">Stage: {viewDetailLead.stage}</Badge>
              <Badge tone={viewDetailLead.priority === "urgent" ? "danger" : "neutral"}>
                Priority: {viewDetailLead.priority || "medium"}
              </Badge>
              {flags.leadScoring ? <Badge>Score: {viewDetailLead.score}/100</Badge> : null}
              {viewDetailLead.budget ? (
                <Badge tone="accent">Budget: {formatMoney(viewDetailLead.budget, market)}</Badge>
              ) : null}
            </div>

            {flags.leadScoring ? (
              <ScoreBreakdown lead={viewDetailLead} />
            ) : null}

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold">Lead Details & Activity</h3>
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-4 text-sm">
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Next Action</span>
                  <span>{viewDetailLead.nextAction || "None scheduled"}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Owner / Assigned Agent</span>
                  {canEdit ? (
                    <MenuSelect
                      className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                      value={viewDetailLead.assignedTo || ""}
                      onChange={(e) => {
                        const assignedTo = e.target.value;
                        void assignLead(viewDetailLead.id, assignedTo);
                        setViewDetailLead({ ...viewDetailLead, assignedTo });
                      }}
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </MenuSelect>
                  ) : (
                    <span>{members.find((m) => m.id === viewDetailLead.assignedTo)?.name || "Unassigned"}</span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Created Date</span>
                  <span>{formatDate(viewDetailLead.createdAt, market)}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Last Updated</span>
                  <span>{formatDate(viewDetailLead.updatedAt, market)}</span>
                </div>
              </div>

              {viewDetailLead.notes ? (
                <div className="rounded-xl border border-[var(--border)] p-3 text-sm">
                  <span className="text-xs font-semibold text-[var(--muted)] block">Notes</span>
                  <p className="mt-1">{viewDetailLead.notes}</p>
                </div>
              ) : null}

              {viewDetailLead.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {viewDetailLead.tags.map((tag) => (
                    <Badge key={tag} tone="accent">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="rounded-xl border border-[var(--border)] p-3">
                <span className="block text-xs font-semibold text-[var(--muted)]">
                  Activity timeline
                </span>
                {leadActivities.length ? (
                  <ol className="mt-2 space-y-2">
                    {leadActivities.map((activity) => (
                      <li key={activity.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        <div className="min-w-0">
                          <p className="break-words">{activity.body}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {activity.activityType.replace(/_/g, " ")} ·{" "}
                            {formatDate(activity.createdAt, market)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    No activity yet. Automation steps and SMS sends land here.
                  </p>
                )}
              </div>
            </div>
              </>
            ) : null}

            {!editingLead ? (
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedLeadId(viewDetailLead.id);
                  setViewDetailLead(null);
                  setTab("inbox");
                }}
              >
                <InboxIcon className="h-3.5 w-3.5 mr-1" />
                Go to SMS Thread
              </Button>
              <Button size="sm" onClick={() => setViewDetailLead(null)}>
                Close
              </Button>
            </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCsvImport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="surface-panel w-full max-w-lg rounded-[1.75rem] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bulk Import Leads via CSV</h2>
              <button
                type="button"
                onClick={() => setShowCsvImport(false)}
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Paste CSV data with headers: <code>name, email, phone, type, budget, source</code>.
              Phones need a country code (<code>+4477…</code> or <code>+92333…</code>, not{" "}
              <code>0333…</code>).
            </p>

            <textarea
              className="min-h-36 w-full font-mono text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
              placeholder={`name,email,phone,type,budget,source\nJohn Doe,john@example.com,+447700900077,buyer,450000,Rightmove\nJane Smith,jane@example.com,+15550199,seller,850000,Zillow`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowCsvImport(false)}>
                Cancel
              </Button>
              <Button
                disabled={!csvText.trim() || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const parsedRows = parseCsv(csvText);
                    const hasHeader = parsedRows[0]?.[0]?.toLowerCase().includes("name");
                    const dataLines = hasHeader ? parsedRows.slice(1) : parsedRows;
                    const knownTypes: LeadType[] = ["buyer", "seller", "landlord", "tenant"];
                    let importedCount = 0;
                    const skipped: string[] = [];
                    const known = [...leads];

                    for (const cols of dataLines) {
                      const name = cols[0];
                      if (!name) continue;
                      const email = (cols[1] || "").toLowerCase();
                      const phone = cols[2] || "";
                      if (!email && !phone) {
                        skipped.push(`${name} (no email or phone)`);
                        continue;
                      }
                      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        skipped.push(`${name} (invalid email)`);
                        continue;
                      }
                      if (phone && !isE164(phone)) {
                        skipped.push(`${name} (phone needs a country code)`);
                        continue;
                      }
                      if (findDuplicateLead(known, { email, phone })) {
                        skipped.push(`${name} (already a lead)`);
                        continue;
                      }
                      const typeText = (cols[3] || "buyer").toLowerCase() as LeadType;
                      await addLead({
                        name,
                        email,
                        phone,
                        type: knownTypes.includes(typeText) ? typeText : "buyer",
                        stage: "new",
                        score: 0,
                        assignedTo: "",
                        market,
                        source: cols[5] || "CSV Import",
                        budget: Number(cols[4]) || undefined,
                        nextAction: "Initial contact after import",
                      });
                      known.push({ email, phone } as (typeof leads)[number]);
                      importedCount++;
                    }
                    if (skipped.length) {
                      toast.warning(
                        `Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}`,
                      );
                    }
                    toast.success(`Imported ${importedCount} lead${importedCount === 1 ? "" : "s"}`);
                    setCsvText("");
                    setShowCsvImport(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "CSV Import failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Importing…" : "Import Leads"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScoreBreakdown({ lead }: { lead: Lead }) {
  const result = scoreLead(lead);
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--muted)]">Why this score</p>
      <ul className="mt-2 space-y-1">
        {result.factors.map((factor) => (
          <li key={factor.label} className="flex justify-between gap-3">
            <span>{factor.label}</span>
            <span className="tabular-nums text-[var(--muted)]">+{factor.points}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Auto {result.score}/100
        {result.score !== lead.score ? ` · saved ${lead.score}` : ""}
      </p>
    </div>
  );
}

function WorkflowRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-[var(--muted)]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}

interface ContactsDirectoryProps {
  contacts: Contact[];
  leads: { id: string; name: string; stage: LeadStage }[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  market: Market;
  userId: string;
  addContact: (
    contact: Omit<Contact, "id" | "createdAt" | "updatedAt" | "market">,
  ) => Promise<void>;
  updateContact: (
    id: string,
    patch: Partial<
      Pick<
        Contact,
        | "name"
        | "email"
        | "phone"
        | "company"
        | "category"
        | "tags"
        | "notes"
        | "leadId"
        | "assignedTo"
        | "lastContactedAt"
      >
    >,
  ) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  promoteContactToLead: (
    contactId: string,
    input: { type: LeadType; source?: string },
  ) => Promise<string | undefined>;
  onOpenThread: (leadId: string, channel?: "sms" | "email") => void;
}

function ContactsDirectory({
  contacts,
  leads,
  members,
  canEdit,
  busy,
  setBusy,
  setError,
  market,
  userId,
  addContact,
  updateContact,
  deleteContact,
  promoteContactToLead,
  onOpenThread,
}: ContactsDirectoryProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteType, setPromoteType] = useState<LeadType>("buyer");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => categoryFilter === "all" || c.category === categoryFilter)
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [contacts, query, categoryFilter]);

  const editingContact = editingId ? contacts.find((c) => c.id === editingId) : null;

  async function handleSubmit(form: FormData, existing?: Contact) {
    setBusy(true);
    setError(null);
    try {
      const tags = String(form.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        name: String(form.get("name")),
        email: String(form.get("email") || "") || undefined,
        phone: String(form.get("phone") || "") || undefined,
        company: String(form.get("company") || "") || undefined,
        category: String(form.get("category") || "other") as ContactCategory,
        tags,
        notes: String(form.get("notes") || "") || undefined,
      };
      if (existing) {
        await updateContact(existing.id, payload);
        setEditingId(null);
      } else {
        await addContact({ ...payload, assignedTo: userId });
        setShowForm(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setBusy(false);
    }
  }

  async function messageContact(contact: Contact, channel: "sms" | "email") {
    const existing =
      (contact.leadId && leads.some((lead) => lead.id === contact.leadId) && contact.leadId) ||
      undefined;
    if (existing) {
      onOpenThread(existing, channel);
      return;
    }
    if (!canEdit) {
      toast.error("This contact is not in a conversation yet.");
      return;
    }
    if (channel === "sms" && !contact.phone) return;
    if (channel === "email" && !contact.email) return;
    setBusy(true);
    setError(null);
    try {
      const leadId = await promoteContactToLead(contact.id, { type: "buyer", source: "Manual" });
      if (!leadId) throw new Error("Could not open that conversation");
      onOpenThread(leadId, channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that conversation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone, or company"
            aria-label="Search contacts"
            className="pl-10"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <MenuSelect
            aria-label="Category"
            className="w-full sm:w-52"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | "all")}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </MenuSelect>
          {canEdit ? (
            <Button
              className="shrink-0"
              onClick={() => {
                setEditingId(null);
                setShowForm((v) => !v);
              }}
            >
              {showForm ? "Close form" : "Add contact"}
            </Button>
          ) : null}
        </div>
      </div>

      {showForm && canEdit ? (
        <ContactForm
          market={market}
          onSubmit={(form) => void handleSubmit(form)}
          busy={busy}
        />
      ) : null}

      {editingContact && canEdit ? (
        <ContactForm
          market={market}
          contact={editingContact}
          busy={busy}
          onSubmit={(form) => void handleSubmit(form, editingContact)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            description={
              canEdit
                ? "Leads with an email or phone are added here. You can also add a contact directly."
                : "Leads with an email or phone show up here. Adding a contact directly needs CRM edit access."
            }
          />
        ) : (
          <EmptyState
            title="No contacts match your search"
            description="Try a different search term or category filter."
          />
        )
      ) : (
        <ul className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">
          {filtered.map((contact) => {
            const owner = members.find((m) => m.id === contact.assignedTo);
            const linkedLead = contact.leadId
              ? leads.find((l) => l.id === contact.leadId)
              : undefined;
            const isPromoting = promotingId === contact.id;
            return (
              <li
                key={contact.id}
                className="border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:px-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={contact.name} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold leading-tight">{contact.name}</p>
                        {contact.company ? (
                          <span className="text-sm text-[var(--muted)]">{contact.company}</span>
                        ) : null}
                        <Badge tone={CATEGORY_TONE[contact.category]}>
                          {CATEGORY_LABELS[contact.category]}
                        </Badge>
                        {linkedLead ? (
                          <button
                            type="button"
                            onClick={() => onOpenThread(linkedLead.id)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:opacity-80"
                          >
                            <Sparkles className="h-3 w-3" />
                            In pipeline · {linkedLead.stage}
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                        {contact.phone ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 hover:text-[var(--foreground)]"
                            onClick={() => void messageContact(contact, "sms")}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {contact.phone}
                          </button>
                        ) : null}
                        {contact.email ? (
                          <button
                            type="button"
                            className="inline-flex min-w-0 items-center gap-1.5 hover:text-[var(--foreground)]"
                            onClick={() => void messageContact(contact, "email")}
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </button>
                        ) : null}
                        {owner ? <span>Owner · {owner.name}</span> : null}
                      </div>
                      {contact.tags.length || contact.notes ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} className="lowercase">
                              {tag}
                            </Badge>
                          ))}
                          {contact.notes ? (
                            <p className="line-clamp-1 text-xs text-[var(--muted)]">{contact.notes}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-2 lg:max-w-[24rem] lg:shrink-0 lg:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(contact.id);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {!linkedLead ? (
                      isPromoting ? (
                        <div className="flex items-center gap-1.5">
                          <MenuSelect
                            className="h-8 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                            value={promoteType}
                            onChange={(e) => setPromoteType(e.target.value as LeadType)}
                          >
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                            <option value="landlord">Landlord</option>
                            <option value="tenant">Tenant</option>
                          </MenuSelect>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                setBusy(true);
                                setError(null);
                                try {
                                  await promoteContactToLead(contact.id, {
                                    type: promoteType,
                                  });
                                  setPromotingId(null);
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to promote contact",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              })();
                            }}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPromotingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPromotingId(contact.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Promote to lead
                        </Button>
                      )
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      aria-label={`Delete ${contact.name}`}
                      onClick={() => {
                        if (window.confirm(`Delete ${contact.name} from contacts?`)) {
                          void deleteContact(contact.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function LeadEditForm({
  lead,
  members,
  listings,
  busy,
  market,
  showTerritory,
  onSubmit,
  onCancel,
}: {
  lead: Lead;
  members: { id: string; name: string }[];
  listings: { id: string; title: string }[];
  busy: boolean;
  market: Market;
  showTerritory: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      key={lead.updatedAt}
      className="grid gap-3 sm:grid-cols-2 rounded-xl border border-[var(--border)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <Input name="name" placeholder="Name" defaultValue={lead.name} required />
      <Input name="email" type="email" placeholder="Email" defaultValue={lead.email} required />
      <PhoneField name="phone" market={market} defaultValue={lead.phone} />
      <Input name="source" placeholder="Lead source" defaultValue={lead.source} />
      <MenuSelect
        name="type"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={lead.type}
      >
        <option value="buyer">Buyer</option>
        <option value="seller">Seller</option>
        <option value="landlord">Landlord</option>
        <option value="tenant">Tenant</option>
      </MenuSelect>
      <MenuSelect
        name="stage"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={lead.stage}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {humanLabel(s)}
          </option>
        ))}
      </MenuSelect>
      <Input
        name="budget"
        type="number"
        placeholder="Budget"
        defaultValue={lead.budget || ""}
      />
      <Input name="nextAction" placeholder="Next action" defaultValue={lead.nextAction} />
      <MenuSelect
        name="priority"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={lead.priority || "medium"}
      >
        <option value="low">Low priority</option>
        <option value="medium">Medium priority</option>
        <option value="high">High priority</option>
        <option value="urgent">Urgent</option>
      </MenuSelect>
      <MenuSelect
        name="assignedTo"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={lead.assignedTo || ""}
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </MenuSelect>
      <MenuSelect
        name="listingId"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm sm:col-span-2"
        defaultValue={lead.listingId || ""}
      >
        <option value="">No linked listing</option>
        {listings.map((listing) => (
          <option key={listing.id} value={listing.id}>
            {listing.title}
          </option>
        ))}
      </MenuSelect>
      {showTerritory ? (
        <Input
          name="territory"
          placeholder="Territory (city or postcode area)"
          defaultValue={lead.territory}
        />
      ) : (
        <input type="hidden" name="territory" value={lead.territory || ""} />
      )}
      <textarea
        name="notes"
        placeholder="Notes"
        defaultValue={lead.notes}
        className="min-h-20 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ContactForm({
  contact,
  market,
  busy,
  onSubmit,
  onCancel,
}: {
  contact?: Contact;
  market: Market;
  busy: boolean;
  onSubmit: (form: FormData) => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="hero-card grid gap-3 rounded-[1.75rem] p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <Input name="name" placeholder="Full name" defaultValue={contact?.name} required />
      <Input name="company" placeholder="Company (optional)" defaultValue={contact?.company} />
      <Input name="email" type="email" placeholder="Email" defaultValue={contact?.email} />
      <PhoneField name="phone" market={market} defaultValue={contact?.phone} />
      <MenuSelect
        name="category"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={contact?.category || "other"}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </MenuSelect>
      <Input
        name="tags"
        placeholder="Tags, comma separated"
        defaultValue={contact?.tags.join(", ")}
      />
      <textarea
        name="notes"
        placeholder="Notes"
        defaultValue={contact?.notes}
        className="min-h-20 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm sm:col-span-2"
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : contact ? "Save changes" : "Save contact"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export default function AppCrmPage() {
  return (
    <Suspense fallback={null}>
      <CrmDesk view="conversations" />
    </Suspense>
  );
}

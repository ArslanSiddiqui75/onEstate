"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess, hasFeature } from "@/lib/access";
import { InviteModal } from "@/components/team/invite-modal";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { buildPhoneContactMethod, formatDate, formatMoney } from "@/lib/utils";
import type {
  Contact,
  ContactCategory,
  ContactSource,
  Lead,
  LeadStage,
  LeadType,
  Priority,
} from "@/types";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR, TableShell } from "@/components/ui/table";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { AutomationBuilder } from "@/components/crm/automation-builder";
import {
  Contact as ContactIcon,
  Download,
  Eye,
  FileSpreadsheet,
  Inbox as InboxIcon,
  ListChecks,
  Pencil,
  Phone,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Workflow,
  X,
} from "lucide-react";

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

export default function AppCrmPage() {
  const {
    user,
    org,
    members,
    leads,
    contacts,
    messages,
    callLogs,
    automations,
    enrollments,
    tasks,
    addLead,
    updateLeadStage,
    addContact,
    updateContact,
    deleteContact,
    promoteContactToLead,
    sendSms,
    logCall,
    setLeadWorkflow,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    resolveTask,
    market,
  } = useAppSession();
  const [tab, setTab] = useState("pipeline");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [viewDetailLead, setViewDetailLead] = useState<Lead | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function exportLeadsCsv(leadsToExport: Lead[]) {
    if (!leadsToExport.length) {
      toast.error("No leads to export");
      return;
    }
    const headers = ["ID", "Name", "Email", "Phone", "Type", "Stage", "Score", "Source", "Budget", "Priority", "Created At"];
    const rows = leadsToExport.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      l.email || "",
      l.phone || "",
      l.type,
      l.stage,
      l.score,
      `"${(l.source || "").replace(/"/g, '""')}"`,
      l.budget || 0,
      l.priority || "medium",
      l.createdAt,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${leadsToExport.length} leads to CSV`);
  }

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
                l.source?.toLowerCase().includes(q)
              );
            })
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        : [],
    [leads, org, market, stageFilter, searchQuery],
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

  const allowed = hasModuleAccess(user.role, org.plan, "crm", "view");
  const canEdit = hasModuleAccess(user.role, org.plan, "crm", "edit");
  const flags = PLAN_FEATURE_FLAGS[org.plan];

  if (!allowed) {
    return (
      <LockedModule
        title="CRM locked"
        reason="Your role cannot access CRM."
        href="/app/billing"
      />
    );
  }

  const activeLead =
    marketLeads.find((lead) => lead.id === selectedLeadId) || marketLeads[0] || null;
  const activeMessages = activeLead
    ? messages
        .filter((m) => m.leadId === activeLead.id)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    : [];
  const seededMessages =
    activeLead && activeMessages.length === 0
      ? [
          {
            id: `${activeLead.id}_seed`,
            body: `Thread ready · ${activeLead.source}. Next: ${activeLead.nextAction || "First outreach"}`,
            direction: "system" as const,
            sentAt: activeLead.updatedAt,
          },
        ]
      : activeMessages.map((m) => ({
          id: m.id,
          body: m.body,
          direction: m.direction,
          sentAt: m.sentAt,
        }));

  const enrollment = activeLead
    ? enrollments.find((e) => e.leadId === activeLead.id)
    : undefined;
  const activeWorkflow = {
    followUp: enrollment?.followUp ?? (activeLead?.stage !== "won" && activeLead?.stage !== "lost"),
    nurture:
      enrollment?.nurture ??
      (activeLead?.stage === "new" || activeLead?.stage === "contacted"),
  };

  const callQueue = marketLeads
    .filter((lead) => lead.phones?.length || lead.phone)
    .slice(0, 4);

  const inboxTasks = tasks.filter((t) => t.status === "open").slice(0, 8);

  function goToLeadThread(leadId: string) {
    setSelectedLeadId(leadId);
    setTab("inbox");
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsBar>
          <TabsList>
            <TabsTrigger value="pipeline">
              <ListChecks className="h-3.5 w-3.5" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <ContactIcon className="h-3.5 w-3.5" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="inbox">
              <InboxIcon className="h-3.5 w-3.5" />
              Texting inbox
            </TabsTrigger>
            <TabsTrigger value="calls">
              <Phone className="h-3.5 w-3.5" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="automations">
              <Workflow className="h-3.5 w-3.5" />
              Automations
            </TabsTrigger>
          </TabsList>
        </TabsBar>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Pipeline leads" value={String(marketLeads.length)} />
          <Kpi label="Contacts" value={String(marketContacts.length)} />
          <Kpi label="Open tasks" value={String(inboxTasks.length)} />
          <Kpi
            label="SMS threads"
            value={String(new Set(messages.map((m) => m.leadId)).size)}
          />
          <Kpi label="Calls logged" value={String(callLogs.length)} />
        </div>

        <TabsContent value="pipeline" className="mt-4 space-y-4">
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
            <select
              className="h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value as LeadStage | "all"); setCurrentPage(1); }}
            >
              <option value="all">All stages</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage[0].toUpperCase() + stage.slice(1)}
                </option>
              ))}
            </select>
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
                <InviteModal
                  plan={org.plan}
                  currentMemberCount={members.length}
                  onInvite={async (newMember) => {
                    // Simulates team member invitation
                    toast.success(`Invited ${newMember.name} (${newMember.email}) as ${newMember.role}`);
                  }}
                />
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
                    await addLead({
                      name: leadName,
                      email: String(form.get("email")),
                      phone: String(form.get("phone") || ""),
                      type: String(form.get("type")) as LeadType,
                      stage: "new",
                      score: Number(form.get("score") || 50),
                      assignedTo: user.id,
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
                      nextAction: String(form.get("nextAction") || "First outreach"),
                      nextActionDueAt: new Date().toISOString(),
                      priority: String(form.get("priority") || "medium") as Priority,
                    });
                    formEl.reset();
                    setShowLeadForm(false);
                    toast.success(`Lead "${leadName}" added to pipeline`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Failed to add lead";
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <Input name="name" placeholder="Name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="phone" placeholder="Phone number" />
              <select
                name="phoneSource"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="manual"
              >
                {PHONE_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <Input name="source" placeholder="Lead source" />
              <select
                name="type"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="buyer"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="landlord">Landlord</option>
                <option value="tenant">Tenant</option>
              </select>
              <Input name="budget" type="number" placeholder="Budget" />
              <Input name="nextAction" placeholder="Next action" />
              <select
                name="phoneConsent"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="unknown"
              >
                <option value="unknown">Consent unknown</option>
                <option value="opted_in">Opted in</option>
                <option value="opted_out">Opted out</option>
              </select>
              <select
                name="priority"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="medium"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                name="phoneVerification"
                className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
                defaultValue="unverified"
              >
                <option value="unverified">Unverified number</option>
                <option value="valid">Verified valid</option>
                <option value="invalid">Marked invalid</option>
              </select>
              {flags.leadScoring ? (
                <Input name="score" type="number" placeholder="Score 0-100" defaultValue={60} />
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
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Owner</TH>
                  <TH>Type</TH>
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
                      <TD>
                        <button
                          type="button"
                          onClick={() => setViewDetailLead(lead)}
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
                        {canEdit ? (
                          <select
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
                                {s}
                              </option>
                            ))}
                          </select>
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
                          onClick={() => setViewDetailLead(lead)}
                          title="View lead details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
              title={searchQuery ? "No leads match your search" : "No leads yet"}
              description={
                searchQuery
                  ? "Try a different name, email, or source."
                  : "Add your first lead to start building the pipeline."
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

        <TabsContent value="inbox" className="mt-4">
          <section className="hero-card overflow-hidden rounded-[2rem]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-semibold">Texting inbox</h2>
              <p className="text-sm text-[var(--muted)]">
                Persisted conversations with Twilio send when configured.
              </p>
            </div>

            <div className="grid min-h-[30rem] lg:grid-cols-[18rem_1fr]">
              <aside className="border-r border-[var(--border)] bg-[var(--surface-muted)] p-3">
                <div className="space-y-2">
                  {marketLeads.map((lead) => {
                    const phone = lead.phones?.find((item) => item.preferred) || lead.phones?.[0];
                    const isActive = activeLead?.id === lead.id;
                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          isActive
                            ? "border-[var(--accent)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
                            : "border-[var(--border)] bg-transparent hover:bg-[var(--surface)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{lead.name}</p>
                          {lead.priority ? (
                            <Badge className="capitalize">{lead.priority}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {phone?.number || lead.phone || "No number"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex flex-col">
                {activeLead ? (
                  <>
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <h3 className="font-semibold">{activeLead.name}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {(activeLead.phones || [])
                          .map((phone) => `${phone.label}: ${phone.number}`)
                          .join(" · ") || activeLead.phone}
                      </p>
                    </div>

                    <div className="flex-1 space-y-3 bg-[var(--surface-muted)] px-4 py-4">
                      {seededMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                            message.direction === "outbound"
                              ? "ml-auto bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "bg-[var(--surface)] text-[var(--foreground)]"
                          }`}
                        >
                          <p>{message.body}</p>
                          <p className="mt-2 text-[11px] opacity-70">
                            {message.direction} · {formatDate(message.sentAt, market)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-[var(--border)] p-4">
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        placeholder="Write an SMS…"
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busy || !draftText.trim()}
                          onClick={() => {
                            void (async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                await sendSms({
                                  leadId: activeLead.id,
                                  body: draftText.trim(),
                                });
                                setDraftText("");
                                toast.success("Message sent");
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : "Send failed";
                                setError(msg);
                                toast.error(msg);
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Send text
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setDraftText(
                              `Hi ${activeLead.name.split(" ")[0]}, just checking whether you’re still available for the next step.`,
                            )
                          }
                        >
                          Insert template
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-sm text-[var(--muted)]">No lead selected.</div>
                )}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <section className="hero-card rounded-[2rem] p-4">
            <h2 className="font-semibold">Call queue</h2>
            <p className="text-sm text-[var(--muted)]">
              Leads with a phone number ready to dial next.
            </p>
            {callQueue.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {callQueue.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                  >
                    <p className="font-medium">{lead.name}</p>
                    <p className="mt-2 text-sm">
                      {lead.phones?.[0]?.number || lead.phone}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {lead.nextAction || "Call required"}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          void logCall({ leadId: lead.id, outcome: "connected" });
                        }}
                      >
                        Log call
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          void logCall({ leadId: lead.id, outcome: "voicemail" });
                        }}
                      >
                        Voicemail
                      </Button>
                    </div>
                  </div>
                ))}
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

        <TabsContent value="automations" className="mt-4 space-y-4">
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
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to delete automation",
                );
              } finally {
                setBusy(false);
              }
            }}
          />

          {activeLead ? (
            <section className="hero-card rounded-[2rem] p-4">
              <h2 className="font-semibold">Lead enrollment</h2>
              <p className="text-sm text-[var(--muted)]">
                Quick toggles for {activeLead.name} on the primary follow-up sequence.
              </p>
              <div className="mt-4 space-y-3">
                <WorkflowRow
                  title="Follow-up sequence"
                  description="Reminder texts after contact and viewing stages."
                  checked={Boolean(activeWorkflow.followUp)}
                  onChange={(checked) => {
                    void setLeadWorkflow({
                      leadId: activeLead.id,
                      followUp: checked,
                      nurture: Boolean(activeWorkflow.nurture),
                    });
                  }}
                />
                <WorkflowRow
                  title="Long-tail nurture"
                  description="Keep colder leads warm with periodic check-ins."
                  checked={Boolean(activeWorkflow.nurture)}
                  onChange={(checked) => {
                    void setLeadWorkflow({
                      leadId: activeLead.id,
                      followUp: Boolean(activeWorkflow.followUp),
                      nurture: checked,
                    });
                  }}
                />
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
              <button
                type="button"
                onClick={() => setViewDetailLead(null)}
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold">Lead Details & Activity</h3>
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-4 text-sm">
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Next Action</span>
                  <span>{viewDetailLead.nextAction || "None scheduled"}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--muted)] font-medium block">Owner / Assigned Agent</span>
                  <span>{members.find((m) => m.id === viewDetailLead.assignedTo)?.name || "Unassigned"}</span>
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
            </div>

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
                    const lines = csvText.trim().split("\n");
                    let importedCount = 0;
                    const hasHeader = lines[0].toLowerCase().includes("name");
                    const dataLines = hasHeader ? lines.slice(1) : lines;

                    for (const line of dataLines) {
                      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
                      if (!cols[0]) continue;
                      await addLead({
                        name: cols[0],
                        email: cols[1] || `imported_${Date.now()}@lead.com`,
                        phone: cols[2] || "",
                        type: (cols[3] as LeadType) || "buyer",
                        stage: "new",
                        score: 60,
                        assignedTo: user.id,
                        market,
                        source: cols[5] || "CSV Import",
                        budget: Number(cols[4]) || undefined,
                        nextAction: "Initial contact after import",
                      });
                      importedCount++;
                    }
                    toast.success(`Successfully imported ${importedCount} leads`);
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-card data-card-hover p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl">{value}</p>
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
  market: "uk" | "us";
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
  ) => Promise<void>;
  onOpenThread: (leadId: string) => void;
}

function ContactsDirectory({
  contacts,
  leads,
  members,
  canEdit,
  busy,
  setBusy,
  setError,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone, company, tag…"
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | "all")}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <Button
            onClick={() => {
              setEditingId(null);
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Close form" : "Add contact"}
          </Button>
        ) : null}
      </div>

      {showForm && canEdit ? (
        <ContactForm onSubmit={(form) => void handleSubmit(form)} busy={busy} />
      ) : null}

      {editingContact && canEdit ? (
        <ContactForm
          contact={editingContact}
          busy={busy}
          onSubmit={(form) => void handleSubmit(form, editingContact)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="No contacts match"
          description="Try a different search, or add your first contact to start the address book."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact) => {
            const owner = members.find((m) => m.id === contact.assignedTo);
            const linkedLead = contact.leadId
              ? leads.find((l) => l.id === contact.leadId)
              : undefined;
            const isPromoting = promotingId === contact.id;
            return (
              <div
                key={contact.id}
                className="data-card flex flex-col gap-3 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={contact.name} />
                    <div>
                      <p className="font-semibold leading-tight">{contact.name}</p>
                      {contact.company ? (
                        <p className="text-xs text-[var(--muted)]">{contact.company}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge tone={CATEGORY_TONE[contact.category]}>
                    {CATEGORY_LABELS[contact.category]}
                  </Badge>
                </div>

                <div className="space-y-1 text-sm text-[var(--muted)]">
                  {contact.phone ? <p>{contact.phone}</p> : null}
                  {contact.email ? <p className="truncate">{contact.email}</p> : null}
                  {owner ? <p>Owner: {owner.name}</p> : null}
                </div>

                {contact.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} className="lowercase">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {contact.notes ? (
                  <p className="line-clamp-2 text-xs text-[var(--muted)]">
                    {contact.notes}
                  </p>
                ) : null}

                {linkedLead ? (
                  <button
                    type="button"
                    onClick={() => onOpenThread(linkedLead.id)}
                    className="flex items-center gap-1.5 self-start rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:opacity-80"
                  >
                    <Sparkles className="h-3 w-3" />
                    In pipeline · {linkedLead.stage}
                  </button>
                ) : null}

                {canEdit ? (
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
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
                          <select
                            className="h-8 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                            value={promoteType}
                            onChange={(e) => setPromoteType(e.target.value as LeadType)}
                          >
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                            <option value="landlord">Landlord</option>
                            <option value="tenant">Tenant</option>
                          </select>
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
                      className="ml-auto text-[var(--danger)] hover:bg-[var(--danger-soft)]"
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContactForm({
  contact,
  busy,
  onSubmit,
  onCancel,
}: {
  contact?: Contact;
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
      <Input name="phone" placeholder="Phone number" defaultValue={contact?.phone} />
      <select
        name="category"
        className="h-10 rounded-md border border-[var(--border)] px-3 text-sm"
        defaultValue={contact?.category || "other"}
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
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

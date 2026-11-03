"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuSelect } from "@/components/ui/select";
import { PhoneField } from "@/components/crm/phone-field";
import {
  FromNumberSelect,
  defaultFromNumber,
  resolveOwnedNumbers,
} from "@/components/crm/from-number-select";
import { useAppSession } from "@/lib/app/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONTACT_CATEGORIES,
  contactImportTemplateCsv,
  contactsToCsv,
  mergeTags,
  parseContactImportCsv,
  removeTags,
} from "@/lib/crm/contact-bulk";
import {
  BULK_ACTION_LABELS,
  clearBulkActions,
  loadBulkActions,
  recordBulkAction,
  type BulkActionRecord,
} from "@/lib/crm/bulk-action-log";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/utils";
import type {
  Contact,
  ContactCategory,
  LeadStage,
  LeadType,
  Market,
} from "@/types";
import {
  BellOff,
  ChevronDown,
  Download,
  Filter,
  History,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

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

type DndFilter = "all" | "on" | "off";
type PipelineFilter = "all" | "in" | "out";
type ChannelFilter = "all" | "phone" | "email" | "both" | "none";

export interface ContactsDirectoryProps {
  contacts: Contact[];
  leads: { id: string; name: string; stage: LeadStage }[];
  members: { id: string; name: string }[];
  canEdit: boolean;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  market: Market;
  userId: string;
  orgId: string;
  isContactDnd: (contactId: string) => boolean;
  setContactDnd: (contactId: string, enabled: boolean) => Promise<void>;
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
  sendSms: (input: {
    leadId: string;
    body: string;
    from?: string;
    kind?: "manual" | "bulk" | "automation" | "sequence";
  }) => Promise<unknown>;
  onOpenThread: (leadId: string, channel?: "sms" | "email") => void;
}

export function ContactsDirectory({
  contacts,
  leads,
  members,
  canEdit,
  busy,
  setBusy,
  setError,
  market,
  userId,
  orgId,
  isContactDnd,
  setContactDnd,
  addContact,
  updateContact,
  deleteContact,
  promoteContactToLead,
  sendSms,
  onOpenThread,
}: ContactsDirectoryProps) {
  const { org } = useAppSession();
  const ownedNumbers = resolveOwnedNumbers(org);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dndFilter, setDndFilter] = useState<DndFilter>("all");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkSms, setShowBulkSms] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [bulkFrom, setBulkFrom] = useState(() => defaultFromNumber(ownedNumbers));
  const [csvText, setCsvText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteType, setPromoteType] = useState<LeadType>("buyer");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTags, setBulkTags] = useState("");
  const [bulkCategory, setBulkCategory] = useState<ContactCategory | "">("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkPromoteType, setBulkPromoteType] = useState<LeadType>("buyer");
  const [history, setHistory] = useState<BulkActionRecord[]>([]);

  useEffect(() => {
    setHistory(loadBulkActions(orgId, userId));
  }, [orgId, userId]);

  useEffect(() => {
    const next = defaultFromNumber(ownedNumbers);
    if (!next) return;
    if (!ownedNumbers.some((row) => row.phoneNumber === bulkFrom)) {
      setBulkFrom(next);
    }
  }, [bulkFrom, ownedNumbers]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        if (tag.trim()) set.add(tag.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => categoryFilter === "all" || c.category === categoryFilter)
      .filter((c) => tagFilter === "all" || c.tags.some((tag) => tag === tagFilter))
      .filter((c) => ownerFilter === "all" || c.assignedTo === ownerFilter)
      .filter((c) => {
        if (dndFilter === "all") return true;
        const on = isContactDnd(c.id);
        return dndFilter === "on" ? on : !on;
      })
      .filter((c) => {
        if (pipelineFilter === "all") return true;
        const inPipeline = Boolean(c.leadId && leads.some((lead) => lead.id === c.leadId));
        return pipelineFilter === "in" ? inPipeline : !inPipeline;
      })
      .filter((c) => {
        const hasPhone = Boolean(c.phone?.trim());
        const hasEmail = Boolean(c.email?.trim());
        if (channelFilter === "phone") return hasPhone;
        if (channelFilter === "email") return hasEmail;
        if (channelFilter === "both") return hasPhone && hasEmail;
        if (channelFilter === "none") return !hasPhone && !hasEmail;
        return true;
      })
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
  }, [
    categoryFilter,
    channelFilter,
    contacts,
    dndFilter,
    isContactDnd,
    leads,
    ownerFilter,
    pipelineFilter,
    query,
    tagFilter,
  ]);

  const editingContact = editingId ? contacts.find((c) => c.id === editingId) : null;
  const selectedContacts = contacts.filter((contact) => selectedIds.has(contact.id));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((contact) => selectedIds.has(contact.id));
  const activeFilterCount = [
    categoryFilter !== "all",
    tagFilter !== "all",
    ownerFilter !== "all",
    dndFilter !== "all",
    pipelineFilter !== "all",
    channelFilter !== "all",
  ].filter(Boolean).length;

  function logAction(input: Omit<BulkActionRecord, "id" | "at">) {
    setHistory(recordBulkAction(orgId, userId, input));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      if (allFilteredSelected) {
        const next = new Set(current);
        for (const contact of filtered) next.delete(contact.id);
        return next;
      }
      const next = new Set(current);
      for (const contact of filtered) next.add(contact.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetFilters() {
    setCategoryFilter("all");
    setTagFilter("all");
    setOwnerFilter("all");
    setDndFilter("all");
    setPipelineFilter("all");
    setChannelFilter("all");
  }

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
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        company: String(form.get("company") || "").trim(),
        category: String(form.get("category") || "other") as ContactCategory,
        tags,
        notes: String(form.get("notes") || "").trim(),
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

  async function runBulk(action: () => Promise<void>, success: string) {
    if (!selectedContacts.length) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bulk action failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function importContacts() {
    setBusy(true);
    setError(null);
    try {
      const { rows, skipped } = parseContactImportCsv(csvText, contacts);
      let imported = 0;
      for (const row of rows) {
        await addContact({
          name: row.name,
          email: row.email || "",
          phone: row.phone || "",
          company: row.company || "",
          category: row.category,
          tags: row.tags,
          notes: row.notes || "",
          assignedTo: userId,
        });
        imported += 1;
      }
      logAction({
        type: "import",
        label: `Imported ${imported} contact${imported === 1 ? "" : "s"}`,
        count: imported,
        skipped: skipped.length,
        detail: skipped.slice(0, 3).join(", ") || undefined,
      });
      if (skipped.length) {
        toast.warning(
          `Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}`,
        );
      }
      toast.success(`Imported ${imported} contact${imported === 1 ? "" : "s"}`);
      setCsvText("");
      setShowBulkImport(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendBulkSms() {
    const body = smsBody.trim();
    if (!body) {
      toast.error("Write a message first");
      return;
    }
    setBusy(true);
    setError(null);
    let ok = 0;
    let failed = 0;
    let skipped = 0;
    try {
      for (const contact of selectedContacts) {
        if (!contact.phone?.trim()) {
          skipped += 1;
          continue;
        }
        if (isContactDnd(contact.id)) {
          skipped += 1;
          continue;
        }
        try {
          let leadId =
            contact.leadId && leads.some((lead) => lead.id === contact.leadId)
              ? contact.leadId
              : undefined;
          if (!leadId) {
            if (!canEdit) {
              skipped += 1;
              continue;
            }
            leadId = await promoteContactToLead(contact.id, {
              type: "buyer",
              source: "Bulk SMS",
            });
          }
          if (!leadId) {
            failed += 1;
            continue;
          }
          await sendSms({
            leadId,
            body,
            from: bulkFrom || undefined,
            kind: "bulk",
          });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      logAction({
        type: "sms",
        label: `Bulk SMS to ${ok} contact${ok === 1 ? "" : "s"}`,
        count: selectedContacts.length,
        ok,
        failed,
        skipped,
        detail: body.slice(0, 80),
      });
      if (ok) toast.success(`Sent ${ok} text${ok === 1 ? "" : "s"}`);
      if (failed || skipped) {
        toast.warning(
          `${failed ? `${failed} failed` : ""}${failed && skipped ? ", " : ""}${
            skipped ? `${skipped} skipped` : ""
          }`,
        );
      }
      if (!ok && !failed && skipped) toast.warning("Nothing to send — missing phones or DND");
      setShowBulkSms(false);
      setSmsBody("");
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
          <Button
            variant="secondary"
            className="shrink-0"
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
          </Button>
          <Button
            variant="secondary"
            className="shrink-0"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-3.5 w-3.5" />
            Bulk log
          </Button>
          {canEdit ? (
            <>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setShowBulkImport(true);
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Bulk add
              </Button>
              <Button
                className="shrink-0"
                onClick={() => {
                  setShowBulkImport(false);
                  setEditingId(null);
                  setShowForm((v) => !v);
                }}
              >
                {showForm ? "Close form" : "Add contact"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="grid gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <MenuSelect
            aria-label="Category filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | "all")}
          >
            <option value="all">All categories</option>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </MenuSelect>
          <MenuSelect
            aria-label="Tag filter"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </MenuSelect>
          <MenuSelect
            aria-label="Owner filter"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="all">All owners</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </MenuSelect>
          <MenuSelect
            aria-label="DND filter"
            value={dndFilter}
            onChange={(e) => setDndFilter(e.target.value as DndFilter)}
          >
            <option value="all">DND · any</option>
            <option value="on">DND on</option>
            <option value="off">DND off</option>
          </MenuSelect>
          <MenuSelect
            aria-label="Pipeline filter"
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value as PipelineFilter)}
          >
            <option value="all">Pipeline · any</option>
            <option value="in">In pipeline</option>
            <option value="out">Not in pipeline</option>
          </MenuSelect>
          <MenuSelect
            aria-label="Channel filter"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
          >
            <option value="all">Channels · any</option>
            <option value="phone">Has phone</option>
            <option value="email">Has email</option>
            <option value="both">Phone and email</option>
            <option value="none">No phone or email</option>
          </MenuSelect>
          {activeFilterCount ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showHistory ? (
        <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Bulk action log</p>
              <p className="text-xs text-[var(--muted)]">
                Imports, tags, SMS, and other bulk runs on this seat.
              </p>
            </div>
            {history.length ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearBulkActions(orgId, userId);
                  setHistory([]);
                }}
              >
                Clear log
              </Button>
            ) : null}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No bulk actions yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 rounded-xl border border-[var(--border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {BULK_ACTION_LABELS[row.type]}
                      {row.detail ? ` · ${row.detail}` : ""}
                      {row.ok != null || row.failed != null || row.skipped != null
                        ? ` · ok ${row.ok ?? 0}, failed ${row.failed ?? 0}, skipped ${row.skipped ?? 0}`
                        : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-[var(--muted)]">
                    {formatDate(row.at, market)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="space-y-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {selectedIds.size} selected
              <button
                type="button"
                className="ml-3 text-xs font-semibold text-[var(--accent)] hover:underline"
                onClick={clearSelection}
              >
                Clear
              </button>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setShowBulkSms(true)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Bulk SMS
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  downloadCsv(
                    `contacts_${new Date().toISOString().slice(0, 10)}.csv`,
                    contactsToCsv(selectedContacts),
                  );
                  logAction({
                    type: "export",
                    label: `Exported ${selectedContacts.length} contact${selectedContacts.length === 1 ? "" : "s"}`,
                    count: selectedContacts.length,
                  });
                  toast.success("Exported selected contacts");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" disabled={busy}>
                    More actions
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Category</DropdownMenuLabel>
                  <div className="flex gap-1.5 px-2 pb-2">
                    <MenuSelect
                      className="h-8 flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value as ContactCategory | "")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Choose…</option>
                      {CONTACT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </MenuSelect>
                    <Button
                      size="sm"
                      disabled={busy || !bulkCategory}
                      onClick={() =>
                        void runBulk(async () => {
                          if (!bulkCategory) return;
                          for (const contact of selectedContacts) {
                            await updateContact(contact.id, { category: bulkCategory });
                          }
                          logAction({
                            type: "category",
                            label: `Set category to ${CATEGORY_LABELS[bulkCategory]}`,
                            count: selectedContacts.length,
                            detail: CATEGORY_LABELS[bulkCategory],
                          });
                        }, "Category updated")
                      }
                    >
                      Apply
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Assign owner</DropdownMenuLabel>
                  <div className="flex gap-1.5 px-2 pb-2">
                    <MenuSelect
                      className="h-8 flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                      value={bulkAssignee}
                      onChange={(e) => setBulkAssignee(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Choose…</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </MenuSelect>
                    <Button
                      size="sm"
                      disabled={busy || !bulkAssignee}
                      onClick={() =>
                        void runBulk(async () => {
                          for (const contact of selectedContacts) {
                            await updateContact(contact.id, { assignedTo: bulkAssignee });
                          }
                          const owner = members.find((m) => m.id === bulkAssignee)?.name;
                          logAction({
                            type: "assign",
                            label: `Assigned ${selectedContacts.length} contact${selectedContacts.length === 1 ? "" : "s"}`,
                            count: selectedContacts.length,
                            detail: owner,
                          });
                        }, "Owner updated")
                      }
                    >
                      Apply
                    </Button>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={busy}
                    onSelect={() =>
                      void runBulk(async () => {
                        for (const contact of selectedContacts) {
                          await setContactDnd(contact.id, true);
                        }
                        logAction({
                          type: "dnd_on",
                          label: `DND on for ${selectedContacts.length}`,
                          count: selectedContacts.length,
                        });
                      }, "Do Not Disturb on")
                    }
                  >
                    <BellOff className="h-3.5 w-3.5" />
                    Enable DND
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy}
                    onSelect={() =>
                      void runBulk(async () => {
                        for (const contact of selectedContacts) {
                          await setContactDnd(contact.id, false);
                        }
                        logAction({
                          type: "dnd_off",
                          label: `DND cleared for ${selectedContacts.length}`,
                          count: selectedContacts.length,
                        });
                      }, "Do Not Disturb cleared")
                    }
                  >
                    Clear DND
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Promote to lead</DropdownMenuLabel>
                  <div className="flex gap-1.5 px-2 pb-2">
                    <MenuSelect
                      className="h-8 flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
                      value={bulkPromoteType}
                      onChange={(e) => setBulkPromoteType(e.target.value as LeadType)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="landlord">Landlord</option>
                      <option value="tenant">Tenant</option>
                    </MenuSelect>
                    <Button
                      size="sm"
                      disabled={busy || !canEdit}
                      onClick={() =>
                        void runBulk(async () => {
                          let promoted = 0;
                          for (const contact of selectedContacts) {
                            if (contact.leadId) continue;
                            await promoteContactToLead(contact.id, {
                              type: bulkPromoteType,
                              source: "Bulk",
                            });
                            promoted += 1;
                          }
                          if (!promoted) throw new Error("Selected contacts are already leads");
                          logAction({
                            type: "promote",
                            label: `Promoted ${promoted} contact${promoted === 1 ? "" : "s"}`,
                            count: promoted,
                            detail: bulkPromoteType,
                          });
                        }, "Promoted to pipeline")
                      }
                    >
                      Promote
                    </Button>
                  </div>
                  {canEdit ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        disabled={busy}
                        onSelect={() => {
                          if (
                            !window.confirm(
                              `Delete ${selectedContacts.length} contact${selectedContacts.length === 1 ? "" : "s"}?`,
                            )
                          ) {
                            return;
                          }
                          void runBulk(async () => {
                            const count = selectedContacts.length;
                            for (const contact of selectedContacts) {
                              await deleteContact(contact.id);
                            }
                            clearSelection();
                            logAction({
                              type: "delete",
                              label: `Deleted ${count} contact${count === 1 ? "" : "s"}`,
                              count,
                            });
                          }, "Contacts deleted");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete selected
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Tag className="h-3.5 w-3.5" />
              Tags
            </div>
            <Input
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              placeholder="tag1, tag2"
              className="h-9 flex-1"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || !bulkTags.trim()}
                onClick={() =>
                  void runBulk(async () => {
                    const tags = bulkTags
                      .split(/[|,;]/)
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    for (const contact of selectedContacts) {
                      await updateContact(contact.id, {
                        tags: mergeTags(contact.tags, tags),
                      });
                    }
                    logAction({
                      type: "tags_add",
                      label: `Added tags to ${selectedContacts.length}`,
                      count: selectedContacts.length,
                      detail: tags.join(", "),
                    });
                    setBulkTags("");
                  }, "Tags added")
                }
              >
                Add tags
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !bulkTags.trim()}
                onClick={() =>
                  void runBulk(async () => {
                    const tags = bulkTags
                      .split(/[|,;]/)
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    for (const contact of selectedContacts) {
                      await updateContact(contact.id, {
                        tags: removeTags(contact.tags, tags),
                      });
                    }
                    logAction({
                      type: "tags_remove",
                      label: `Removed tags from ${selectedContacts.length}`,
                      count: selectedContacts.length,
                      detail: tags.join(", "),
                    });
                    setBulkTags("");
                  }, "Tags removed")
                }
              >
                Remove tags
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showForm && canEdit ? (
        <ContactForm market={market} onSubmit={(form) => void handleSubmit(form)} busy={busy} />
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
                ? "Import a CSV, add contacts one by one, or wait for leads with an email or phone."
                : "Leads with an email or phone show up here. Adding a contact directly needs CRM edit access."
            }
          />
        ) : (
          <EmptyState
            title="No contacts match your filters"
            description="Try clearing filters or searching a different term."
          />
        )
      ) : (
        <ul className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">
          <li className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 sm:px-5">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
              aria-label="Select all visible contacts"
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {filtered.length} contact{filtered.length === 1 ? "" : "s"}
            </p>
          </li>
          {filtered.map((contact) => {
            const owner = members.find((m) => m.id === contact.assignedTo);
            const linkedLead = contact.leadId
              ? leads.find((l) => l.id === contact.leadId)
              : undefined;
            const isPromoting = promotingId === contact.id;
            const selected = selectedIds.has(contact.id);
            return (
              <li
                key={contact.id}
                className={`border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:px-5 ${
                  selected ? "bg-[var(--accent-soft)]/40" : ""
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(contact.id)}
                      aria-label={`Select ${contact.name}`}
                      className="mt-2 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--accent)]"
                    />
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
                        {isContactDnd(contact.id) ? (
                          <Badge tone="warning">
                            <BellOff className="mr-1 inline h-3 w-3" />
                            DND
                          </Badge>
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
                            <button
                              key={tag}
                              type="button"
                              className="inline-flex"
                              onClick={() => {
                                setTagFilter(tag);
                                setShowFilters(true);
                              }}
                            >
                              <Badge className="lowercase">{tag}</Badge>
                            </button>
                          ))}
                          {contact.notes ? (
                            <p className="line-clamp-1 text-xs text-[var(--muted)]">{contact.notes}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:max-w-[28rem] lg:shrink-0 lg:justify-end">
                    <Button
                      size="sm"
                      variant={isContactDnd(contact.id) ? "secondary" : "ghost"}
                      disabled={busy}
                      aria-pressed={isContactDnd(contact.id)}
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          setError(null);
                          try {
                            const next = !isContactDnd(contact.id);
                            await setContactDnd(contact.id, next);
                            toast.success(
                              next ? "Do Not Disturb on" : "Do Not Disturb cleared",
                            );
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Could not update Do Not Disturb",
                            );
                          } finally {
                            setBusy(false);
                          }
                        })();
                      }}
                    >
                      <BellOff className="h-3.5 w-3.5" />
                      {isContactDnd(contact.id) ? "Clear DND" : "DND"}
                    </Button>
                    {canEdit ? (
                      <>
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
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showBulkImport && canEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="surface-panel w-full max-w-lg space-y-4 rounded-[1.75rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Bulk add contacts</h2>
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                aria-label="Close bulk add"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Alert>
              Paste CSV with headers{" "}
              <code className="text-xs">name, email, phone, company, category, tags, notes</code>.
              Phones need a country code. Duplicates by email or phone are skipped.
            </Alert>
            <textarea
              className="min-h-40 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs"
              placeholder={`name,email,phone,company,category,tags,notes\nJane Smith,jane@brokerage.com,+447700900111,Northbridge,lead,"buyer, hot",Met at viewing`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  downloadCsv("contacts_import_template.csv", contactImportTemplateCsv());
                  toast.success("Template downloaded");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Download template
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowBulkImport(false)}>
                  Cancel
                </Button>
                <Button disabled={!csvText.trim() || busy} onClick={() => void importContacts()}>
                  {busy ? "Importing…" : "Import contacts"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showBulkSms ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="surface-panel w-full max-w-lg space-y-4 rounded-[1.75rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Bulk SMS</h2>
              <button
                type="button"
                onClick={() => setShowBulkSms(false)}
                className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                aria-label="Close bulk SMS"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Alert>
              Sends to selected contacts with a phone number. Contacts on DND and rows without a
              phone are skipped. People not yet in the pipeline are promoted first when you have
              edit access.
            </Alert>
            <FromNumberSelect
              numbers={ownedNumbers}
              value={bulkFrom}
              onChange={setBulkFrom}
              id="bulk-sms-from-number"
            />
            <Textarea
              rows={5}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="Write the text…"
            />
            <p className="text-xs text-[var(--muted)]">
              {selectedContacts.filter((c) => c.phone && !isContactDnd(c.id)).length} of{" "}
              {selectedContacts.length} selected look ready to text.
              {bulkFrom ? ` From ${bulkFrom}.` : ""}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowBulkSms(false)}>
                Cancel
              </Button>
              <Button disabled={busy || !smsBody.trim()} onClick={() => void sendBulkSms()}>
                {busy ? "Sending…" : "Send texts"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
        {CONTACT_CATEGORIES.map((c) => (
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

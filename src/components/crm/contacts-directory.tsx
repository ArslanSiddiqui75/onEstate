"use client";

import { useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MenuSelect } from "@/components/ui/select";
import { PhoneField } from "@/components/crm/phone-field";
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
import { downloadCsv } from "@/lib/csv";
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
  Mail,
  Pencil,
  Phone,
  Search,
  Sparkles,
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
  isContactDnd,
  setContactDnd,
  addContact,
  updateContact,
  deleteContact,
  promoteContactToLead,
  onOpenThread,
}: ContactsDirectoryProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteType, setPromoteType] = useState<LeadType>("buyer");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTags, setBulkTags] = useState("");
  const [bulkCategory, setBulkCategory] = useState<ContactCategory | "">("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkPromoteType, setBulkPromoteType] = useState<LeadType>("buyer");

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
  const selectedContacts = contacts.filter((contact) => selectedIds.has(contact.id));
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((contact) => selectedIds.has(contact.id));

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
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </MenuSelect>
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

      {selectedIds.size > 0 ? (
        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
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
                onClick={() => {
                  downloadCsv(
                    `contacts_${new Date().toISOString().slice(0, 10)}.csv`,
                    contactsToCsv(selectedContacts),
                  );
                  toast.success("Exported selected contacts");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" disabled={busy}>
                    Bulk actions
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Tags</DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <Input
                      value={bulkTags}
                      onChange={(e) => setBulkTags(e.target.value)}
                      placeholder="tag1, tag2"
                      className="h-8"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1"
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
                            setBulkTags("");
                          }, "Tags added")
                        }
                      >
                        Add tags
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
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
                            setBulkTags("");
                          }, "Tags removed")
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
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
                            for (const contact of selectedContacts) {
                              await deleteContact(contact.id);
                            }
                            clearSelection();
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
            title="No contacts match your search"
            description="Try a different search term or category filter."
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

                  <div className="flex flex-wrap items-center gap-2 lg:max-w-[28rem] lg:shrink-0 lg:justify-end">
                    <Button
                      size="sm"
                      variant={isContactDnd(contact.id) ? "secondary" : "ghost"}
                      disabled={busy}
                      aria-pressed={isContactDnd(contact.id)}
                      aria-label={
                        isContactDnd(contact.id)
                          ? `Clear Do Not Disturb for ${contact.name}`
                          : `Do Not Disturb ${contact.name}`
                      }
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

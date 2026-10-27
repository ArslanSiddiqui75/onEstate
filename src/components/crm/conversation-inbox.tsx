"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { PhoneField } from "@/components/crm/phone-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildPhoneContactMethod, asErrorMessage, cn, formatDate } from "@/lib/utils";
import type {
  Contact,
  ConversationMessage,
  Lead,
  Market,
  OrgMember,
} from "@/types";
import { ArrowLeft, Mail, Phone, Search, Send, SquarePen } from "lucide-react";

type InboxFilter = "all" | "mine" | "reply" | "recent";
type Channel = "sms" | "email";

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Assigned to me" },
  { id: "reply", label: "Needs reply" },
  { id: "recent", label: "Recent" },
];

function leadPhone(lead: Lead) {
  return (
    lead.phones?.find((item) => item.preferred)?.number ||
    lead.phones?.[0]?.number ||
    lead.phone ||
    ""
  );
}

function activityAt(lead: Lead, last?: ConversationMessage) {
  return last?.sentAt || lead.updatedAt || lead.createdAt;
}

function previewText(last?: ConversationMessage) {
  if (!last) return "No messages yet";
  if (last.channel === "email" && last.subject?.trim()) return last.subject.trim();
  const text = last.body.replace(/\s+/g, " ").trim();
  return text || "No messages yet";
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatStamp(iso: string, market: Market) {
  const date = new Date(iso);
  const now = new Date();
  const locale = market === "uk" ? "en-GB" : "en-US";
  if (sameDay(date, now)) {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function dayLabel(iso: string, market: Market) {
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return formatDate(iso, market);
}

function human(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function digits(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function phoneKeys(person: { phone?: string; phones?: { number: string }[] }) {
  return new Set(
    [person.phone, ...(person.phones || []).map((item) => item.number)]
      .map(digits)
      .filter((value) => value.length >= 7),
  );
}

function samePerson(
  left: { email?: string; phone?: string; phones?: { number: string }[] },
  right: { email?: string; phone?: string; phones?: { number: string }[] },
) {
  const emailA = left.email?.trim().toLowerCase();
  const emailB = right.email?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) return true;
  const phones = phoneKeys(right);
  for (const key of phoneKeys(left)) {
    if (phones.has(key)) return true;
  }
  return false;
}

function leadForContact(contact: Contact, leads: Lead[]) {
  if (contact.leadId) {
    const linked = leads.find((lead) => lead.id === contact.leadId);
    if (linked) return linked;
  }
  return leads.find((lead) => samePerson(contact, lead));
}

export function ConversationInbox({
  leads,
  contacts,
  messages,
  members,
  market,
  userId,
  orgName,
  canEdit,
  selectedLeadId,
  composeChannel,
  pinnedLeadId,
  onSelect,
  onError,
  sendSms,
  sendEmail,
  addLead,
  promoteContactToLead,
}: {
  leads: Lead[];
  contacts: Contact[];
  messages: ConversationMessage[];
  members: OrgMember[];
  market: Market;
  userId: string;
  orgName: string;
  canEdit: boolean;
  selectedLeadId: string | null;
  composeChannel?: "sms" | "email";
  pinnedLeadId?: string | null;
  onSelect: (id: string | null) => void;
  onError: (message: string | null) => void;
  sendSms: (input: { leadId: string; body: string }) => Promise<unknown>;
  sendEmail: (input: { leadId: string; subject: string; body: string }) => Promise<unknown>;
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  promoteContactToLead: (
    contactId: string,
    input: { type: Lead["type"]; source?: string },
  ) => Promise<string | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [channel, setChannel] = useState<Channel>("sms");
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [watchName, setWatchName] = useState<string | null>(null);
  const [watchContactId, setWatchContactId] = useState<string | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const knownIds = useRef<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  const latestByLead = useMemo(() => {
    const map = new Map<string, ConversationMessage>();
    for (const message of messages) {
      const prev = map.get(message.leadId);
      if (!prev || message.sentAt > prev.sentAt) map.set(message.leadId, message);
    }
    return map;
  }, [messages]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const weekAgo = Date.now() - 7 * 86_400_000;
    return leads
      .filter((lead) => {
        const last = latestByLead.get(lead.id);
        if (filter === "mine" && lead.assignedTo !== userId) return false;
        if (filter === "reply" && last?.direction !== "inbound") return false;
        if (filter === "recent" && new Date(activityAt(lead, last)).getTime() < weekAgo) {
          return false;
        }
        if (!q) return true;
        const phone = leadPhone(lead);
        return (
          lead.name.toLowerCase().includes(q) ||
          (lead.email || "").toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q) ||
          previewText(last).toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        activityAt(b, latestByLead.get(b.id)).localeCompare(
          activityAt(a, latestByLead.get(a.id)),
        ),
      );
  }, [filter, latestByLead, leads, query, userId]);

  const replyCount = useMemo(
    () =>
      leads.filter((lead) => latestByLead.get(lead.id)?.direction === "inbound").length,
    [latestByLead, leads],
  );

  const picked = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const shown = picked ?? rows[0] ?? null;

  const thread = useMemo(() => {
    if (!shown) return [];
    return messages
      .filter((message) => message.leadId === shown.id)
      .slice()
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }, [messages, shown]);

  useEffect(() => {
    if (!watchName) {
      knownIds.current = new Set(leads.map((lead) => lead.id));
      return;
    }
    const created = leads.find(
      (lead) => lead.name === watchName && !knownIds.current.has(lead.id),
    );
    if (!created) return;
    onSelect(created.id);
    setWatchName(null);
  }, [leads, onSelect, watchName]);

  useEffect(() => {
    if (!watchContactId) return;
    const contact = contacts.find((item) => item.id === watchContactId);
    if (!contact) return;
    const lead = leadForContact(contact, leads);
    if (!lead) return;
    onSelect(lead.id);
    setWatchContactId(null);
  }, [contacts, leads, onSelect, watchContactId]);

  const contactMatches = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    return contacts
      .filter((contact) => {
        if (!q) return true;
        return (
          contact.name.toLowerCase().includes(q) ||
          (contact.email || "").toLowerCase().includes(q) ||
          (contact.phone || "").toLowerCase().includes(q)
        );
      })
      .slice(0, q ? 8 : 5);
  }, [contactQuery, contacts]);

  useEffect(() => {
    setDraft("");
    setSubject("");
    setDetailsOpen(false);
  }, [shown?.id]);

  useEffect(() => {
    if (composeChannel) setChannel(composeChannel);
  }, [composeChannel, shown?.id]);

  useEffect(() => {
    if (selectedLeadId || pinnedLeadId || !rows[0]) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    onSelect(rows[0].id);
  }, [onSelect, pinnedLeadId, rows, selectedLeadId]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [shown?.id, thread.length]);

  const threadOpen = Boolean(picked);
  const phone = shown ? leadPhone(shown) : "";
  const owner = shown
    ? members.find((member) => member.id === shown.assignedTo)?.name || "Unassigned"
    : "";
  const missingChannel =
    shown && channel === "sms" && !phone
      ? "This person has no phone number."
      : shown && channel === "email" && !shown.email
        ? "This person has no email address."
        : null;

  async function send() {
    if (!shown || sending || !draft.trim() || missingChannel) return;
    setSending(true);
    onError(null);
    try {
      if (channel === "email") {
        await sendEmail({
          leadId: shown.id,
          subject: subject.trim() || `Following up from ${orgName}`,
          body: draft.trim(),
        });
        toast.success("Email sent");
      } else {
        await sendSms({ leadId: shown.id, body: draft.trim() });
        toast.success("Text sent");
      }
      setDraft("");
      setSubject("");
    } catch (err) {
      const msg = asErrorMessage(err, "Send failed");
      onError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function continueWith(lead: Lead) {
    setFilter("all");
    setQuery("");
    setContactQuery("");
    setCreateOpen(false);
    onSelect(lead.id);
    toast.success(`Continuing with ${lead.name}`);
  }

  async function openContact(contact: Contact) {
    const existing = leadForContact(contact, leads);
    if (existing) {
      continueWith(existing);
      return;
    }
    const phone = contact.phone || contact.phones?.[0]?.number || "";
    if (!phone && !contact.email?.trim()) {
      toast.error("This contact needs a phone number or email first.");
      return;
    }
    setCreating(true);
    onError(null);
    try {
      setWatchContactId(contact.id);
      await promoteContactToLead(contact.id, { type: "buyer", source: "Manual" });
      setFilter("all");
      setQuery("");
      setContactQuery("");
      setCreateOpen(false);
      toast.success(`Conversation started with ${contact.name}`);
    } catch (err) {
      setWatchContactId(null);
      const msg = asErrorMessage(err, "Could not start the conversation");
      onError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function createConversation(form: FormData) {
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const nextPhone = String(form.get("phone") || "").trim();
    if (!name) return;
    if (!email && !nextPhone) {
      toast.error("Add an email or a phone number.");
      return;
    }
    const existing = leads.find((lead) =>
      samePerson({ email, phone: nextPhone }, lead),
    );
    if (existing) {
      continueWith(existing);
      return;
    }
    setCreating(true);
    onError(null);
    try {
      await addLead({
        name,
        email,
        phone: nextPhone,
        type: "buyer",
        stage: "new",
        score: 0,
        assignedTo: userId,
        market,
        source: "Manual",
        phones: nextPhone
          ? [buildPhoneContactMethod({ number: nextPhone, source: "manual" })]
          : [],
        priority: "medium",
        nextAction: "First outreach",
        nextActionDueAt: new Date().toISOString(),
      });
      setWatchName(name);
      setFilter("all");
      setQuery("");
      setCreateOpen(false);
      toast.success("Conversation started");
    } catch (err) {
      const msg = asErrorMessage(err, "Could not start the conversation");
      onError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  function insertTemplate() {
    if (!shown) return;
    const first = shown.name.split(" ")[0];
    setDraft(
      channel === "email"
        ? `Hi ${first},\n\nJust checking whether you’re still available for the next step.\n\nThanks,\n${orgName}`
        : `Hi ${first}, just checking whether you’re still available for the next step.`,
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "flex h-full min-h-0 w-full flex-col border-[var(--border)] lg:w-[21.5rem] lg:shrink-0 lg:border-r",
          threadOpen && "max-lg:hidden",
        )}
      >
        {canEdit ? (
          <div className="px-3 pt-3">
            <Button
              type="button"
              size="sm"
              className="h-9 w-full rounded-full"
              onClick={() => {
                setFormKey((key) => key + 1);
                setContactQuery("");
                setCreateOpen(true);
              }}
            >
              <SquarePen className="h-3.5 w-3.5" />
              New conversation
            </Button>
          </div>
        ) : null}
        <div className="relative px-3 pb-2 pt-2">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div
          className="flex gap-1 overflow-x-auto px-3 pb-2"
          role="group"
          aria-label="Filter conversations"
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            const count = item.id === "reply" ? replyCount : 0;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                  active
                    ? "bg-[var(--foreground)] text-[var(--canvas)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
                {count > 0 ? <span className="ml-1 tabular-nums">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium">
                {leads.length === 0 ? "No conversations yet" : "Nothing in this view"}
              </p>
              <p className="mt-1 max-w-[16rem] text-xs text-[var(--muted)]">
                {leads.length === 0
                  ? "Start a conversation with a name and a phone number or email."
                  : "Try another filter or clear the search."}
              </p>
            </div>
          ) : (
            rows.map((lead) => {
              const last = latestByLead.get(lead.id);
              const active = shown?.id === lead.id;
              const needsReply = last?.direction === "inbound";
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelect(lead.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-[var(--border)] px-3 py-3 text-left",
                    active
                      ? "bg-[var(--accent-soft)] shadow-[inset_3px_0_0_var(--accent)]"
                      : "hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <Avatar name={lead.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{lead.name}</span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {formatStamp(activityAt(lead, last), market)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-[13px] text-[var(--muted)]">
                        {last?.channel === "email" ? "Email · " : last ? "Text · " : ""}
                        {previewText(last)}
                      </span>
                      {needsReply ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                          aria-label="Needs a reply"
                        />
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section
        className={cn(
          "relative min-h-0 min-w-0 flex-1 flex-col",
          threadOpen ? "flex" : "hidden lg:flex",
        )}
      >
        {shown ? (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 sm:px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full lg:hidden"
                aria-label="Back to conversations"
                onClick={() => onSelect(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar name={shown.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{shown.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {phone || shown.email || "No contact details"}
                </p>
              </div>
              {phone ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setChannel("sms")}
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Text
                </Button>
              ) : null}
              {shown.email ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => setChannel("email")}
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Email
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full xl:hidden"
                onClick={() => setDetailsOpen(true)}
              >
                Details
              </Button>
            </header>

            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
              {thread.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="max-w-xs text-center text-sm text-[var(--muted)]">
                    No messages with {shown.name.split(" ")[0]} yet. Write the first one below.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {thread.map((message, index) => {
                    const previous = thread[index - 1];
                    const showDay =
                      !previous ||
                      !sameDay(new Date(previous.sentAt), new Date(message.sentAt));
                    const outbound = message.direction === "outbound";
                    const inbound = message.direction === "inbound";
                    return (
                      <div key={message.id}>
                        {showDay ? (
                          <p className="py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                            {dayLabel(message.sentAt, market)}
                          </p>
                        ) : null}
                        {message.direction === "system" ? (
                          <p className="px-6 py-1 text-center text-xs text-[var(--muted)]">
                            {message.body}
                          </p>
                        ) : (
                          <div className={cn("flex items-end gap-2", outbound && "justify-end")}>
                            {inbound ? <Avatar name={shown.name} size="sm" /> : null}
                            <div
                              className={cn(
                                "max-w-[min(32rem,78%)] px-3.5 py-2 text-sm",
                                outbound
                                  ? "rounded-2xl rounded-br-md bg-[var(--accent)] text-[var(--accent-foreground)]"
                                  : "rounded-2xl rounded-bl-md bg-[var(--surface-muted)] text-[var(--foreground)]",
                              )}
                            >
                              {message.subject ? (
                                <p className="mb-1 text-xs font-semibold opacity-80">
                                  {message.subject}
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap">{message.body}</p>
                              <p className="mt-1 text-[10px] opacity-70">
                                {message.channel === "email" ? "Email" : "Text"}
                                {" · "}
                                {formatStamp(message.sentAt, market)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              className="border-t border-[var(--border)] px-3 py-3 sm:px-4"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="segmented" role="group" aria-label="Message channel">
                  <button
                    type="button"
                    data-active={channel === "sms"}
                    onClick={() => setChannel("sms")}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    data-active={channel === "email"}
                    onClick={() => setChannel("email")}
                  >
                    Email
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
                  onClick={insertTemplate}
                >
                  Insert template
                </button>
              </div>
              {missingChannel ? (
                <p className="mb-2 text-xs text-[var(--muted)]">{missingChannel}</p>
              ) : null}
              {channel === "email" ? (
                <Input
                  className="mb-2 h-9"
                  placeholder="Subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              ) : null}
              <div className="flex items-end gap-2">
                <Textarea
                  rows={1}
                  value={draft}
                  placeholder="Type a message"
                  className="max-h-36 min-h-[2.75rem] flex-1 resize-none py-2"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full"
                  disabled={sending || !draft.trim() || Boolean(missingChannel)}
                  aria-label={channel === "email" ? "Send email" : "Send text"}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="max-w-sm text-sm text-[var(--muted)]">
              {leads.length === 0
                ? "Conversations you start will show up here."
                : "Select a conversation."}
            </p>
          </div>
        )}

        {detailsOpen && shown ? (
          <div className="absolute inset-0 z-10 flex flex-col bg-[var(--surface-solid)] xl:hidden">
            <ContactPanel
              lead={shown}
              phone={phone}
              owner={owner}
              onChannel={(next) => {
                setChannel(next);
                setDetailsOpen(false);
              }}
              onClose={() => setDetailsOpen(false)}
            />
          </div>
        ) : null}
      </section>

      {shown ? (
        <aside className="hidden w-[19.5rem] shrink-0 flex-col border-l border-[var(--border)] xl:flex">
          <ContactPanel
            lead={shown}
            phone={phone}
            owner={owner}
            onChannel={setChannel}
          />
        </aside>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New conversation</DialogTitle>
            <DialogDescription>
              Choose someone already in your contacts, or add a new person. An existing thread stays the same conversation.
            </DialogDescription>
          </DialogHeader>
          {contacts.length > 0 ? (
            <div className="mt-4">
              <input
                type="search"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Search contacts"
                aria-label="Search contacts"
                className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <div className="mt-2 max-h-52 overflow-y-auto">
                {contactMatches.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-[var(--muted)]">No contacts match.</p>
                ) : (
                  contactMatches.map((contact) => {
                    const existing = leadForContact(contact, leads);
                    const detail =
                      contact.phone ||
                      contact.phones?.[0]?.number ||
                      contact.email ||
                      "No phone or email";
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        disabled={creating}
                        onClick={() => void openContact(contact)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-muted)] disabled:opacity-50"
                      >
                        <Avatar name={contact.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{contact.name}</span>
                          <span className="block truncate text-xs text-[var(--muted)]">{detail}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">
                          {existing ? "Continue" : "Start"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Or someone new
              </p>
            </div>
          ) : null}
          <form
            key={formKey}
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createConversation(new FormData(event.currentTarget));
            }}
          >
            <Input name="name" placeholder="Name" required autoFocus />
            <Input name="email" type="email" placeholder="Email" />
            <PhoneField name="phone" market={market} />
            <div className="mt-1 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Starting…" : "Start conversation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactPanel({
  lead,
  phone,
  owner,
  onChannel,
  onClose,
}: {
  lead: Lead;
  phone: string;
  owner: string;
  onChannel: (channel: Channel) => void;
  onClose?: () => void;
}) {
  const facts: { label: string; value: string }[] = [
    { label: "Phone", value: phone || "—" },
    { label: "Email", value: lead.email || "—" },
    { label: "Stage", value: human(lead.stage) },
    { label: "Priority", value: human(lead.priority || "medium") },
    { label: "Source", value: lead.source || "—" },
    { label: "Owner", value: owner },
    { label: "Type", value: human(lead.type) },
  ];
  if (lead.nextAction) facts.push({ label: "Next step", value: lead.nextAction });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={lead.name} size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Contact
            </p>
            <p className="truncate font-semibold">{lead.name}</p>
            <p className="truncate text-xs capitalize text-[var(--muted)]">
              {human(lead.type)} · {human(lead.stage)}
            </p>
          </div>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      <dl className="space-y-3 px-4 py-4 text-sm">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {fact.label}
            </dt>
            <dd className="mt-0.5 break-words">
              {fact.label === "Phone" && phone ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-left hover:underline"
                  onClick={() => onChannel("sms")}
                >
                  <Phone className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                  {fact.value}
                </button>
              ) : fact.label === "Email" && lead.email ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-left hover:underline"
                  onClick={() => onChannel("email")}
                >
                  <Mail className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                  {fact.value}
                </button>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {lead.tags && lead.tags.length > 0 ? (
        <div className="px-4 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tags
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lead.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

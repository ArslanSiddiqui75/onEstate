"use client";

import { MenuSelect } from "@/components/ui/select";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-status";
import { PLATFORM_ADMIN_ACCOUNTS } from "@/lib/admin/accounts";
import { useAdminSession } from "@/lib/admin/session";
import { loadLocalDesk, updateLocalTicket } from "@/lib/admin/ticket-store";
import {
  applyTicketPatch,
  firstResponseMs,
  formatDeskDuration,
  handleClock,
  messageAuthorLabel,
  resolverEmail,
  slaMarkLabel,
  slaMarks,
  SLA_TARGETS_MS,
  supportOperatorName,
  ticketPriorityLabel,
  ticketStatusLabel,
  timeToResolveMs,
  waitingOn,
  type DeskTicket,
  type TicketPatch,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/admin/ticket-desk";
const fieldClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function savedCopy(patch: TicketPatch, actorEmail: string) {
  const name = supportOperatorName(actorEmail);
  if (patch.body && patch.visibility === "internal") return "Internal note saved. The workspace cannot see it.";
  if (patch.status === "resolved") return `Resolved by ${name}.`;
  if (patch.status === "closed") return `Closed by ${name}.`;
  if (patch.body) return "Reply sent.";
  if (patch.assigneeEmail === null) return "Returned to the unassigned queue.";
  if (patch.assigneeEmail) return `Assigned to ${supportOperatorName(patch.assigneeEmail)}.`;
  if (patch.priority) return "Priority updated.";
  if (patch.status) return "Status updated.";
  return "Ticket updated.";
}

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { admin } = useAdminSession();
  const [ticket, setTicket] = useState<DeskTicket | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [source, setSource] = useState<"local" | "hosted">("hosted");
  const [schema, setSchema] = useState<"desk" | "basic">("desk");
  const [reply, setReply] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/tickets/${params.id}`);
    const json = (await res.json().catch(() => null)) as {
      source?: string;
      schema?: string;
      ticket?: DeskTicket;
      error?: string;
    } | null;
    if (json?.source === "local") {
      const found = loadLocalDesk().find((item) => item.id === params.id) || null;
      setSource("local");
      setSchema("desk");
      setTicket(found);
      setPhase(found ? "ready" : "missing");
      return;
    }
    if (!res.ok || !json?.ticket) {
      setError(json?.error || "Could not load this ticket");
      setPhase(res.status === 404 ? "missing" : "error");
      return;
    }
    setSource("hosted");
    setSchema(json.schema === "basic" ? "basic" : "desk");
    setTicket(json.ticket);
    setPhase("ready");
  }, [params.id]);

  useEffect(() => {
    void load().catch(() => {
      setError("Could not load this ticket");
      setPhase("error");
    });
  }, [load]);

  async function act(patch: TicketPatch) {
    if (!ticket || !admin) return false;
    setBusy(true);
    try {
      if (source === "local") {
        const next = updateLocalTicket(ticket.id, (current) =>
          applyTicketPatch(current, patch, { email: admin.email }, new Date()),
        );
        setTicket(next.find((item) => item.id === ticket.id) || null);
        toast.success(savedCopy(patch, admin.email));
        return true;
      }
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        warning?: string;
        ticket?: DeskTicket;
        schema?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error || "Could not update the ticket");
      if (json?.schema) setSchema(json.schema === "basic" ? "basic" : "desk");
      if (json?.ticket) setTicket(json.ticket);
      else await load();
      if (json?.warning) toast.warning(json.warning);
      else toast.success(savedCopy(patch, admin.email));
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the ticket");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading ticket…</p>;
  }
  if (phase === "missing") {
    return (
      <div className="space-y-3">
        <Link href="/admin/tickets" className="text-sm text-[var(--accent)] hover:underline">
          Back to tickets
        </Link>
        <Alert tone="warning">This ticket is not on the desk.</Alert>
      </div>
    );
  }
  if (phase === "error" || !ticket) {
    return <Alert tone="danger">{error || "Could not load this ticket"}</Alert>;
  }

  const clock = handleClock(ticket, now);
  const resolver = resolverEmail(ticket);
  const response = firstResponseMs(ticket);
  const resolve = timeToResolveMs(ticket);
  const marks = slaMarks(ticket, now);
  const targets = SLA_TARGETS_MS[ticket.priority];
  const messages = ticket.messages.length
    ? ticket.messages
    : ticket.body
      ? [
          {
            id: "opening",
            authorEmail: ticket.requesterEmail,
            authorKind: "org" as const,
            body: ticket.body,
            createdAt: ticket.createdAt,
          },
        ]
      : [];

  return (
    <div className="space-y-4" data-ticket-detail={ticket.id} data-ticket-schema={schema}>
      <Link href="/admin/tickets" className="text-sm text-[var(--accent)] hover:underline">
        Back to tickets
      </Link>
      {schema === "basic" ? (
        <Alert tone="warning">
          Resolver and handle time will not be stored until the support desk migration is applied.
          Status and public replies still save.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {ticket.orgName}
            {ticket.requesterName ? ` · ${ticket.requesterName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {messages.map((message) => (
            <Card
              key={message.id}
              data-ticket-message={message.authorKind}
              className="p-4"
              style={
                message.authorKind === "internal"
                  ? { background: "var(--warning-soft)", borderStyle: "dashed" }
                  : undefined
              }
            >
              <p className="text-xs text-[var(--muted)]">
                {messageAuthorLabel(ticket, message)} · {when(message.createdAt)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
            </Card>
          ))}

          <form
            className="data-card space-y-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const body = reply.trim();
              if (!body) return;
              void act({ body, visibility }).then((saved) => {
                if (saved) setReply("");
              });
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={visibility === "public" ? "default" : "secondary"}
                data-ticket-visibility="public"
                onClick={() => setVisibility("public")}
              >
                Reply to workspace
              </Button>
              <Button
                type="button"
                size="sm"
                variant={visibility === "internal" ? "default" : "secondary"}
                data-ticket-visibility="internal"
                onClick={() => setVisibility("internal")}
              >
                Internal note
              </Button>
            </div>
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder={
                visibility === "internal"
                  ? "Only support can see this note…"
                  : "Reply to the workspace…"
              }
              required
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">
                {visibility === "internal"
                  ? "Hidden from the workspace. Does not count as a first response."
                  : "A public reply on an open ticket moves it to waiting on the customer."}
              </p>
              <Button type="submit" disabled={busy} data-ticket-send>
                {busy ? "Saving…" : visibility === "internal" ? "Save note" : "Send reply"}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-3">
          <Card className="space-y-4 p-4" data-ticket-facts>
            <div data-ticket-handle-time>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Handle time</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {clock ? formatDeskDuration(clock.ms) : "—"}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]" data-ticket-resolved-by={resolver || ""}>
                {resolver
                  ? `${clock?.complete ? "Resolved by" : "With"} ${supportOperatorName(resolver)}`
                  : ticket.assigneeEmail
                    ? `${supportOperatorName(ticket.assigneeEmail)} has it${clock ? ", so far" : ""}`
                    : "Nobody has taken this yet"}
              </p>
            </div>

            <dl className="space-y-3 text-sm">
              <Fact label="Waiting on">
                {waitingOn(ticket) === "done"
                  ? ticketStatusLabel(ticket.status)
                  : waitingOn(ticket) === "customer"
                    ? "Customer"
                    : "Support"}
              </Fact>
              <Fact label="Requester">
                <span className="block">{ticket.requesterName}</span>
                <span className="text-xs text-[var(--muted)]">{ticket.requesterEmail || "—"}</span>
              </Fact>
              <Fact label="Opened">{when(ticket.createdAt)}</Fact>
              <Fact label="First response">
                {response == null ? "Not yet" : formatDeskDuration(response)}
                {" · "}
                {slaMarkLabel(marks.firstResponse)}
                {ticket.firstResponseBy ? ` · ${supportOperatorName(ticket.firstResponseBy)}` : ""}
              </Fact>
              <Fact label="Time to resolve">
                {resolve == null
                  ? `Open for ${formatDeskDuration(now - Date.parse(ticket.createdAt))}`
                  : formatDeskDuration(resolve)}
                {" · "}
                {slaMarkLabel(marks.resolve)}
              </Fact>
              <Fact label="SLA">
                First reply {formatDeskDuration(targets.firstResponse)}, resolve {formatDeskDuration(targets.resolve)} for {ticketPriorityLabel(ticket.priority).toLowerCase()}
              </Fact>
              {ticket.closedBy ? (
                <Fact label="Closed by">
                  {supportOperatorName(ticket.closedBy)} · {when(ticket.closedAt)}
                </Fact>
              ) : null}
            </dl>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status</span>
              <MenuSelect
                className={fieldClass}
                data-ticket-status
                disabled={busy}
                value={ticket.status}
                onChange={(event) => void act({ status: event.target.value as TicketStatus })}
              >
                <option value="open">Waiting on support</option>
                <option value="pending">Waiting on customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </MenuSelect>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Priority</span>
              <MenuSelect
                className={fieldClass}
                data-ticket-priority
                disabled={busy}
                value={ticket.priority}
                onChange={(event) => void act({ priority: event.target.value as TicketPriority })}
              >
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </MenuSelect>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Assignee</span>
              <MenuSelect
                className={fieldClass}
                data-ticket-assignee
                disabled={busy}
                value={ticket.assigneeEmail || ""}
                onChange={(event) => void act({ assigneeEmail: event.target.value || null })}
              >
                <option value="">Unassigned</option>
                {PLATFORM_ADMIN_ACCOUNTS.map((account) => (
                  <option key={account.email} value={account.email}>
                    {account.name}
                  </option>
                ))}
              </MenuSelect>
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !admin || ticket.assigneeEmail === admin.email}
              data-ticket-assign-me
              onClick={() => admin && void act({ assigneeEmail: admin.email })}
            >
              Assign to me
            </Button>
          </Card>

          <Card className="p-4" data-ticket-timeline>
            <h3 className="font-semibold tracking-tight">Timeline</h3>
            <ol className="mt-3 space-y-3">
              {[...ticket.events]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((item) => (
                  <li key={item.id} className="border-l-2 border-[var(--border)] pl-3">
                    <p className="text-sm">{item.summary}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {supportOperatorName(item.actorEmail) === item.actorEmail
                        ? item.actorEmail
                        : supportOperatorName(item.actorEmail)}
                      {" · "}
                      {when(item.createdAt)}
                    </p>
                  </li>
                ))}
              {ticket.events.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">No timeline yet.</li>
              ) : null}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

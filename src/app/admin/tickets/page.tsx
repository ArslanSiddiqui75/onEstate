"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-status";
import { loadLocalDesk } from "@/lib/admin/ticket-store";
import {
  deskSummary,
  firstResponseMs,
  formatDeskDuration,
  handleClock,
  resolverEmail,
  slaMarks,
  supportOperatorName,
  timeToResolveMs,
  ticketInFilter,
  ticketMatchesQuery,
  type DeskTicket,
  type TicketListFilter,
} from "@/lib/admin/ticket-desk";
import { cn } from "@/lib/utils";

const FILTERS: { id: TicketListFilter; label: string; hint: string; metric: "active" | "waitingOnSupport" | "waitingOnCustomer" | "unassigned" }[] = [
  { id: "active", label: "Open", hint: "Not resolved yet", metric: "active" },
  { id: "support", label: "Waiting on support", hint: "Needs an operator", metric: "waitingOnSupport" },
  { id: "customer", label: "Waiting on customer", hint: "We already replied", metric: "waitingOnCustomer" },
  { id: "unassigned", label: "Unassigned", hint: "Nobody has taken it", metric: "unassigned" },
];

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<DeskTicket[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [source, setSource] = useState<"local" | "hosted">("hosted");
  const [schema, setSchema] = useState<"desk" | "basic">("desk");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TicketListFilter>("all");
  const [priority, setPriority] = useState("all");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/tickets");
        const json = (await res.json()) as {
          source?: string;
          schema?: string;
          tickets?: DeskTicket[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Could not load tickets");
          setPhase("error");
          return;
        }
        if (json.source === "local") {
          setSource("local");
          setSchema("desk");
          setTickets(loadLocalDesk());
        } else {
          setSource("hosted");
          setSchema(json.schema === "basic" ? "basic" : "desk");
          setTickets(json.tickets || []);
        }
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setError("Could not load tickets");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => deskSummary(tickets, now), [tickets, now]);
  const visible = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (!ticketInFilter(ticket, filter, now)) return false;
        if (priority !== "all" && ticket.priority !== priority) return false;
        return ticketMatchesQuery(ticket, query);
      }),
    [tickets, filter, priority, query, now],
  );

  if (phase === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading the support desk…</p>;
  }
  if (phase === "error") {
    return <Alert tone="danger">{error}</Alert>;
  }

  return (
    <div className="space-y-5" data-ticket-desk="queue" data-ticket-schema={schema} data-ticket-source={source}>
      {schema === "basic" ? (
        <Alert tone="warning">
          This database does not have the support desk columns yet, so a resolver and handle time
          cannot be stored. Status changes and public replies still save. Apply the support desk
          migration in Supabase to record who resolved each ticket and how long it took.
        </Alert>
      ) : null}
      {source === "local" ? (
        <Alert>
          Sample tickets are stored in this browser so the desk can be reviewed without a hosted
          database. A connected workspace shows the tickets its brokerages file.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-ticket-queue>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-ticket-filter={item.id}
            data-ticket-metric={item.metric}
            aria-pressed={filter === item.id}
            onClick={() => setFilter((current) => (current === item.id ? "all" : item.id))}
            className={cn(
              "data-card w-full cursor-pointer p-4 text-left",
              filter === item.id && "is-filter-selected",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{summary[item.metric]}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{item.hint}</p>
          </button>
        ))}
        <div className="data-card p-4" data-ticket-metric="avg-first-response">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Avg first response</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{formatDeskDuration(summary.avgFirstResponseMs)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Opened to the first public reply</p>
        </div>
        <div className="data-card p-4" data-ticket-metric="avg-resolve">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Avg time to resolve</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{formatDeskDuration(summary.avgTimeToResolveMs)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Opened to resolved, across the queue</p>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Handle time is how long that operator had the ticket, from when they took it until they
        resolved it. Time to resolve is the workspace&apos;s full wait. High priority aims for a
        first reply in 4 hours and a resolution in 1 day. Normal is 1 day and 3 days. Low is 2 days
        and 7 days.
        {summary.breached > 0 ? ` ${summary.breached} open ticket${summary.breached === 1 ? " is" : "s are"} past an SLA.` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Search subject, workspace, requester, operator…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium"
          value={filter}
          data-ticket-filter-select
          onChange={(event) => setFilter(event.target.value as TicketListFilter)}
        >
          <option value="all">All tickets</option>
          <option value="active">Open</option>
          <option value="support">Waiting on support</option>
          <option value="customer">Waiting on customer</option>
          <option value="unassigned">Unassigned</option>
          <option value="breached">SLA breached</option>
          <option value="resolved">Resolved and closed</option>
        </select>
        <select
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm font-medium"
          value={priority}
          data-ticket-priority-filter
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <p className="text-sm font-medium text-[var(--muted)]">
          {visible.length} ticket{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <TH>Subject</TH>
              <TH>Workspace</TH>
              <TH>Status</TH>
              <TH>Assignee</TH>
              <TH>Resolved by</TH>
              <TH>Handle time</TH>
            </TR>
          </THead>
          <TBody>
            {visible.map((ticket) => {
              const resolver = resolverEmail(ticket);
              const clock = handleClock(ticket, now);
              const response = firstResponseMs(ticket);
              const resolve = timeToResolveMs(ticket);
              const marks = slaMarks(ticket, now);
              const breached = marks.firstResponse === "breached" || marks.resolve === "breached";
              const responseLabel =
                response == null
                  ? ticket.status === "resolved" || ticket.status === "closed"
                    ? "No reply"
                    : "Waiting"
                  : formatDeskDuration(response);
              return (
                <TR key={ticket.id} data-ticket-row={ticket.id}>
                  <TD>
                    <Link href={`/admin/tickets/${ticket.id}`} className="font-medium hover:underline">
                      {ticket.subject}
                    </Link>
                    <p className="break-words text-xs text-[var(--muted)]">
                      {ticket.requesterName}
                      {ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : ""}
                    </p>
                  </TD>
                  <TD>
                    <p>{ticket.orgName}</p>
                    <p className="text-xs text-[var(--muted)]">{when(ticket.createdAt)}</p>
                  </TD>
                  <TD data-ticket-status={ticket.status}>
                    <div className="flex flex-wrap gap-1">
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge priority={ticket.priority} />
                      {breached ? <Badge tone="danger">SLA</Badge> : null}
                    </div>
                  </TD>
                  <TD>{ticket.assigneeEmail ? supportOperatorName(ticket.assigneeEmail) : "Unassigned"}</TD>
                  <TD data-ticket-resolver={resolver || ""}>
                    {resolver
                      ? supportOperatorName(resolver)
                      : ticket.status === "resolved" || ticket.status === "closed"
                        ? "Not recorded"
                        : "—"}
                  </TD>
                  <TD data-ticket-handle={clock ? formatDeskDuration(clock.ms) : ""}>
                    <p className="font-medium">{clock ? formatDeskDuration(clock.ms) : "—"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {clock ? (clock.complete ? "Done" : "So far") : "Not taken"}
                      {" · "}
                      Reply {responseLabel}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {resolve == null
                        ? `Open ${formatDeskDuration(now - Date.parse(ticket.createdAt))}`
                        : `Resolve ${formatDeskDuration(resolve)}`}
                    </p>
                  </TD>
                </TR>
              );
            })}
            {visible.length === 0 ? (
              <EmptyRow colSpan={6}>
                {tickets.length === 0
                  ? "No tenant tickets yet. When someone files one from their workspace under Support, it lands here with the requester, the operator who resolves it, and how long that took."
                  : "No tickets match this queue."}
              </EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}

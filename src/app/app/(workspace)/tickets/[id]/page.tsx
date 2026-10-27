"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TicketStatusBadge } from "@/components/support/ticket-status";
import { PriorityPicker } from "@/components/support/priority-picker";
import { useSupportDesk, type SupportRow } from "@/lib/support/use-desk";
import { ticketPriorityLabel, type TicketPriority } from "@/lib/admin/ticket-desk";
import type { SupportMessage } from "@/lib/support/book";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function when(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

export default function AppTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { loadThread, reply, setPriority } = useSupportDesk();
  const [ticket, setTicket] = useState<SupportRow | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await loadThread(params.id);
      if (!next) {
        setPhase("missing");
        return;
      }
      setTicket(next.ticket);
      setMessages(next.messages);
      setPhase("ready");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this ticket");
      setPhase("error");
    }
  }, [loadThread, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading ticket…</p>;
  }
  if (phase === "error") {
    return (
      <Alert tone="danger">
        {error}{" "}
        <button type="button" className="underline" onClick={() => void load()}>
          Try again
        </button>
      </Alert>
    );
  }
  if (phase === "missing" || !ticket) {
    return (
      <EmptyState
        title="Ticket not found"
        description="It may belong to another office, or it has not been filed yet."
        action={
          <Link href="/app/tickets" className="text-sm font-semibold text-[var(--accent)]">
            Back to support
          </Link>
        }
      />
    );
  }

  const closed = ticket.status === "closed";
  const done = ticket.status === "resolved" || closed;

  async function changePriority(priority: TicketPriority) {
    if (priority === ticket?.priority) return;
    setBusy(true);
    try {
      await setPriority(ticket!.id, priority);
      toast.success(`Priority set to ${ticketPriorityLabel(priority)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update priority");
    } finally {
      setBusy(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await reply(ticket!.id, draft);
      setDraft("");
      toast.success(done ? "Reply sent. The ticket is open again." : "Reply sent");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/app/tickets" className="text-sm font-medium text-[var(--accent)] hover:underline">
        All tickets
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Updated {when(ticket.updatedAt)}</p>
        </div>
        <TicketStatusBadge status={ticket.status} audience="tenant" />
      </div>

      <section className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Priority</h3>
          {closed ? <p className="text-xs text-[var(--muted)]">Closed tickets keep the priority they were filed with.</p> : null}
        </div>
        <div className="mt-3">
          <PriorityPicker value={ticket.priority} onChange={(priority) => void changePriority(priority)} disabled={closed || busy} />
        </div>
      </section>

      <ol className="space-y-3">
        {messages.map((message) => {
          const mine = message.authorKind !== "admin";
          return (
            <li key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <article
                className={cn(
                  "max-w-[40rem] rounded-2xl px-4 py-3",
                  mine
                    ? "bg-[var(--accent-soft)]"
                    : "border border-[var(--border)] bg-[var(--surface-elevated)]",
                )}
              >
                <p className="text-xs font-medium text-[var(--muted)]">
                  {mine ? "You" : "Support"} · {when(message.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
              </article>
            </li>
          );
        })}
      </ol>

      <form className="space-y-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] p-4" onSubmit={(event) => void send(event)}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={done ? "Reply to reopen this ticket" : "Add a reply"}
          required
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : done ? "Reply and reopen" : "Reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}

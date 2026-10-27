"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-status";
import { PriorityPicker } from "@/components/support/priority-picker";
import { useSupportDesk, type SupportRow } from "@/lib/support/use-desk";
import { ticketPriorityLabel, type TicketPriority } from "@/lib/admin/ticket-desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type StatusView = "open" | "waiting" | "done";

const STATUS_VIEWS: { id: StatusView; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting on you" },
  { id: "done", label: "Done" },
];

const PRIORITY_VIEWS: { id: "all" | TicketPriority; label: string }[] = [
  { id: "all", label: "Any priority" },
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

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

function inView(ticket: SupportRow, view: StatusView) {
  if (view === "open") return ticket.status === "open";
  if (view === "waiting") return ticket.status === "pending";
  return ticket.status === "resolved" || ticket.status === "closed";
}

function preview(body: string) {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= 140) return clean;
  return `${clean.slice(0, 139)}…`;
}

export default function AppTicketsPage() {
  const router = useRouter();
  const { tickets, phase, error, refresh, file } = useSupportDesk();
  const [view, setView] = useState<StatusView>("open");
  const [priority, setPriority] = useState<"all" | TicketPriority>("all");
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [chosen, setChosen] = useState<TicketPriority>("normal");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === "open").length,
      waiting: tickets.filter((ticket) => ticket.status === "pending").length,
      done: tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length,
      high: tickets.filter((ticket) => ticket.priority === "high" && ticket.status !== "closed" && ticket.status !== "resolved").length,
    }),
    [tickets],
  );

  const visible = tickets.filter((ticket) => {
    if (!inView(ticket, view)) return false;
    if (priority !== "all" && ticket.priority !== priority) return false;
    return true;
  });

  const summary =
    tickets.length === 0
      ? "Nothing filed with platform support yet."
      : [
          counts.open === 1 ? "1 open with support" : `${counts.open} open with support`,
          counts.waiting === 1 ? "1 waiting on you" : counts.waiting ? `${counts.waiting} waiting on you` : "",
          counts.high === 1 ? "1 of the open ones is high priority" : counts.high ? `${counts.high} of the open ones are high priority` : "",
        ]
          .filter(Boolean)
          .join(". ") + ".";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const id = await file({ subject, body, priority: chosen });
      setSubject("");
      setBody("");
      setChosen("normal");
      setOpen(false);
      setView("open");
      toast.success(`Ticket filed at ${ticketPriorityLabel(chosen)} priority`);
      router.push(`/app/settings/support/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not file ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--muted)]">{summary}</p>
        <Button type="button" onClick={() => setOpen(true)}>
          New ticket
        </Button>
      </div>

      {phase === "error" ? (
        <Alert tone="danger">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Try again
          </button>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1">
          {STATUS_VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold",
                view === item.id
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(20,17,15,0.08)]"
                  : "text-[var(--muted)]",
              )}
            >
              {item.label}
              <span className="ml-1.5 text-xs font-medium text-[var(--muted)]">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <div className="inline-flex flex-wrap rounded-full border border-[var(--border)] p-1">
          {PRIORITY_VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPriority(item.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                priority === item.id
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {phase === "loading" ? (
        <p className="text-sm text-[var(--muted)]">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="Tell platform support what is stuck. Choose how urgent it is before you send it."
          action={
            <Button type="button" onClick={() => setOpen(true)}>
              New ticket
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nothing in this view.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/app/settings/support/${ticket.id}`}
                className="block rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3.5 transition hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{ticket.subject}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TicketPriorityBadge priority={ticket.priority} />
                    <TicketStatusBadge status={ticket.status} audience="tenant" />
                  </div>
                </div>
                {ticket.body ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{preview(ticket.body)}</p>
                ) : null}
                <p className="mt-2 text-xs text-[var(--muted)]">Updated {when(ticket.updatedAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-[var(--accent)]" aria-hidden />
              New ticket
            </DialogTitle>
            <DialogDescription>
              Platform support reads this. Priority decides how quickly they aim to reply.
            </DialogDescription>
          </DialogHeader>
          <form className="mt-4 space-y-4" onSubmit={(event) => void submit(event)}>
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={3}
              maxLength={160}
              required
            />
            <Textarea
              placeholder="What is stuck, and what have you already tried?"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={3}
              maxLength={4000}
              required
            />
            <PriorityPicker value={chosen} onChange={setChosen} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "File ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

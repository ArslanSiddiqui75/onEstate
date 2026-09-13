"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  updated_at: string;
};

export default function AppTicketsPage() {
  const { getAuthToken } = useAppSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getAuthToken();
    const res = await fetch("/api/tickets", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = (await res.json()) as { tickets?: Ticket[] };
    setTickets(json.tickets || []);
  }, [getAuthToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Ask platform support. Replies show on the ticket.
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setBusy(true);
            try {
              const token = await getAuthToken();
              const res = await fetch("/api/tickets", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ subject, body }),
              });
              const json = (await res.json().catch(() => null)) as {
                id?: string;
                error?: string;
              } | null;
              if (!res.ok || !json?.id) throw new Error(json?.error || "Could not file ticket");
              setSubject("");
              setBody("");
              toast.success("Ticket filed");
              await load();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
        <Textarea
          placeholder="What do you need help with?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "File ticket"}
        </Button>
      </form>
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/app/tickets/${ticket.id}`}>
            <Card className="flex items-center justify-between gap-3 p-3 hover:bg-[var(--surface-muted)]">
              <div>
                <p className="font-medium">{ticket.subject}</p>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(ticket.updated_at).toLocaleString()}
                </p>
              </div>
              <Badge className="capitalize">{ticket.status}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

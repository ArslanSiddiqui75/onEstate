"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<{
    subject: string;
    status: string;
    organizations?: { name?: string } | { name?: string }[];
  } | null>(null);
  const [messages, setMessages] = useState<
    { id: string; author_email: string; author_kind: string; body: string; created_at: string }[]
  >([]);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("open");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/tickets/${params.id}`);
    const json = await res.json();
    setTicket(json.ticket || null);
    setMessages(json.messages || []);
    if (json.ticket?.status) setStatus(json.ticket.status);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ticket) {
    return <p className="text-sm text-[var(--muted)]">Loading ticket…</p>;
  }

  const org = ticket.organizations;
  const orgName = Array.isArray(org) ? org[0]?.name : org?.name;

  return (
    <div className="space-y-4">
      <Link href="/admin/tickets" className="text-sm text-[var(--accent)] hover:underline">
        Back to tickets
      </Link>
      <div>
        <h2 className="text-xl font-semibold">{ticket.subject}</h2>
        <p className="text-sm text-[var(--muted)]">{orgName || "Workspace"}</p>
        <Badge className="mt-2 capitalize">{ticket.status}</Badge>
      </div>
      {messages.map((message) => (
        <Card key={message.id} className="p-3">
          <p className="text-xs text-[var(--muted)]">
            {message.author_kind === "admin" ? "Support" : message.author_email} ·{" "}
            {new Date(message.created_at).toLocaleString()}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
        </Card>
      ))}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            const res = await fetch(`/api/admin/tickets/${params.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ body: reply, status }),
            });
            if (!res.ok) {
              toast.error("Could not reply");
              return;
            }
            setReply("");
            toast.success("Reply sent");
            await load();
          })();
        }}
      >
        <select
          className="h-9 rounded-md border border-[var(--border)] px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["open", "pending", "resolved", "closed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to the tenant…"
          required
        />
        <Button type="submit">Send reply</Button>
      </form>
    </div>
  );
}

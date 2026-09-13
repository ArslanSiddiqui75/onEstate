"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

export default function AppTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { getAuthToken } = useAppSession();
  const [ticket, setTicket] = useState<{
    subject: string;
    status: string;
    body: string;
  } | null>(null);
  const [messages, setMessages] = useState<
    { id: string; author_email: string; author_kind: string; body: string; created_at: string }[]
  >([]);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const token = await getAuthToken();
    const res = await fetch(`/api/tickets/${params.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json();
    setTicket(json.ticket || null);
    setMessages(json.messages || []);
  }, [getAuthToken, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ticket) {
    return <p className="text-sm text-[var(--muted)]">Loading ticket…</p>;
  }

  return (
    <div className="space-y-4">
      <Link href="/app/tickets" className="text-sm text-[var(--accent)] hover:underline">
        Back to tickets
      </Link>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{ticket.subject}</h2>
        <Badge className="capitalize">{ticket.status}</Badge>
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
            const token = await getAuthToken();
            const res = await fetch(`/api/tickets/${params.id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ body: reply }),
            });
            if (!res.ok) {
              toast.error("Could not send reply");
              return;
            }
            setReply("");
            toast.success("Reply sent");
            await load();
          })();
        }}
      >
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          required
        />
        <Button type="submit">Reply</Button>
      </form>
    </div>
  );
}

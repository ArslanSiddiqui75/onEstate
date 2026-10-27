"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { isTicketPriority, isTicketStatus, type TicketPriority } from "@/lib/admin/ticket-desk";
import { loadLocalDesk, saveLocalDesk } from "@/lib/admin/ticket-store";
import {
  buildWorkspaceTicket,
  publicMessages,
  ticketsForOrg,
  withCustomerPriority,
  withCustomerReply,
  type SupportMessage,
} from "@/lib/support/book";

export type SupportRow = {
  id: string;
  subject: string;
  body: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
};

type HostedRow = {
  id?: string;
  subject?: string;
  body?: string;
  status?: string;
  priority?: string;
  created_at?: string;
  updated_at?: string;
};

function asRow(row: HostedRow): SupportRow | null {
  if (!row.id || !row.subject) return null;
  return {
    id: row.id,
    subject: row.subject,
    body: row.body || "",
    status: row.status && isTicketStatus(row.status) ? row.status : "open",
    priority: row.priority && isTicketPriority(row.priority) ? row.priority : "normal",
    createdAt: row.created_at || row.updated_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

async function readError(res: Response, fallback: string) {
  const json = (await res.json().catch(() => null)) as { error?: string } | null;
  return json?.error || fallback;
}

export function useSupportDesk() {
  const { authMode, org, user, getAuthToken } = useAppSession();
  const [tickets, setTickets] = useState<SupportRow[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!org) return;
    if (authMode !== "supabase") {
      setTickets(
        ticketsForOrg(loadLocalDesk(), org).map((ticket) => ({
          id: ticket.id,
          subject: ticket.subject,
          body: ticket.body,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        })),
      );
      setPhase("ready");
      setError("");
      return;
    }
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/tickets", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await readError(res, "Could not load tickets"));
      const json = (await res.json()) as { tickets?: HostedRow[] };
      setTickets((json.tickets || []).map(asRow).filter((row): row is SupportRow => Boolean(row)));
      setPhase("ready");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets");
      setPhase("error");
    }
  }, [authMode, org, getAuthToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const file = useCallback(async (input: { subject: string; body: string; priority: TicketPriority }) => {
    if (!org || !user) throw new Error("Sign in required");
    const subject = input.subject.trim();
    const body = input.body.trim();
    if (subject.length < 3 || body.length < 3) {
      throw new Error("Add a subject and a short description.");
    }
    if (authMode !== "supabase") {
      const ticket = buildWorkspaceTicket({
        orgId: org.id,
        orgName: org.name,
        email: user.email,
        name: user.name,
        subject,
        body,
        priority: input.priority,
      });
      saveLocalDesk([ticket, ...loadLocalDesk().filter((item) => item.id !== ticket.id)]);
      await refresh();
      return ticket.id;
    }
    const token = await getAuthToken();
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ subject, body, priority: input.priority }),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!res.ok || !json?.id) throw new Error(json?.error || "Could not file ticket");
    await refresh();
    return json.id;
  }, [authMode, getAuthToken, org, refresh, user]);

  const reply = useCallback(async (id: string, body: string) => {
    if (!user) throw new Error("Sign in required");
    const text = body.trim();
    if (!text) throw new Error("Write a reply first.");
    if (authMode !== "supabase") {
      const next = loadLocalDesk().map((ticket) =>
        ticket.id === id ? withCustomerReply(ticket, text, user.email) : ticket,
      );
      if (!next.some((ticket) => ticket.id === id)) throw new Error("Ticket not found");
      saveLocalDesk(next);
      await refresh();
      return;
    }
    const token = await getAuthToken();
    const res = await fetch(`/api/tickets/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not send reply"));
    await refresh();
  }, [authMode, getAuthToken, refresh, user]);

  const setPriority = useCallback(async (id: string, priority: TicketPriority) => {
    if (!user) throw new Error("Sign in required");
    if (authMode !== "supabase") {
      const next = loadLocalDesk().map((ticket) =>
        ticket.id === id ? withCustomerPriority(ticket, priority, user.email) : ticket,
      );
      if (!next.some((ticket) => ticket.id === id)) throw new Error("Ticket not found");
      saveLocalDesk(next);
      await refresh();
      return;
    }
    const token = await getAuthToken();
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ priority }),
    });
    if (!res.ok) throw new Error(await readError(res, "Could not update priority"));
    await refresh();
  }, [authMode, getAuthToken, refresh, user]);

  const loadThread = useCallback(async (id: string): Promise<{ ticket: SupportRow; messages: SupportMessage[] } | null> => {
    if (authMode !== "supabase") {
      const ticket = loadLocalDesk().find((item) => item.id === id);
      if (!ticket || !org) return null;
      if (ticket.orgId !== org.id && ticket.orgName !== org.name) return null;
      return {
        ticket: {
          id: ticket.id,
          subject: ticket.subject,
          body: ticket.body,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
        messages: publicMessages(ticket),
      };
    }
    const token = await getAuthToken();
    const res = await fetch(`/api/tickets/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await readError(res, "Could not open this ticket"));
    const json = (await res.json()) as {
      ticket?: HostedRow;
      messages?: {
        id: string;
        author_email?: string;
        author_kind?: string;
        body?: string;
        created_at?: string;
      }[];
    };
    const ticket = json.ticket ? asRow(json.ticket) : null;
    if (!ticket) return null;
    return {
      ticket,
      messages: (json.messages || [])
        .filter((message) => message.author_kind !== "internal")
        .map((message) => ({
          id: message.id,
          authorEmail: message.author_email || "",
          authorKind: message.author_kind === "admin" ? "admin" : "org",
          body: message.body || "",
          createdAt: message.created_at || ticket.updatedAt,
        })),
    };
  }, [authMode, getAuthToken, org]);

  return { tickets, phase, error, refresh, file, reply, setPriority, loadThread };
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";

type Ticket = {
  id: string;
  orgName: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    void fetch("/api/admin/tickets")
      .then((res) => res.json())
      .then((json: { tickets?: Ticket[] }) => setTickets(json.tickets || []));
  }, []);

  return (
    <TableShell>
      <Table>
        <THead>
          <TR>
            <TH>Subject</TH>
            <TH>Workspace</TH>
            <TH>Priority</TH>
            <TH>Status</TH>
            <TH>Updated</TH>
          </TR>
        </THead>
        <TBody>
          {tickets.map((ticket) => (
            <TR key={ticket.id}>
              <TD>
                <Link href={`/admin/tickets/${ticket.id}`} className="hover:underline">
                  {ticket.subject}
                </Link>
              </TD>
              <TD>{ticket.orgName}</TD>
              <TD className="capitalize">{ticket.priority}</TD>
              <TD>
                <Badge className="capitalize">{ticket.status}</Badge>
              </TD>
              <TD className="text-xs text-[var(--muted)]">
                {new Date(ticket.updatedAt).toLocaleString()}
              </TD>
            </TR>
          ))}
          {tickets.length === 0 ? (
            <EmptyRow colSpan={5}>No tenant tickets yet.</EmptyRow>
          ) : null}
        </TBody>
      </Table>
    </TableShell>
  );
}

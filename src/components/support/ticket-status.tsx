import { Badge } from "@/components/ui/badge";
import {
  isTicketPriority,
  isTicketStatus,
  ticketPriorityLabel,
  ticketPriorityTone,
  ticketStatusLabel,
  ticketStatusTone,
} from "@/lib/admin/ticket-desk";

export function TicketStatusBadge({
  status,
  audience = "admin",
}: {
  status: string;
  audience?: "admin" | "tenant";
}) {
  const parsed = isTicketStatus(status) ? status : "open";
  return <Badge tone={ticketStatusTone(parsed)}>{ticketStatusLabel(parsed, audience)}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  const parsed = isTicketPriority(priority) ? priority : "normal";
  return <Badge tone={ticketPriorityTone(parsed)}>{ticketPriorityLabel(parsed)}</Badge>;
}

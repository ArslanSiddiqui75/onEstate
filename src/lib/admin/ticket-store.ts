import { seedDeskTickets, type DeskTicket } from "@/lib/admin/ticket-desk";

const KEY = "certified_support_desk_v1";

function isTicket(value: unknown): value is DeskTicket {
  if (!value || typeof value !== "object") return false;
  const ticket = value as DeskTicket;
  return (
    typeof ticket.id === "string" &&
    typeof ticket.subject === "string" &&
    typeof ticket.status === "string" &&
    Array.isArray(ticket.messages) &&
    Array.isArray(ticket.events)
  );
}

export function loadLocalDesk(): DeskTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return saveLocalDesk(seedDeskTickets(Date.now()));
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isTicket)) {
      return saveLocalDesk(seedDeskTickets(Date.now()));
    }
    return parsed;
  } catch {
    return saveLocalDesk(seedDeskTickets(Date.now()));
  }
}

export function saveLocalDesk(tickets: DeskTicket[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(tickets));
  }
  return tickets;
}

export function updateLocalTicket(id: string, mutate: (ticket: DeskTicket) => DeskTicket) {
  const next = loadLocalDesk().map((ticket) => (ticket.id === id ? mutate(ticket) : ticket));
  return saveLocalDesk(next);
}

import type { Jurisdiction } from "@/lib/lettings/types";

export function gbp(amount: number) {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatMonth(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function clockLabel(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  const overdue = ms < 0;
  const hours = Math.max(1, Math.round(Math.abs(ms) / 3_600_000));
  const text = hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  return overdue ? `${text} over` : `${text} left`;
}

export function marketPosition(rent: number, market: number) {
  if (market <= 0) return { pct: 0, direction: "level" as const };
  const delta = market - rent;
  const pct = Math.round((Math.abs(delta) / market) * 100);
  if (delta > market * 0.01) return { pct, direction: "below" as const };
  if (delta < -market * 0.01) return { pct, direction: "above" as const };
  return { pct: 0, direction: "level" as const };
}

export function rentIncreaseNote(jurisdiction: Jurisdiction) {
  switch (jurisdiction) {
    case "england":
      return "For a periodic assured shorthold tenancy in England, a rent increase uses Section 13 and Form 4A. This is the form the office prepares. It is not legal advice, and the notice period still has to be checked on the tenancy.";
    case "wales":
      return "Occupation contracts in Wales use Form RHW12 to vary the rent. This is the form the office prepares. It is not legal advice.";
    case "scotland":
      return "A private residential tenancy in Scotland uses a rent-increase notice. The tenant can refer it to Rent Service Scotland. This note is the office reminder, not legal advice.";
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

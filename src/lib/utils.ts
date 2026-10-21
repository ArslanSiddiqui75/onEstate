import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContactSource, Market, PhoneContactMethod } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  amount: number,
  market: Market,
  options?: { compact?: boolean },
) {
  const currency = market === "uk" ? "GBP" : "USD";
  const locale = market === "uk" ? "en-GB" : "en-US";

  if (options?.compact && amount >= 1_000_000) {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
      // Keep casing stable across Node/browser ICU builds
      compactDisplay: "short",
    }).format(amount);
    return formatted.replace(/([kmbt])\b/i, (m) => m.toUpperCase());
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string, market: Market) {
  return new Intl.DateTimeFormat(market === "uk" ? "en-GB" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function normalizePhoneNumber(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

export function buildPhoneContactMethod(input: {
  number: string;
  label?: string;
  source?: ContactSource;
  consent?: PhoneContactMethod["consent"];
  verification?: PhoneContactMethod["verification"];
  preferred?: boolean;
}) {
  const normalized = normalizePhoneNumber(input.number);
  return {
    id: `phone_${Date.now()}`,
    label: input.label || "Primary",
    number: normalized,
    source: input.source || "manual",
    consent: input.consent || "unknown",
    verification: input.verification || "unverified",
    preferred: input.preferred ?? true,
  } satisfies PhoneContactMethod;
}

/** Supabase often throws a plain `{ message }` instead of `Error`. */
export function asErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

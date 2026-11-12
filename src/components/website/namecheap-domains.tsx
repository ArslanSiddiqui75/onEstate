"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { BusinessProfile } from "@/lib/org/business-profile";

const COMPANY_LEGAL_TYPES = new Set(["LTD", "PLC", "LLP", "RCHAR"]);

function requiresCompanyNumber(legalType: string) {
  return COMPANY_LEGAL_TYPES.has(legalType);
}

interface DomainQuote {
  domain: string;
  available: boolean;
  premium: boolean;
  price: number | null;
  currency: string;
}

const LEGAL_TYPES = [
  { value: "IND", label: "UK individual" },
  { value: "STRA", label: "Sole trader" },
  { value: "LTD", label: "UK limited company" },
  { value: "LLP", label: "Limited liability partnership" },
  { value: "OTHER", label: "Other UK entity" },
] as const;

function formatPrice(amount: number | null, currency: string) {
  if (amount === null) return "Price unavailable";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function needsUkDetails(domain: string) {
  return domain.endsWith(".uk");
}

export function NamecheapDomains({
  canBuy,
  market,
  fullName,
  business,
  getAuthToken,
  onConnected,
}: {
  canBuy: boolean;
  market: "uk" | "us";
  fullName: string;
  business?: BusinessProfile;
  getAuthToken: (options?: { refresh?: boolean }) => Promise<string | null>;
  onConnected: (domain: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DomainQuote[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"search" | "buy" | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [legalType, setLegalType] = useState<(typeof LEGAL_TYPES)[number]["value"]>("IND");
  const [companyId, setCompanyId] = useState("");

  async function sessionToken(refresh = false) {
    return getAuthToken(refresh ? { refresh: true } : undefined);
  }

  async function fetchWithSession(input: string, init: RequestInit) {
    const send = async (token: string | null) =>
      fetch(input, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    let token = await sessionToken();
    if (!token) token = await sessionToken(true);
    let res = await send(token);
    if (res.status === 401) {
      const refreshed = await sessionToken(true);
      if (refreshed && refreshed !== token) res = await send(refreshed);
    }
    return res;
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy("search");
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, market });
      const res = await fetchWithSession(`/api/website/domain/namecheap?${params.toString()}`, {
        method: "GET",
      });
      const json = (await res.json()) as { results?: DomainQuote[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not search domains.");
      setResults(json.results || []);
      setSearched(true);
      if (json.error) setError(json.error);
    } catch (err) {
      setResults([]);
      setSearched(true);
      setError(err instanceof Error ? err.message : "Could not search domains.");
    } finally {
      setBusy(null);
    }
  }

  async function buy(domain: string, price: number | null, currency: string) {
    if (price === null) {
      setError("The price isn’t available right now. Search again in a moment.");
      return;
    }
    if (!window.confirm(`Buy ${domain} for ${formatPrice(price, currency)} for the first year? This is charged immediately.`)) {
      return;
    }
    if (needsUkDetails(domain) && requiresCompanyNumber(legalType) && !companyId.trim()) {
      setError("A company number is required for that registrant type.");
      return;
    }
    setBusy("buy");
    setBuying(domain);
    setError(null);
    try {
      const res = await fetchWithSession("/api/website/domain/namecheap", {
        method: "POST",
        body: JSON.stringify({
          action: "buy",
          domain,
          expectedPrice: price,
          legalType: needsUkDetails(domain) ? legalType : undefined,
          companyId: companyId.trim() || undefined,
          contact: {
            fullName,
            organization: business?.tradingName || "",
            address: business?.address || "",
            city: business?.city || "",
            postcode: business?.postcode || "",
            phone: business?.phone || "",
            email: business?.email || "",
            country: market === "us" ? "US" : "GB",
          },
        }),
      });
      const json = (await res.json()) as { domain?: string; error?: string; message?: string; dnsReady?: boolean };
      if (!res.ok || !json.domain) throw new Error(json.error || "Could not buy that domain.");
      await onConnected(json.domain);
      if (json.dnsReady === false) {
        toast.info(json.message || "The domain is registered. Add the website records above.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not buy that domain.");
    } finally {
      setBusy(null);
      setBuying(null);
    }
  }

  if (!canBuy) {
    return (
      <p className="text-sm text-[var(--muted)]">
        The owner connects a domain with the DNS records on this page. Buying a new name is optional.
      </p>
    );
  }

  const showUk = results.some((row) => row.available && needsUkDetails(row.domain));

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div>
        <h3 className="text-sm font-semibold">Buy a new domain</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Optional. A domain you already own connects above, at whichever company holds its DNS.
          Buying here registers the name and adds the website records.
        </p>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void search(event)}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={market === "us" ? "northbridge or northbridge.com" : "northbridge or northbridge.co.uk"}
          aria-label="Domain to search"
          autoComplete="off"
        />
        <Button type="submit" className="shrink-0" disabled={busy === "search" || !query.trim()}>
          {busy === "search" ? "Searching…" : "Search"}
        </Button>
      </form>

      {showUk ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <MenuSelect
            aria-label="Registrant type"
            value={legalType}
            onChange={(event) => setLegalType(event.target.value as typeof legalType)}
          >
            {LEGAL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </MenuSelect>
          {requiresCompanyNumber(legalType) ? (
            <Input
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              placeholder="Company number"
              aria-label="Company number"
            />
          ) : null}
        </div>
      ) : null}

      {error ? <Alert tone="warning">{error}</Alert> : null}

      {searched && results.length === 0 && !error ? (
        <p className="text-sm text-[var(--muted)]">No names matched that search.</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {results.map((row) => (
            <li key={row.domain} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{row.domain}</p>
                <p className="text-xs text-[var(--muted)]">
                  {row.available
                    ? `${formatPrice(row.price, row.currency)} for the first year${row.premium ? " · Premium" : ""}`
                    : "Taken"}
                </p>
              </div>
              {row.available ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null || row.price === null || row.premium}
                  onClick={() => void buy(row.domain, row.price, row.currency)}
                >
                  {buying === row.domain ? "Buying…" : "Buy and connect"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] leading-relaxed text-[var(--muted)]">
        Registration uses the business profile in{" "}
        <Link href="/app/settings" className="text-[var(--accent)] hover:underline">
          Workspace
        </Link>
        . Buying adds the website A and www records and leaves mail records in place.
      </p>
    </div>
  );
}

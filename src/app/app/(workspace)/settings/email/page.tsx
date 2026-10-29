"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import type { DnsRecord, EmailDomain } from "@/lib/email/domain-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { DnsProviderGuide } from "@/components/settings/dns-provider-guide";
import { copyToClipboard } from "@/lib/utils";

/** Hostinger and many panels want "@" for the root, and the left label only for subdomains. */
function dnsHostLabel(host: string, domain: string) {
  const h = host.trim().toLowerCase();
  const d = domain.trim().toLowerCase();
  if (h === d) return "@";
  if (h.endsWith(`.${d}`)) return h.slice(0, -(d.length + 1));
  return host;
}

export default function EmailDomainSettingsPage() {
  const { user, org, updateWorkspace, getAuthToken, persistence } = useAppSession();
  const saved = org?.emailDomain;
  const [domain, setDomain] = useState(saved?.domain || "");
  const [fromLocal, setFromLocal] = useState(saved?.fromLocal || "hello");
  const [fromName, setFromName] = useState(saved?.fromName || org?.name || "");
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [verified, setVerified] = useState(saved?.status === "verified");
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || !org) return null;
  const isOwner = user.role === "owner";

  async function authHeaders(): Promise<Record<string, string>> {
    const token = persistence === "supabase" ? await getAuthToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function remember(next: EmailDomain) {
    setVerified(next.status === "verified");
    return updateWorkspace({ emailDomain: next });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Connect a domain you already own (Hostinger, GoDaddy, and so on). Add the DNS records they
        show you, then Conversations can send from your brokerage address — for example{" "}
        <span className="text-[var(--foreground)]">hello@youragency.com</span>.
      </p>

      <DnsProviderGuide kind="email" />

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Sending domain</h2>
          <p className="text-sm text-[var(--muted)]">
            {saved
              ? saved.status === "verified"
                ? `Sending as ${saved.fromName} <${saved.fromLocal}@${saved.domain}>.`
                : `${saved.domain} is saved. DNS still needs to match.`
              : "Enter the domain you already use for the business, then check DNS."}
          </p>
        </div>
        {isOwner ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              void authHeaders().then((headers) =>
                fetch("/api/email/domain", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...headers },
                  body: JSON.stringify({ domain, fromLocal, fromName }),
                }),
              )
                .then(async (res) => {
                  const json = (await res.json()) as {
                    domain?: string;
                    fromLocal?: string;
                    fromName?: string;
                    records?: DnsRecord[];
                    missing?: string[];
                    verified?: boolean;
                    error?: string;
                  };
                  if (!res.ok || !json.domain || !json.fromLocal || !json.fromName) {
                    throw new Error(json.error || "Could not check that domain.");
                  }
                  setRecords(json.records || []);
                  setMissing(json.missing || []);
                  await remember({
                    domain: json.domain,
                    fromLocal: json.fromLocal,
                    fromName: json.fromName,
                    status: json.verified ? "verified" : "pending",
                    checkedAt: new Date().toISOString(),
                  });
                  toast.success(json.verified ? "Domain connected" : "Records saved. DNS is not in place yet.");
                })
                .catch((err) => {
                  const msg = err instanceof Error ? err.message : "Could not check that domain.";
                  setError(msg);
                  toast.error(msg);
                })
                .finally(() => setBusy(false));
            }}
          >
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-[var(--muted)]">Domain</span>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="northbridge.co.uk"
                autoComplete="url"
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">Mailbox</span>
              <Input
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
                placeholder="hello"
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">From name</span>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder={org.name}
                required
              />
            </label>
            <Button type="submit" className="w-fit" disabled={busy}>
              {busy ? "Checking…" : "Check DNS"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[var(--muted)]">Only the owner can connect a domain.</p>
        )}
      </Card>

      {records.length > 0 ? (
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="font-semibold">{verified ? "DNS matches" : "Add these records"}</h2>
            <p className="text-sm text-[var(--muted)]">
              In Hostinger (or your DNS host), create each row below. The mail and DKIM CNAMEs plus
              SPF are required. If an SPF TXT already exists, merge the{" "}
              <code className="text-xs">include:</code> into that one row — do not add a second SPF.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {records.map((record) => {
              const absent = missing.includes(record.host);
              return (
                <li key={`${record.type}-${record.host}`} className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {record.type} · Host{" "}
                      <span className="font-mono">{dnsHostLabel(record.host, saved?.domain || domain)}</span>
                      <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                        ({record.host})
                      </span>
                      {absent ? <span className="ml-2 text-xs text-[var(--warning)]">Missing</span> : null}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void copyToClipboard(record.value).then((ok) => {
                          if (!ok) return;
                          setCopied(record.host);
                          window.setTimeout(() => setCopied(null), 1500);
                        });
                      }}
                    >
                      {copied === record.host ? <Check /> : <Copy />}
                      {copied === record.host ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="break-all font-mono text-xs">{record.value}</p>
                  <p className="text-xs text-[var(--muted)]">{record.purpose}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

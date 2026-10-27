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

export default function EmailDomainSettingsPage() {
  const { user, org, updateWorkspace } = useAppSession();
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

  function remember(next: EmailDomain) {
    setVerified(next.status === "verified");
    return updateWorkspace({ emailDomain: next });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Connect the brokerage domain with DNS. Conversations then send email from that domain.
      </p>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Sending domain</h2>
          <p className="text-sm text-[var(--muted)]">
            {saved
              ? saved.status === "verified"
                ? `Sending as ${saved.fromName} <${saved.fromLocal}@${saved.domain}>.`
                : `${saved.domain} is saved. DNS still needs to match.`
              : "No domain connected yet."}
          </p>
        </div>
        {isOwner ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              void fetch("/api/email/domain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain, fromLocal, fromName }),
              })
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
              Add them at the registrar, then check again. The mail and DKIM CNAMEs plus the SPF record are required.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {records.map((record) => {
              const absent = missing.includes(record.host);
              return (
                <li key={`${record.type}-${record.host}`} className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {record.type} · {record.host}
                      {absent ? <span className="ml-2 text-xs text-[var(--warning)]">Missing</span> : null}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(record.value).then(() => {
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

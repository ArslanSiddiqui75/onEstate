"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanHost, cnameTarget, dnsInstructions, isApexHost } from "@/lib/website/domain-records";
import type { DomainStatus, SslStatus, WebsiteSite } from "@/types";

const DOMAIN_STATUS_META: Record<
  DomainStatus,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" | "accent" }
> = {
  none: { label: "Not configured", tone: "neutral" },
  pending: { label: "Waiting on DNS", tone: "warning" },
  verifying: { label: "Verifying…", tone: "accent" },
  connected: { label: "Connected", tone: "success" },
  failed: { label: "Verification failed", tone: "danger" },
};

const SSL_STATUS_META: Record<SslStatus, { label: string; tone: "success" | "warning" | "neutral" | "accent" }> = {
  none: { label: "No SSL yet", tone: "neutral" },
  provisioning: { label: "Certificate issuing…", tone: "accent" },
  active: { label: "HTTPS live", tone: "success" },
  error: { label: "SSL error", tone: "warning" },
};

export function DomainPanel({
  site,
  canEdit,
  verifying,
  onChange,
  onVerify,
}: {
  site: WebsiteSite;
  canEdit: boolean;
  verifying: boolean;
  onChange: (patch: Partial<WebsiteSite>) => void;
  onVerify: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const host = cleanHost(site.customDomain || "");
  const domainStatus = site.domainStatus || "none";
  const sslStatus = site.sslStatus || "none";
  const instructions = useMemo(
    () => (host ? dnsInstructions(host) : dnsInstructions("www.agency.com")),
    [host],
  );
  const apex = host ? isApexHost(host) : false;
  const liveHref =
    domainStatus === "connected" && host
      ? `https://${host}`
      : null;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <label className="text-xs font-medium text-[var(--muted)]">Custom domain</label>
        <div className="flex gap-2">
          <Input
            value={site.customDomain || ""}
            disabled={!canEdit}
            onChange={(e) =>
              onChange({ customDomain: e.target.value, domainStatus: "none", sslStatus: "none" })
            }
            placeholder="www.agency.com"
          />
          <Button
            variant="secondary"
            disabled={!canEdit || !host || verifying}
            onClick={onVerify}
          >
            {verifying ? "Checking…" : "Verify DNS"}
          </Button>
        </div>
        {domainStatus !== "none" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={DOMAIN_STATUS_META[domainStatus].tone}>
              {DOMAIN_STATUS_META[domainStatus].label}
            </Badge>
            {sslStatus !== "none" ? (
              <Badge tone={SSL_STATUS_META[sslStatus].tone} className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                {SSL_STATUS_META[sslStatus].label}
              </Badge>
            ) : null}
            {liveHref ? (
              <a
                href={liveHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline text-[var(--muted)]"
              >
                <ExternalLink className="h-3 w-3" />
                Open {host}
              </a>
            ) : null}
          </div>
        ) : null}
        <p className="text-[11px] leading-relaxed text-[var(--muted)]">
          {apex
            ? "Root domains need an A record — CNAME is not valid on @. Use www if your registrar is limited."
            : `Point a CNAME at ${cnameTarget()}. DNS is checked live; HTTPS is probed on port 443, not assumed.`}
        </p>
        {site.published ? null : (
          <p className="text-[11px] text-[var(--muted)]">
            Publish the site or visitors hitting this domain will still get a 404.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <Globe className="h-3.5 w-3.5" />
          Add these records
        </p>
        <div className="space-y-2">
          {instructions.map((row) => (
            <div
              key={`${row.type}-${row.host}-${row.value}`}
              className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{row.type}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)]"
                  onClick={() => void copy(row.value)}
                >
                  {copied === row.value ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied === row.value ? "Copied" : "Copy value"}
                </button>
              </div>
              <p className="mt-1 font-mono">
                {row.host} → {row.value}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{row.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

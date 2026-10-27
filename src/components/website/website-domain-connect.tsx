"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { toast } from "@/components/ui/toast";
import { DomainPanel } from "@/components/website/domain-panel";
import { defaultWebsiteSite } from "@/lib/website/defaults";
import type { DomainStatus, SslStatus, WebsiteSite } from "@/types";

export function WebsiteDomainConnect() {
  const { user, org, website, saveWebsite, getAuthToken, persistence } = useAppSession();
  const [draft, setDraft] = useState<WebsiteSite | null>(website);
  const [dirty, setDirty] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(website);
  }, [website, dirty]);

  if (!user || !org) return null;

  const canEdit = hasModuleAccess(user.role, org.plan, "website", "edit");
  const site = draft || website || defaultWebsiteSite(org.id, org.name, user.email);

  function updateDraft(patch: Partial<WebsiteSite>) {
    setDraft({ ...site, ...patch });
    setDirty(true);
  }

  async function handleVerify() {
    if (!canEdit || !site.customDomain?.trim()) return;
    setVerifying(true);
    updateDraft({ domainStatus: "verifying" });
    try {
      const token = persistence === "supabase" ? await getAuthToken() : null;
      const res = await fetch("/api/website/domain/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ domain: site.customDomain }),
      });
      const data = (await res.json()) as {
        domain?: string;
        status?: string;
        ssl?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        updateDraft({ domainStatus: "failed" });
        toast.error(data.error || data.message || "Domain verification failed.");
        return;
      }
      const nextStatus: DomainStatus =
        data.status === "connected" ? "connected" : data.status === "failed" ? "failed" : "pending";
      const nextSsl: SslStatus =
        data.ssl === "active"
          ? "active"
          : data.ssl === "provisioning"
            ? "provisioning"
            : data.ssl === "error"
              ? "error"
              : "none";
      const next: WebsiteSite = {
        ...site,
        customDomain: data.domain || site.customDomain,
        domainStatus: nextStatus,
        domainVerifiedAt:
          nextStatus === "connected" ? new Date().toISOString() : site.domainVerifiedAt,
        sslStatus: nextSsl,
      };
      setDraft(next);
      setDirty(false);
      await saveWebsite(next);
      if (nextStatus === "connected") toast.success(data.message || "Domain connected");
      else toast.info(data.message || "Domain not yet verified.");
    } catch {
      updateDraft({ domainStatus: "failed" });
      toast.error("Domain verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="font-display text-xl">Website domain</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Point a hostname at the public site. DNS is checked when you verify. Edit the page from{" "}
          <Link href="/app/website" className="text-[var(--accent)] hover:underline">
            Website
          </Link>
          .
        </p>
      </div>
      <DomainPanel
        site={site}
        canEdit={canEdit}
        verifying={verifying}
        onChange={updateDraft}
        onVerify={() => void handleVerify()}
      />
    </section>
  );
}

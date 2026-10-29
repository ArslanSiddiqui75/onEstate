"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { toast } from "@/components/ui/toast";
import { DomainPanel } from "@/components/website/domain-panel";
import { NamecheapDomains } from "@/components/website/namecheap-domains";
import { defaultWebsiteSite } from "@/lib/website/defaults";
import type { DomainStatus, SslStatus, WebsiteSite } from "@/types";

export function WebsiteDomainConnect() {
  const { user, org, website, saveWebsite, getAuthToken, persistence, market } = useAppSession();
  const [draft, setDraft] = useState<WebsiteSite | null>(website);
  const [dirty, setDirty] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!dirty) setDraft(website);
  }, [website, dirty]);

  if (!user || !org) return null;

  const canEdit = hasModuleAccess(user, org.plan, "website", "edit");
  const site = draft || website || defaultWebsiteSite(org.id, org.name, user.email);

  function updateDraft(patch: Partial<WebsiteSite>) {
    setDraft({ ...site, ...patch });
    setDirty(true);
  }

  async function persist(next: WebsiteSite): Promise<boolean> {
    try {
      await saveWebsite(next);
      return true;
    } catch (err) {
      setDirty(true);
      toast.error(
        err instanceof Error
          ? `Couldn’t save the domain: ${err.message}`
          : "Couldn’t save the domain. Try again.",
      );
      return false;
    }
  }

  async function handleVerify(domainOverride?: string) {
    const domain = (domainOverride || site.customDomain || "").trim();
    if (!canEdit || !domain) return;
    setVerifying(true);
    updateDraft({ customDomain: domain, domainStatus: "verifying" });
    try {
      const token = persistence === "supabase" ? await getAuthToken() : null;
      const res = await fetch("/api/website/domain/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ domain }),
      });
      const data = (await res.json()) as {
        domain?: string;
        status?: string;
        ssl?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        const failed: WebsiteSite = {
          ...site,
          customDomain: domain,
          domainStatus: "failed",
          domainRegistrar: domainOverride ? "namecheap" : site.domainRegistrar,
        };
        setDraft(failed);
        setDirty(false);
        if (await persist(failed)) {
          toast.error(data.error || data.message || "Domain verification failed.");
        }
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
        customDomain: data.domain || domain,
        domainRegistrar: domainOverride ? "namecheap" : site.domainRegistrar,
        domainStatus: nextStatus,
        domainVerifiedAt:
          nextStatus === "connected" ? new Date().toISOString() : site.domainVerifiedAt,
        sslStatus: nextSsl,
      };
      setDraft(next);
      setDirty(false);
      if (!(await persist(next))) return;
      if (nextStatus === "connected") toast.success(data.message || "Domain connected");
      else toast.info(data.message || "Domain not yet verified.");
    } catch {
      const failed: WebsiteSite = {
        ...site,
        customDomain: domain,
        domainStatus: "failed",
        domainRegistrar: domainOverride ? "namecheap" : site.domainRegistrar,
      };
      setDraft(failed);
      setDirty(false);
      if (await persist(failed)) {
        toast.error("Domain verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="font-display text-xl">Website domain</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Buy a domain here with Namecheap, or point one you already own at Hostinger, GoDaddy,
          Cloudflare, and so on. Add the DNS records below, verify, then publish. Edit the page from{" "}
          <Link href="/app/website" className="text-[var(--accent)] hover:underline">
            Website
          </Link>
          .
        </p>
      </div>
      <NamecheapDomains
        canBuy={user.role === "owner"}
        market={market === "us" ? "us" : "uk"}
        fullName={user.name}
        business={org.business}
        getAuthToken={getAuthToken}
        onConnected={async (domain) => {
          await handleVerify(domain);
        }}
      />
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

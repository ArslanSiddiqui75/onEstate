"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Monitor,
} from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { FEATURED_TEMPLATES, getTemplate } from "@/lib/website/templates";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import { applySectionLayout, resolveSections } from "@/lib/website/sections";
import { WebsiteCanvas } from "@/components/website/website-preview";
import { SectionPalette } from "@/components/website/section-palette";
import { fileToSocialMedia, uploadSocialMediaFile } from "@/lib/social/media";
import type { WebsiteSite, WebsiteTemplateId, DomainStatus, SslStatus } from "@/types";

const DOMAIN_STATUS_META: Record<
  DomainStatus,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" | "accent"; icon: typeof CheckCircle2 }
> = {
  none: { label: "Not configured", tone: "neutral", icon: Globe },
  pending: { label: "Pending verification", tone: "warning", icon: AlertCircle },
  verifying: { label: "Verifying…", tone: "accent", icon: Loader2 },
  connected: { label: "Connected", tone: "success", icon: CheckCircle2 },
  failed: { label: "Verification failed", tone: "danger", icon: AlertCircle },
};

const SSL_STATUS_META: Record<SslStatus, { label: string; tone: "success" | "warning" | "neutral" | "accent" }> = {
  none: { label: "No SSL", tone: "neutral" },
  provisioning: { label: "SSL provisioning…", tone: "accent" },
  active: { label: "SSL active", tone: "success" },
  error: { label: "SSL error", tone: "warning" },
};

export default function AppWebsitePage() {
  const { user, org, website, saveWebsite, listings, market, getAuthToken, persistence } =
    useAppSession();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(website);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<"none" | "theme" | "sections" | "domain">("none");
  const [verifying, setVerifying] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    if (website) {
      setDraft(website);
      setDirty(false);
    }
  }, [website]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "website", "view")) {
    return (
      <LockedModule
        title="Website locked"
        reason="Website builder is limited to Owner, Broker, and Team Lead."
        href="/app/billing"
      />
    );
  }

  const site = draft || website;
  if (!site) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
        Loading website builder…
      </div>
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "website", "edit");
  const activeListings = listings.filter((l) => l.market === market);
  const hydrated = hydrateWebsiteSite(site, org.name);
  const template = getTemplate(hydrated.templateId);
  const customDomain =
    site.customDomain || `${org.name.toLowerCase().replace(/\s+/g, "")}.0nestate.app`;
  const domainStatus = site.domainStatus || "none";
  const sslStatus = site.sslStatus || "none";
  // Slug is assigned server-side on first save, so the link only appears once
  // the site has been persisted.
  const publicPath = site.slug ? `/site/${site.slug}` : null;

  const updateDraft = (patch: Partial<WebsiteSite>) => {
    setDraft({ ...site, ...patch });
    setDirty(true);
  };

  const handleSave = async (updated = site) => {
    if (!canEdit) return;
    setBusy(true);
    try {
      const next = { ...updated, ...applySectionLayout(resolveSections(updated)) };
      await saveWebsite(next);
      setDraft(next);
      setDirty(false);
      toast.success("Website saved");
    } catch {
      toast.error("Failed to save website settings.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectTemplate = (templateId: WebsiteTemplateId) => {
    if (!canEdit) return;
    const nextTemplate = getTemplate(templateId);
    const usingDefaultHero =
      !site.heroImageUrl ||
      site.heroImageUrl === getTemplate(site.templateId).defaultHeroImage;
    updateDraft({
      templateId,
      heroImageUrl: usingDefaultHero ? nextTemplate.defaultHeroImage : site.heroImageUrl,
    });
  };

  const handleHeroFile = async (file: File) => {
    if (!canEdit) return;
    setUploadingHero(true);
    try {
      const item =
        persistence === "supabase"
          ? await uploadSocialMediaFile(file, getAuthToken)
          : await fileToSocialMedia(file);
      updateDraft({ heroImageUrl: item.dataUrl });
      toast.success("Hero image updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update hero image");
    } finally {
      setUploadingHero(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!canEdit || !site.customDomain) return;
    setVerifying(true);
    updateDraft({ domainStatus: "verifying" });

    try {
      const res = await fetch("/api/website/domain/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: site.customDomain, orgId: org.id }),
      });
      const data = await res.json();
      const nextStatus =
        data.status === "connected" ? "connected" : data.status === "failed" ? "failed" : "pending";
      const nextSsl =
        data.ssl === "provisioning" ? "provisioning" : data.ssl === "active" ? "active" : "none";
      const next = {
        ...site,
        customDomain: data.domain || site.customDomain,
        domainStatus: nextStatus as DomainStatus,
        domainVerifiedAt:
          nextStatus === "connected" ? new Date().toISOString() : site.domainVerifiedAt,
        sslStatus: nextSsl as SslStatus,
      };
      setDraft(next);
      await saveWebsite(next);
      setDirty(false);
      if (nextStatus === "connected") toast.success(data.message || "Domain connected");
      else toast.info(data.message || "Domain not yet verified.");
    } catch {
      updateDraft({ domainStatus: "failed" });
      toast.error("Domain verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="-m-4 flex min-h-[calc(100vh-10rem)] flex-col sm:-m-6 lg:-m-8">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="mr-auto text-xs text-[var(--muted)]">
          Hover text to edit · hover the hero photo to replace it · Sections to add, hide, or reorder blocks
        </p>
        <Button
          size="sm"
          variant={panel === "theme" ? "secondary" : "ghost"}
          onClick={() => setPanel(panel === "theme" ? "none" : "theme")}
        >
          <Monitor className="h-3.5 w-3.5" />
          {template.name}
        </Button>
        <Button
          size="sm"
          variant={panel === "sections" ? "secondary" : "ghost"}
          onClick={() => setPanel(panel === "sections" ? "none" : "sections")}
        >
          Sections
        </Button>
        <Button
          size="sm"
          variant={panel === "domain" ? "secondary" : "ghost"}
          onClick={() => setPanel(panel === "domain" ? "none" : "domain")}
        >
          <Globe className="h-3.5 w-3.5" />
          Domain
        </Button>
        <Badge tone={site.published ? "success" : "warning"}>
          {site.published ? "Published" : "Draft"}
        </Badge>
        {site.published && publicPath ? (
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs underline text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View live site
          </a>
        ) : null}
        {canEdit ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const next = { ...site, published: !site.published };
                setDraft(next);
                void handleSave(next);
              }}
            >
              {site.published ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" disabled={busy || !dirty} onClick={() => void handleSave()}>
              {busy ? "Saving…" : dirty ? "Save" : "Saved"}
            </Button>
          </>
        ) : null}
      </div>

      {panel !== "none" ? (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          {panel === "theme" ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {FEATURED_TEMPLATES.map((tmpl) => {
                const active = hydrated.templateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`rounded-xl border p-2 text-left ${
                      active ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "border-[var(--border)]"
                    }`}
                  >
                    <div
                      className="h-16 rounded-lg"
                      style={{ background: tmpl.thumbnailGradient }}
                    />
                    <p className="mt-2 text-xs font-semibold">{tmpl.name}</p>
                    <p className="text-[10px] text-[var(--muted)]">{tmpl.tagline}</p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {panel === "sections" ? (
            <SectionPalette site={hydrated} canEdit={canEdit} onChange={updateDraft} />
          ) : null}

          {panel === "domain" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--muted)]">Custom domain</label>
                <div className="flex gap-2">
                  <Input
                    value={site.customDomain || ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateDraft({ customDomain: e.target.value, domainStatus: "none" })
                    }
                    placeholder="agency.com"
                  />
                  <Button
                    variant="secondary"
                    disabled={!canEdit || !site.customDomain || verifying}
                    onClick={() => void handleVerifyDomain()}
                  >
                    {verifying ? "Checking…" : "Verify DNS"}
                  </Button>
                </div>
                {domainStatus !== "none" ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={DOMAIN_STATUS_META[domainStatus].tone}>
                      {DOMAIN_STATUS_META[domainStatus].label}
                    </Badge>
                    {sslStatus !== "none" ? (
                      <Badge tone={SSL_STATUS_META[sslStatus].tone} className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {SSL_STATUS_META[sslStatus].label}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-[11px] text-[var(--muted)]">
                  CNAME {customDomain} → sites.0nestate.app
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <WebsiteCanvas
          site={hydrated}
          orgName={org.name}
          listings={activeListings}
          market={market}
          editable={canEdit}
          uploadingHero={uploadingHero}
          onChange={(patch) => updateDraft(patch)}
          onHeroFile={(file) => void handleHeroFile(file)}
        />
      </div>
    </div>
  );
}

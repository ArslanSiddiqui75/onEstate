"use client";

import { Suspense, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { FEATURED_TEMPLATES, getTemplate } from "@/lib/website/templates";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import {
  addSection,
  applySectionLayout,
  resolveSections,
  setSectionVisible,
} from "@/lib/website/sections";
import { WebsiteCanvas } from "@/components/website/website-preview";
import { DomainPanel } from "@/components/website/domain-panel";
import { PublicContactForm } from "@/components/website/public-contact-form";
import { fileToSocialMedia, uploadSocialMediaFile } from "@/lib/social/media";
import type { WebsiteSectionKind, WebsiteSite, WebsiteTemplateId, DomainStatus, SslStatus } from "@/types";
import { useModuleSection } from "@/lib/nav/module-section";

export default function AppWebsitePage() {
  return (
    <Suspense fallback={null}>
      <WebsiteEditor />
    </Suspense>
  );
}

function WebsiteEditor() {
  const { user, org, website, saveWebsite, listings, market, getAuthToken, persistence, addLead } =
    useAppSession();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(website);
  const [dirty, setDirty] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [panel] = useModuleSection("section", ["theme", "words", "page", "domain"] as const, "theme");

  useEffect(() => {
    if (website) {
      setDraft(website);
      setDirty(false);
    }
  }, [website]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user, org.plan, "website", "view")) {
    return (
      <LockedModule
        title="Website locked"
        reason="Website builder is limited to Owner, Broker, and Team Lead."
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
        module="website"
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

  const canEdit = hasModuleAccess(user, org.plan, "website", "edit");
  const activeListings = listings.filter(
    (l) =>
      l.market === market &&
      (l.status === "active" || l.status === "under_offer"),
  );
  const hydrated = hydrateWebsiteSite(site, org.name);
  const template = getTemplate(hydrated.templateId);
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
    const cleared = resolveSections(site).map((section) => ({
      kind: section.kind,
      visible: section.visible,
    }));
    updateDraft({
      templateId,
      heroImageUrl: usingDefaultHero ? nextTemplate.defaultHeroImage : site.heroImageUrl,
      ...applySectionLayout(cleared),
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
      const next = {
        ...site,
        customDomain: data.domain || site.customDomain,
        domainStatus: nextStatus,
        domainVerifiedAt:
          nextStatus === "connected" ? new Date().toISOString() : site.domainVerifiedAt,
        sslStatus: nextSsl,
      };
      setDraft(next);
      try {
        await saveWebsite(next);
      } catch (err) {
        setDirty(true);
        toast.error(
          err instanceof Error
            ? `Couldn’t save the domain: ${err.message}`
            : "Couldn’t save the domain. Try again.",
        );
        return;
      }
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

  const pageSections = resolveSections(hydrated);
  function showBlock(kind: WebsiteSectionKind, on: boolean) {
    const exists = pageSections.some((section) => section.kind === kind);
    const next =
      !exists && on ? addSection(pageSections, kind) : setSectionVisible(pageSections, kind, on);
    updateDraft(applySectionLayout(next));
  }

  const blocks: { kind: WebsiteSectionKind; label: string }[] = [
    { kind: "hero", label: "Opening" },
    { kind: "listings", label: "Homes" },
    { kind: "about", label: "About" },
    { kind: "testimonials", label: "Client quotes" },
    { kind: "stats", label: "Numbers" },
    { kind: "contact", label: "Enquiry form" },
  ];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={site.published ? "success" : "warning"}>
            {site.published ? "Published" : "Draft"}
          </Badge>
          {site.published && publicPath ? (
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View live site
            </a>
          ) : null}
          {canEdit ? (
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (!site.published && activeListings.length === 0) {
                    toast.error("Publish needs an active listing. Drafts stay off the public site.");
                    return;
                  }
                  const nextPublished = !site.published;
                  const confirmed = window.confirm(
                    nextPublished
                      ? "Publish this site so it is public?"
                      : "Unpublish this site? Visitors will no longer see it.",
                  );
                  if (!confirmed) return;
                  const next = { ...site, published: nextPublished };
                  setDraft(next);
                  void handleSave(next);
                }}
              >
                {site.published ? "Unpublish" : "Publish"}
              </Button>
              <Button size="sm" disabled={busy || !dirty} onClick={() => void handleSave()}>
                {busy ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
            </div>
          ) : null}
        </div>

        {panel === "theme" ? (
        <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h2 className="font-semibold">Theme</h2>
            <p className="text-sm text-[var(--muted)]">Each theme has its own type, photo treatment, and way of listing homes.</p>
          </div>
          <div className="grid gap-2">
            {FEATURED_TEMPLATES.map((tmpl) => {
              const active = hydrated.templateId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`rounded-[1rem] border p-3 text-left ${
                    active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-10 w-10 shrink-0 rounded-[0.7rem]"
                      style={{ background: tmpl.thumbnailGradient }}
                    />
                    <span>
                      <span className="block text-sm font-semibold">{tmpl.name}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{tmpl.description}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        ) : null}

        {panel === "words" ? (
        <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h2 className="font-semibold">Words</h2>
            <p className="text-sm text-[var(--muted)]">These are the lines visitors read. The preview updates as you type.</p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Headline</span>
            <Input value={hydrated.headline} disabled={!canEdit} onChange={(e) => updateDraft({ headline: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Supporting line</span>
            <Input value={hydrated.tagline} disabled={!canEdit} onChange={(e) => updateDraft({ tagline: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--muted)]">About</span>
            <Textarea value={hydrated.aboutBio || ""} disabled={!canEdit} onChange={(e) => updateDraft({ aboutBio: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-[var(--muted)]">Phone</span>
              <Input value={hydrated.phone || ""} disabled={!canEdit} onChange={(e) => updateDraft({ phone: e.target.value })} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-[var(--muted)]">Email</span>
              <Input value={hydrated.email || ""} disabled={!canEdit} onChange={(e) => updateDraft({ email: e.target.value })} />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Button label</span>
            <Input value={hydrated.primaryCta} disabled={!canEdit} onChange={(e) => updateDraft({ primaryCta: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--muted)]">Cover photo</span>
            <input
              type="file"
              accept="image/*"
              disabled={!canEdit || uploadingHero}
              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-[1rem] file:border file:border-[var(--border)] file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--foreground)]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.currentTarget.value = "";
                if (file) void handleHeroFile(file);
              }}
            />
            <span className="text-xs text-[var(--muted)]">{uploadingHero ? "Uploading…" : "Or keep the theme’s photograph."}</span>
          </label>
        </section>
        ) : null}

        {panel === "page" ? (
        <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <h2 className="font-semibold">On the page</h2>
            <p className="text-sm text-[var(--muted)]">Turn a block off if you don’t need it. The theme decides how the rest looks.</p>
          </div>
          <ul className="space-y-2">
            {blocks.map((block) => {
              const on = pageSections.find((section) => section.kind === block.kind)?.visible !== false
                && pageSections.some((section) => section.kind === block.kind);
              return (
                <li key={block.kind} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{block.label}</span>
                  <Switch checked={on} disabled={!canEdit} onCheckedChange={(value) => showBlock(block.kind, value)} />
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-[var(--muted)]">
            The enquiry form opens a new opportunity and saves the person as a contact.
          </p>
        </section>
        ) : null}

        {panel === "domain" ? (
        <section className="space-y-3 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">Domain</h2>
          <DomainPanel
            site={site}
            canEdit={canEdit}
            verifying={verifying}
            onChange={updateDraft}
            onVerify={() => void handleVerifyDomain()}
          />
        </section>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <WebsiteCanvas
          site={hydrated}
          orgName={org.name}
          listings={activeListings}
          market={market}
          editable={false}
          uploadingHero={uploadingHero}
          contactForm={
            <PublicContactForm
              site={site.slug || org.id}
              ctaLabel={hydrated.primaryCta}
              colors={{
                surface: template.colors.surface,
                text: template.colors.text,
                muted: template.colors.muted,
                accent: template.colors.accent,
                accentText: template.colors.accentText,
                border: template.colors.border,
              }}
              wrapperBackground={template.id === "luxury-dark" ? template.colors.surface : template.colors.bg}
              onCapture={async (input) => {
                await addLead({
                  name: input.name,
                  email: input.email,
                  phone: input.phone,
                  type: input.type,
                  stage: "new",
                  score: 0,
                  assignedTo: user.id,
                  market,
                  source: "Website",
                  notes: input.message,
                  nextAction: "Respond to website enquiry",
                  priority: "high",
                });
                toast.success("Saved to Opportunities and Contacts");
              }}
            />
          }
        />
      </div>
    </div>
  );
}

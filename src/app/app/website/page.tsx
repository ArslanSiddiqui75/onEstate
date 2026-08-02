"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Layout,
  Palette,
  Eye,
  CheckCircle2,
  ExternalLink,
  Building2,
  UserCheck,
  Send,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Check,
  Monitor,
} from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/utils";
import { WEBSITE_TEMPLATES, getTemplate } from "@/lib/website/templates";
import type { WebsiteTemplateId, DomainStatus, SslStatus } from "@/types";

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
  const { user, org, website, saveWebsite, listings, market } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(website);
  const [previewTab, setPreviewTab] = useState<"website" | "client_portal">("website");
  const [verifying, setVerifying] = useState(false);

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
        Loading website builder settings…
      </div>
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "website", "edit");
  const activeListings = listings.filter((l) => l.market === market);
  const template = getTemplate(site.templateId);

  const customDomain = site.customDomain || `${org.name.toLowerCase().replace(/\s+/g, "")}.0nestate.app`;
  const showHero = site.showHero ?? true;
  const showListings = site.showListings ?? true;
  const showClientPortal = site.showClientPortal ?? true;
  const showContactForm = site.showContactForm ?? true;
  const showAgentBio = site.showAgentBio ?? true;
  const aboutBio = site.aboutBio || "Premier real estate brokerage delivering tailored properties, market intelligence, and seamless closing experiences.";
  const domainStatus = site.domainStatus || "none";
  const sslStatus = site.sslStatus || "none";

  const handleSave = async (updated = site) => {
    if (!canEdit) return;
    setBusy(true);
    try {
      await saveWebsite(updated);
      toast.success("Website settings updated successfully!");
    } catch {
      toast.error("Failed to save website settings.");
    } finally {
      setBusy(false);
    }
  };

  const handleSelectTemplate = (templateId: WebsiteTemplateId) => {
    if (!canEdit) return;
    const next = { ...site, templateId };
    setDraft(next);
    void handleSave(next);
  };

  const handleVerifyDomain = async () => {
    if (!canEdit || !site.customDomain) return;
    setVerifying(true);
    const verifyingDraft = { ...site, domainStatus: "verifying" as const };
    setDraft(verifyingDraft);

    try {
      const res = await fetch("/api/website/domain/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: site.customDomain, orgId: org.id }),
      });
      const data = await res.json();

      const nextStatus = data.status === "connected" ? "connected" : data.status === "failed" ? "failed" : "pending";
      const nextSsl = data.ssl === "provisioning" ? "provisioning" : data.ssl === "active" ? "active" : "none";

      const next = {
        ...site,
        customDomain: data.domain || site.customDomain,
        domainStatus: nextStatus as DomainStatus,
        domainVerifiedAt: nextStatus === "connected" ? new Date().toISOString() : site.domainVerifiedAt,
        sslStatus: nextSsl as SslStatus,
      };
      setDraft(next);
      await saveWebsite(next);

      if (nextStatus === "connected") {
        toast.success(data.message || "Domain connected successfully!");
      } else {
        toast.info(data.message || "Domain not yet verified. Check your DNS settings.");
      }
    } catch {
      const next = { ...site, domainStatus: "failed" as const };
      setDraft(next);
      toast.error("Domain verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  // Template-driven colors for the live preview
  const tc = template.colors;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="stat-icon-chip h-10 w-10 rounded-xl">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg tracking-tight">Website Builder & Client Portal</h2>
              <Badge tone={site.published ? "success" : "warning"}>
                {site.published ? "Live / Published" : "Draft Mode"}
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted)] flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" />
              https://{customDomain}
              {template && (
                <Badge tone="accent" className="ml-2 text-[10px]">
                  {template.name}
                </Badge>
              )}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const next = { ...site, published: !site.published };
                setDraft(next);
                void handleSave(next);
              }}
            >
              {site.published ? "Unpublish Site" : "Publish Live"}
            </Button>
            <Button disabled={busy} onClick={() => void handleSave()}>
              {busy ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-6 lg:grid-cols-12"
      >
        {/* Left Column: Builder Settings */}
        <motion.div variants={fadeUp} className="lg:col-span-6 space-y-4">
          <Tabs defaultValue="templates" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="templates" className="gap-1.5 text-xs">
                <Monitor className="h-3.5 w-3.5" /> Themes
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5 text-xs">
                <Layout className="h-3.5 w-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger value="sections" className="gap-1.5 text-xs">
                <Palette className="h-3.5 w-3.5" /> Blocks
              </TabsTrigger>
              <TabsTrigger value="domain" className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" /> Domain
              </TabsTrigger>
            </TabsList>

            {/* Templates Tab */}
            <TabsContent value="templates" className="mt-4">
              <Card className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-sm">Choose a Theme</h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">Select a pre-built design for your public website. Each theme includes colour palette, typography, and layout presets.</p>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  {WEBSITE_TEMPLATES.map((tmpl) => {
                    const isActive = site.templateId === tmpl.id || (!site.templateId && tmpl.id === "modern-minimal");
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        className={`relative group rounded-xl border-2 p-0.5 text-left transition-all duration-200 ${
                          isActive
                            ? "border-[var(--accent)] shadow-[var(--shadow-glow-accent)] ring-1 ring-[var(--accent)]/20"
                            : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md"
                        } ${!canEdit ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {/* Thumbnail */}
                        <div
                          className="relative h-20 w-full rounded-t-lg overflow-hidden"
                          style={{ background: tmpl.thumbnailGradient }}
                        >
                          {/* Mini layout mockup */}
                          <div className="absolute inset-2 flex flex-col gap-1 items-center justify-center">
                            <div className="h-1.5 w-12 rounded-full bg-white/30" />
                            <div className="h-1 w-16 rounded-full bg-white/20" />
                            <div className="mt-1 flex gap-1">
                              <div className="h-6 w-8 rounded bg-white/15" />
                              <div className="h-6 w-8 rounded bg-white/15" />
                            </div>
                          </div>
                          {isActive && (
                            <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className="p-2.5 rounded-b-lg bg-[var(--surface)]">
                          <p className="text-xs font-semibold truncate">{tmpl.name}</p>
                          <p className="text-[10px] text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">{tmpl.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </TabsContent>

            {/* Content & Copy Tab */}
            <TabsContent value="content" className="mt-4">
              <Card className="space-y-4 p-5">
                <h3 className="font-semibold text-sm">Hero & Brand Messaging</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Site Headline</label>
                    <Input
                      value={site.headline}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...site, headline: e.target.value })}
                      placeholder="e.g. Exceptional Properties, Unrivaled Service"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Tagline</label>
                    <Input
                      value={site.tagline}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...site, tagline: e.target.value })}
                      placeholder="e.g. London & Home Counties Premier Real Estate"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Primary Call to Action</label>
                    <Input
                      value={site.primaryCta}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...site, primaryCta: e.target.value })}
                      placeholder="e.g. Request Valuation / View Listings"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Brokerage Bio / About Text</label>
                    <Textarea
                      value={aboutBio}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...site, aboutBio: e.target.value })}
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Layout Blocks Tab */}
            <TabsContent value="sections" className="mt-4">
              <Card className="space-y-4 p-5">
                <h3 className="font-semibold text-sm">Page Section Controls</h3>
                <div className="space-y-3 divide-y divide-[var(--border)]">
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-sm font-medium">Hero Header Banner</p>
                      <p className="text-xs text-[var(--muted)]">Display main headline, tagline, and call to action</p>
                    </div>
                    <Switch
                      checked={showHero}
                      disabled={!canEdit}
                      onCheckedChange={(val) => setDraft({ ...site, showHero: val })}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-medium">Featured Listings Grid</p>
                      <p className="text-xs text-[var(--muted)]">Auto-sync live active inventory on the public site</p>
                    </div>
                    <Switch
                      checked={showListings}
                      disabled={!canEdit}
                      onCheckedChange={(val) => setDraft({ ...site, showListings: val })}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-medium">Client Portal Link Banner</p>
                      <p className="text-xs text-[var(--muted)]">Allow buyers, sellers & tenants to log into their deal portal</p>
                    </div>
                    <Switch
                      checked={showClientPortal}
                      disabled={!canEdit}
                      onCheckedChange={(val) => setDraft({ ...site, showClientPortal: val })}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-medium">Lead Capture & Contact Form</p>
                      <p className="text-xs text-[var(--muted)]">Direct inquiries automatically routed to CRM leads pipeline</p>
                    </div>
                    <Switch
                      checked={showContactForm}
                      disabled={!canEdit}
                      onCheckedChange={(val) => setDraft({ ...site, showContactForm: val })}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-sm font-medium">About Agency / Team Bio</p>
                      <p className="text-xs text-[var(--muted)]">Showcase brokerage credentials and heritage</p>
                    </div>
                    <Switch
                      checked={showAgentBio}
                      disabled={!canEdit}
                      onCheckedChange={(val) => setDraft({ ...site, showAgentBio: val })}
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Domain & Contact Details Tab */}
            <TabsContent value="domain" className="mt-4">
              <Card className="space-y-5 p-5">
                <h3 className="font-semibold text-sm">Custom Domain Setup</h3>

                {/* Domain input + verify */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--muted)]">Your Domain</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={site.customDomain || ""}
                      disabled={!canEdit}
                      onChange={(e) => setDraft({ ...site, customDomain: e.target.value, domainStatus: "none" })}
                      placeholder="agency.com"
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      disabled={!canEdit || !site.customDomain || verifying}
                      onClick={() => void handleVerifyDomain()}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Checking…
                        </>
                      ) : (
                        "Verify DNS"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Domain status */}
                {domainStatus !== "none" && (
                  <div className={`rounded-xl border p-4 space-y-2 ${
                    domainStatus === "connected"
                      ? "border-[var(--success)]/30 bg-[var(--success-soft)]"
                      : domainStatus === "failed"
                        ? "border-[var(--danger)]/30 bg-[var(--danger-soft)]"
                        : "border-[var(--accent)]/30 bg-[var(--accent-soft)]"
                  }`}>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const meta = DOMAIN_STATUS_META[domainStatus];
                        const Icon = meta.icon;
                        return (
                          <>
                            <Icon className={`h-4 w-4 ${domainStatus === "verifying" ? "animate-spin" : ""}`} />
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </>
                        );
                      })()}
                      {sslStatus !== "none" && (
                        <Badge tone={SSL_STATUS_META[sslStatus].tone} className="ml-auto gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {SSL_STATUS_META[sslStatus].label}
                        </Badge>
                      )}
                    </div>
                    {site.domainVerifiedAt && domainStatus === "connected" && (
                      <p className="text-[11px] text-[var(--muted)]">
                        Verified {new Date(site.domainVerifiedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                )}

                {/* DNS instructions */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-3">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-[var(--accent)]" />
                    DNS Configuration Instructions
                  </h4>
                  <div className="text-xs text-[var(--muted)] space-y-2">
                    <p>To connect your custom domain, add a <strong>CNAME</strong> record in your domain registrar&apos;s DNS settings:</p>
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)]">Type:</span>
                        <span className="font-semibold text-[var(--foreground)]">CNAME</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)]">Name:</span>
                        <span className="font-semibold text-[var(--foreground)]">{site.customDomain || "yourdomain.com"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--muted)]">Target:</span>
                        <span className="font-semibold text-[var(--accent)]">sites.0nestate.app</span>
                      </div>
                    </div>
                    <p>DNS changes can take up to 48 hours to propagate. Once the CNAME is set, click &quot;Verify DNS&quot; above.</p>
                  </div>
                </div>

                {/* Contact details */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-[var(--muted)]">Public Contact Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)]">Public Phone</label>
                      <Input
                        value={site.phone}
                        disabled={!canEdit}
                        onChange={(e) => setDraft({ ...site, phone: e.target.value })}
                        placeholder="+44 20 7946 0912"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--muted)]">Public Email</label>
                      <Input
                        value={site.email}
                        disabled={!canEdit}
                        onChange={(e) => setDraft({ ...site, email: e.target.value })}
                        placeholder="enquiries@agency.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Right Column: Interactive Live Preview Container */}
        <motion.div variants={fadeUp} className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] p-1.5 border border-[var(--border)]">
            <div className="flex items-center gap-2 px-2">
              <Eye className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold">Live Mode Preview</span>
              <Badge tone="accent" className="text-[9px] px-1.5">{template.name}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  previewTab === "website"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => setPreviewTab("website")}
              >
                Public Website
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  previewTab === "client_portal"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => setPreviewTab("client_portal")}
              >
                Client Portal
              </button>
            </div>
          </div>

          {/* Device Mockup Frame */}
          <div
            className="overflow-hidden rounded-2xl border shadow-[var(--shadow-ink)]"
            style={{
              backgroundColor: tc.bg,
              color: tc.text,
              borderColor: tc.border,
            }}
          >
            {/* Browser Address Bar */}
            <div
              className="flex items-center gap-2 border-b px-4 py-2.5 text-xs"
              style={{
                borderColor: tc.border,
                backgroundColor: tc.surface,
                color: tc.muted,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              <span
                className="ml-2 flex-1 rounded-md px-3 py-1 font-mono text-[11px]"
                style={{
                  backgroundColor: `${tc.text}10`,
                  color: tc.muted,
                }}
              >
                https://{customDomain}{previewTab === "client_portal" ? "/portal" : ""}
              </span>
            </div>

            {/* Live Content Area */}
            <div className="min-h-[480px] max-h-[560px] overflow-y-auto scrollbar-thin p-6 space-y-6">
              {previewTab === "website" ? (
                <>
                  {/* Hero Banner */}
                  {showHero && (
                    <div
                      className="relative rounded-2xl p-6 text-center"
                      style={{
                        background: `linear-gradient(135deg, ${tc.heroFrom}, ${tc.heroTo})`,
                        color: "#ffffff",
                        borderRadius: template.radius === "sharp" ? "8px" : template.radius === "pill" ? "24px" : "16px",
                      }}
                    >
                      <Badge tone="accent" className="mx-auto mb-3">
                        {org.name}
                      </Badge>
                      <h1
                        className="text-3xl font-bold tracking-tight"
                        style={{
                          fontFamily: template.fonts.heading,
                          textAlign: template.heroLayout === "left-aligned" ? "left" : "center",
                        }}
                      >
                        {site.headline}
                      </h1>
                      <p
                        className="mt-2 text-sm opacity-80"
                        style={{
                          textAlign: template.heroLayout === "left-aligned" ? "left" : "center",
                        }}
                      >
                        {site.tagline}
                      </p>
                      <div style={{ textAlign: template.heroLayout === "left-aligned" ? "left" : "center" }}>
                        <button
                          type="button"
                          className="mt-4 inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold shadow-lg transition hover:opacity-90"
                          style={{
                            backgroundColor: tc.accentText === "#ffffff" ? "#ffffff" : tc.accent,
                            color: tc.accentText === "#ffffff" ? tc.heroFrom : tc.accentText,
                            borderRadius: template.radius === "sharp" ? "6px" : template.radius === "pill" ? "9999px" : "12px",
                          }}
                        >
                          {site.primaryCta}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Featured Listings Embed */}
                  {showListings && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3
                          className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5"
                          style={{ color: tc.muted }}
                        >
                          <Building2 className="h-3.5 w-3.5" /> Featured Properties
                        </h3>
                        <span className="text-[11px]" style={{ color: tc.muted }}>
                          {activeListings.length} Active
                        </span>
                      </div>
                      <div className={`grid gap-3 ${template.listingLayout === "grid-3" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                        {activeListings.slice(0, template.listingLayout === "grid-3" ? 3 : 2).map((item) => (
                          <div
                            key={item.id}
                            className="p-3 space-y-2"
                            style={{
                              backgroundColor: tc.surface,
                              border: `1px solid ${tc.border}`,
                              borderRadius: template.radius === "sharp" ? "8px" : template.radius === "pill" ? "20px" : "12px",
                            }}
                          >
                            <div
                              className="h-24 w-full flex items-center justify-center text-xs"
                              style={{
                                backgroundColor: `${tc.text}08`,
                                color: tc.muted,
                                borderRadius: template.radius === "sharp" ? "6px" : "8px",
                              }}
                            >
                              {item.imageUrl ? "Property Image" : "Listing Photo"}
                            </div>
                            <h4
                              className="font-semibold text-xs truncate"
                              style={{ color: tc.text }}
                            >
                              {item.title}
                            </h4>
                            <p
                              className="text-sm font-bold"
                              style={{ color: tc.accent }}
                            >
                              {formatMoney(item.price, market)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client Portal Link Banner */}
                  {showClientPortal && (
                    <div
                      className="p-4 flex items-center justify-between"
                      style={{
                        backgroundColor: tc.surface,
                        border: `1px solid ${tc.border}`,
                        borderRadius: template.radius === "sharp" ? "8px" : "12px",
                      }}
                    >
                      <div>
                        <p className="text-xs font-semibold" style={{ color: tc.text }}>Client Portal Access</p>
                        <p className="text-[11px]" style={{ color: tc.muted }}>Buyers & Sellers view live deal checklists</p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
                        style={{
                          backgroundColor: `${tc.accent}20`,
                          color: tc.accent,
                          borderRadius: template.radius === "sharp" ? "6px" : "8px",
                        }}
                        onClick={() => setPreviewTab("client_portal")}
                      >
                        Portal Login →
                      </button>
                    </div>
                  )}

                  {/* About & Bio */}
                  {showAgentBio && (
                    <div
                      className="p-4 space-y-1.5"
                      style={{
                        backgroundColor: tc.surface,
                        border: `1px solid ${tc.border}`,
                        borderRadius: template.radius === "sharp" ? "8px" : "12px",
                      }}
                    >
                      <h4 className="text-xs font-semibold" style={{ color: tc.text }}>About {org.name}</h4>
                      <p className="text-xs leading-relaxed" style={{ color: tc.muted }}>{aboutBio}</p>
                    </div>
                  )}

                  {/* Contact Form */}
                  {showContactForm && (
                    <div
                      className="p-4 space-y-3"
                      style={{
                        backgroundColor: tc.surface,
                        border: `1px solid ${tc.border}`,
                        borderRadius: template.radius === "sharp" ? "8px" : "12px",
                      }}
                    >
                      <h4 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: tc.text }}>
                        <Send className="h-3.5 w-3.5" style={{ color: tc.accent }} /> Send an Inquiry
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2" style={{ backgroundColor: `${tc.text}05`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}>Your Name</div>
                        <div className="p-2" style={{ backgroundColor: `${tc.text}05`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}>Email / Phone</div>
                      </div>
                      <div className="p-2 text-xs h-16" style={{ backgroundColor: `${tc.text}05`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}>
                        How can we help with your property needs?
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-2 text-[11px]" style={{ color: tc.muted }}>
                    {[site.phone, site.email].filter(Boolean).join(" · ")}
                  </div>
                </>
              ) : (
                /* Client Portal Mode Preview */
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4 space-y-2"
                    style={{
                      backgroundColor: `${tc.accent}15`,
                      border: `1px solid ${tc.accent}30`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <Badge tone="success" className="gap-1">
                        <UserCheck className="h-3 w-3" /> Client Portal Mode
                      </Badge>
                      <span className="text-[11px]" style={{ color: tc.muted }}>Logged in as Client</span>
                    </div>
                    <h3 className="font-display text-lg font-bold" style={{ color: tc.text }}>Welcome, Sarah Jenkins</h3>
                    <p className="text-xs" style={{ color: tc.muted }}>
                      Track your transaction progress, e-signature requests, and solicitor documents in real time.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: tc.muted }}>
                      Active Transaction Checklist
                    </h4>
                    <div className="space-y-2">
                      <div
                        className="p-3 flex items-center justify-between text-xs"
                        style={{ backgroundColor: tc.surface, border: `1px solid ${tc.border}`, borderRadius: "8px" }}
                      >
                        <span className="flex items-center gap-2" style={{ color: tc.text }}>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Identity & AML Verification
                        </span>
                        <Badge tone="success">Completed</Badge>
                      </div>
                      <div
                        className="p-3 flex items-center justify-between text-xs"
                        style={{ backgroundColor: tc.surface, border: `1px solid ${tc.border}`, borderRadius: "8px" }}
                      >
                        <span className="flex items-center gap-2" style={{ color: tc.text }}>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Draft Contract E-Sign
                        </span>
                        <Badge tone="success">Signed</Badge>
                      </div>
                      <div
                        className="p-3 flex items-center justify-between text-xs"
                        style={{ backgroundColor: tc.surface, border: `1px solid ${tc.border}`, borderRadius: "8px" }}
                      >
                        <span className="flex items-center gap-2" style={{ color: tc.muted }}>
                          <Sparkles className="h-4 w-4 text-amber-400" /> Local Authority Searches
                        </span>
                        <Badge tone="warning">In Progress</Badge>
                      </div>
                    </div>
                  </div>

                  <div
                    className="rounded-xl p-4 text-center space-y-2"
                    style={{ backgroundColor: tc.surface, border: `1px solid ${tc.border}` }}
                  >
                    <p className="text-xs font-medium" style={{ color: tc.text }}>Need support from your agent?</p>
                    <p className="text-xs" style={{ color: tc.muted }}>{site.phone || site.email || "Contact your brokerage advisor anytime."}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

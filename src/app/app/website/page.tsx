"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Layout,
  Palette,
  Eye,
  CheckCircle2,
  Lock,
  ExternalLink,
  Building2,
  UserCheck,
  Send,
  Sparkles,
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

export default function AppWebsitePage() {
  const { user, org, website, saveWebsite, listings, market } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(website);
  const [previewTab, setPreviewTab] = useState<"website" | "client_portal">("website");

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

  const customDomain = site.customDomain || `${org.name.toLowerCase().replace(/\s+/g, "")}.0nestate.app`;
  const showHero = site.showHero ?? true;
  const showListings = site.showListings ?? true;
  const showClientPortal = site.showClientPortal ?? true;
  const showContactForm = site.showContactForm ?? true;
  const showAgentBio = site.showAgentBio ?? true;
  const aboutBio = site.aboutBio || "Premier real estate brokerage delivering tailored properties, market intelligence, and seamless closing experiences.";

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
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid grid-cols-3">
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
              <Card className="space-y-4 p-5">
                <h3 className="font-semibold text-sm">Domain & Public Contact Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--muted)]">Custom Domain</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={customDomain}
                        disabled={!canEdit}
                        onChange={(e) => setDraft({ ...site, customDomain: e.target.value })}
                        placeholder="agency.com"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">CNAME record points to `nodes.0nestate.app`</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
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
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b121a] shadow-[var(--shadow-ink)] text-white">
            {/* Browser Address Bar */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white/50">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 flex-1 rounded-md bg-white/10 px-3 py-1 font-mono text-[11px] text-white/70">
                https://{customDomain}{previewTab === "client_portal" ? "/portal" : ""}
              </span>
            </div>

            {/* Live Content Area */}
            <div className="min-h-[480px] max-h-[560px] overflow-y-auto scrollbar-thin p-6 space-y-6">
              {previewTab === "website" ? (
                <>
                  {/* Hero Banner */}
                  {showHero && (
                    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 text-center">
                      <Badge tone="accent" className="mx-auto mb-3">
                        {org.name}
                      </Badge>
                      <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                        {site.headline}
                      </h1>
                      <p className="mt-2 text-sm text-white/70">{site.tagline}</p>
                      <button
                        type="button"
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-[#0b121a] shadow-lg transition hover:bg-white/90"
                      >
                        {site.primaryCta}
                      </button>
                    </div>
                  )}

                  {/* Featured Listings Embed */}
                  {showListings && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs uppercase tracking-wider text-white/60 font-semibold flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" /> Featured Properties
                        </h3>
                        <span className="text-[11px] text-white/40">{activeListings.length} Active</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeListings.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2"
                          >
                            <div className="h-24 w-full rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/40">
                              {item.imageUrl ? "Property Image" : "Listing Photo"}
                            </div>
                            <h4 className="font-semibold text-xs text-white truncate">{item.title}</h4>
                            <p className="font-display text-sm font-bold text-[var(--accent-on-ink)]">
                              {formatMoney(item.price, market)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client Portal Link Banner */}
                  {showClientPortal && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">Client Portal Access</p>
                        <p className="text-[11px] text-white/60">Buyers & Sellers view live deal checklists</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
                        onClick={() => setPreviewTab("client_portal")}
                      >
                        Portal Login →
                      </button>
                    </div>
                  )}

                  {/* About & Bio */}
                  {showAgentBio && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1.5">
                      <h4 className="text-xs font-semibold text-white">About {org.name}</h4>
                      <p className="text-xs text-white/70 leading-relaxed">{aboutBio}</p>
                    </div>
                  )}

                  {/* Contact Form */}
                  {showContactForm && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Send className="h-3.5 w-3.5 text-[var(--accent-on-ink)]" /> Send an Inquiry
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50">Your Name</div>
                        <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50">Email / Phone</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/50 h-16">
                        How can we help with your property needs?
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-2 text-[11px] text-white/40">
                    {[site.phone, site.email].filter(Boolean).join(" · ")}
                  </div>
                </>
              ) : (
                /* Client Portal Mode Preview */
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge tone="success" className="gap-1">
                        <UserCheck className="h-3 w-3" /> Client Portal Mode
                      </Badge>
                      <span className="text-[11px] text-white/60">Logged in as Client</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-white">Welcome, Sarah Jenkins</h3>
                    <p className="text-xs text-white/70">
                      Track your transaction progress, e-signature requests, and solicitor documents in real time.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Active Transaction Checklist
                    </h4>
                    <div className="space-y-2">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-white">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Identity & AML Verification
                        </span>
                        <Badge tone="success">Completed</Badge>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-white">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Draft Contract E-Sign
                        </span>
                        <Badge tone="success">Signed</Badge>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-white/70">
                          <Sparkles className="h-4 w-4 text-amber-400" /> Local Authority Searches
                        </span>
                        <Badge tone="warning">In Progress</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
                    <p className="text-xs font-medium text-white">Need support from your agent?</p>
                    <p className="text-xs text-white/60">{site.phone || site.email || "Contact your brokerage advisor anytime."}</p>
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

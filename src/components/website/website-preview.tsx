"use client";

import { ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getTemplate } from "@/lib/website/templates";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import { EditableImage, EditableText } from "@/components/website/editable-field";
import type { Listing, Market, WebsiteSite } from "@/types";

type WebsiteField = keyof Pick<
  WebsiteSite,
  | "headline"
  | "tagline"
  | "primaryCta"
  | "secondaryCta"
  | "aboutHeading"
  | "aboutBio"
  | "listingsHeading"
  | "contactHeading"
  | "phone"
  | "email"
  | "footerNote"
>;

export function WebsiteCanvas({
  site,
  orgName,
  listings,
  market,
  editable,
  uploadingHero,
  onChange,
  onHeroFile,
}: {
  site: WebsiteSite;
  orgName: string;
  listings: Listing[];
  market: Market;
  editable?: boolean;
  uploadingHero?: boolean;
  onChange?: (field: WebsiteField, value: string) => void;
  onHeroFile?: (file: File) => void;
}) {
  const hydrated = hydrateWebsiteSite(site, orgName);
  const template = getTemplate(hydrated.templateId);
  const tc = template.colors;
  const heroImage = hydrated.heroImageUrl || template.defaultHeroImage;
  const showHero = hydrated.showHero ?? true;
  const showListings = hydrated.showListings ?? true;
  const showAgentBio = hydrated.showAgentBio ?? true;
  const showContactForm = hydrated.showContactForm ?? true;
  const activeListings = listings.filter((l) => l.market === market);
  const listingCount = template.listingLayout === "grid-3" ? 3 : 2;
  const patch = (field: WebsiteField, value: string) => onChange?.(field, value);
  const isDark = template.id === "luxury-dark";
  const isSplit = template.heroLayout === "split";

  const pill = {
    backgroundColor: tc.accent,
    color: tc.accentText,
    borderRadius: 9999,
  };
  const ghostPill = {
    border: `1px solid ${isDark ? "rgba(255,255,255,0.35)" : tc.border}`,
    borderRadius: 9999,
    color: isDark ? "#fff" : tc.text,
  };

  return (
    <div
      className="min-h-full"
      style={{
        backgroundColor: tc.bg,
        color: tc.text,
        fontFamily: template.fonts.body,
      }}
    >
      {isSplit ? (
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">{orgName}</p>
          <nav className="hidden gap-8 text-[12px] md:flex" style={{ color: tc.muted }}>
            <span>Home</span>
            <span>Properties</span>
            <span>About</span>
            <span>Contact</span>
          </nav>
          <span className="px-4 py-2 text-[11px] font-medium" style={ghostPill}>
            {hydrated.primaryCta}
          </span>
        </header>
      ) : null}

      {showHero ? (
        isSplit ? (
          <section className="grid items-stretch gap-5 px-5 pb-8 md:grid-cols-[1.1fr_0.9fr] md:px-8">
            <div
              className="flex min-h-[62vh] flex-col justify-between rounded-[2rem] px-8 py-10 md:px-12"
              style={{ backgroundColor: tc.surface, color: tc.text }}
            >
              <EditableText
                as="p"
                enabled={editable}
                value={hydrated.tagline}
                onChange={(v) => patch("tagline", v)}
                placeholder="Short line above the headline"
                className="text-center text-xs tracking-wide"
                style={{ color: tc.muted }}
              />
              <EditableText
                as="h1"
                enabled={editable}
                value={hydrated.headline}
                onChange={(v) => patch("headline", v)}
                placeholder="Your headline"
                className="text-center text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl"
              />
              <div className="flex items-center justify-between gap-4">
                <EditableText
                  enabled={editable}
                  value={hydrated.primaryCta}
                  onChange={(v) => patch("primaryCta", v)}
                  placeholder="Primary button"
                  className="inline-flex px-5 py-2.5 text-sm font-medium"
                  style={pill}
                />
                <EditableText
                  enabled={editable}
                  value={hydrated.secondaryCta || ""}
                  onChange={(v) => patch("secondaryCta", v)}
                  placeholder="Secondary link"
                  className="inline-flex items-center gap-1 text-sm"
                />
              </div>
            </div>
            <EditableImage
              enabled={editable}
              uploading={uploadingHero}
              onPickFile={(file) => onHeroFile?.(file)}
              className="min-h-[360px] overflow-hidden rounded-[2rem] bg-cover bg-center md:min-h-[62vh]"
              style={{ backgroundImage: `url(${heroImage})` }}
            >
              <div className="h-full min-h-[360px] md:min-h-[62vh]" />
            </EditableImage>
          </section>
        ) : (
          <section className="relative">
            <EditableImage
              enabled={editable}
              uploading={uploadingHero}
              onPickFile={(file) => onHeroFile?.(file)}
              className={`relative overflow-hidden bg-cover bg-center ${
                template.heroLayout === "overlay" ? "mx-0 min-h-[86vh] rounded-b-[2.5rem]" : "mx-4 mt-4 min-h-[78vh] rounded-[2.5rem] md:mx-6"
              }`}
              style={{ backgroundImage: `url(${heroImage})` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    template.heroLayout === "left-aligned"
                      ? "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 70%)"
                      : "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.7) 100%)",
                }}
              />
              <header className="relative z-10 flex items-center justify-between px-6 py-5 text-white md:px-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">{orgName}</p>
                <nav className="hidden gap-8 text-[12px] text-white/80 md:flex">
                  <span>Home</span>
                  <span>Properties</span>
                  <span>About</span>
                  <span>Contact</span>
                </nav>
                <span className="rounded-full border border-white/40 px-4 py-2 text-[11px] font-medium">
                  {hydrated.phone || hydrated.email || hydrated.primaryCta}
                </span>
              </header>
              <div
                className={`relative z-10 flex min-h-[68vh] flex-col px-6 pb-14 text-white md:px-12 ${
                  template.heroLayout === "left-aligned"
                    ? "items-start justify-end text-left"
                    : "items-start justify-end md:max-w-3xl"
                }`}
              >
                <EditableText
                  as="h1"
                  enabled={editable}
                  value={hydrated.headline}
                  onChange={(v) => patch("headline", v)}
                  placeholder="Your headline"
                  className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
                />
                <EditableText
                  as="p"
                  enabled={editable}
                  value={hydrated.tagline}
                  onChange={(v) => patch("tagline", v)}
                  placeholder="Your tagline"
                  className="mt-5 max-w-md text-sm leading-relaxed text-white/80 md:text-base"
                />
                <div className="mt-8 flex flex-wrap gap-3">
                  <EditableText
                    enabled={editable}
                    value={hydrated.primaryCta}
                    onChange={(v) => patch("primaryCta", v)}
                    placeholder="Primary button"
                    className="inline-flex px-6 py-2.5 text-sm font-medium"
                    style={{ backgroundColor: "#fff", color: "#111", borderRadius: 9999 }}
                  />
                  <EditableText
                    enabled={editable}
                    value={hydrated.secondaryCta || ""}
                    onChange={(v) => patch("secondaryCta", v)}
                    placeholder="Secondary"
                    className="inline-flex items-center px-5 py-2.5 text-sm text-white/90"
                  />
                </div>
              </div>
            </EditableImage>
          </section>
        )
      ) : (
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">{orgName}</p>
        </header>
      )}

      {showListings ? (
        <section className="px-6 py-20 md:px-10">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light" style={{ color: tc.muted }}>
                /
              </span>
              <EditableText
                as="h2"
                enabled={editable}
                value={hydrated.listingsHeading || ""}
                onChange={(v) => patch("listingsHeading", v)}
                placeholder="Featured properties"
                className="text-3xl font-semibold tracking-tight md:text-4xl"
              />
            </div>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: tc.muted }}>
              {activeListings.length} live {activeListings.length === 1 ? "home" : "homes"} from your listings.
            </p>
          </div>
          <div
            className={`grid gap-6 ${template.listingLayout === "grid-3" ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}
          >
            {activeListings.slice(0, Math.max(listingCount, 3)).map((item) => (
              <article key={item.id} className="group">
                <div
                  className="h-72 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${item.imageUrl || template.defaultHeroImage})`,
                    borderRadius: 18,
                  }}
                />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-0.5 text-xs" style={{ color: tc.muted }}>
                      {item.city}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(item.price, market)}</p>
                </div>
              </article>
            ))}
            {activeListings.length === 0 ? (
              <p className="text-sm" style={{ color: tc.muted }}>
                Add listings and they will appear here.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {showAgentBio ? (
        <section className="px-6 py-8 md:px-10">
          <div
            className="grid gap-10 rounded-[2rem] px-8 py-12 md:grid-cols-2 md:px-12"
            style={{ backgroundColor: tc.surface }}
          >
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-light" style={{ color: tc.muted }}>
                  /
                </span>
                <EditableText
                  as="h2"
                  enabled={editable}
                  value={hydrated.aboutHeading || ""}
                  onChange={(v) => patch("aboutHeading", v)}
                  placeholder="About"
                  className="text-3xl font-semibold tracking-tight"
                />
              </div>
            </div>
            <div className="space-y-6">
              <EditableText
                as="p"
                multiline
                enabled={editable}
                value={hydrated.aboutBio || ""}
                onChange={(v) => patch("aboutBio", v)}
                placeholder="Tell visitors about the agency…"
                className="text-sm leading-7"
                style={{ color: tc.muted }}
              />
              <span className="inline-flex items-center gap-1 text-sm font-medium">
                Learn more <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {showContactForm ? (
        <section className="px-6 py-16 md:px-10">
          <div className="mb-8 flex items-baseline gap-2">
            <span className="text-3xl font-light" style={{ color: tc.muted }}>
              /
            </span>
            <EditableText
              as="h2"
              enabled={editable}
              value={hydrated.contactHeading || ""}
              onChange={(v) => patch("contactHeading", v)}
              placeholder="Get in touch"
              className="text-3xl font-semibold tracking-tight"
            />
          </div>
          <div
            className="grid gap-3 rounded-[1.75rem] p-3 sm:grid-cols-[1fr_1fr_auto]"
            style={{ backgroundColor: isDark ? tc.surface : "#ececec" }}
          >
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: tc.surface, color: tc.muted }}
            >
              Your name
            </div>
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: tc.surface, color: tc.muted }}
            >
              Email / phone
            </div>
            <span className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium" style={pill}>
              {hydrated.primaryCta}
            </span>
          </div>
        </section>
      ) : null}

      <footer
        className="mt-8 grid gap-8 px-6 py-12 md:grid-cols-3 md:px-10"
        style={{
          color: isDark ? "#d6d3d1" : tc.muted,
          backgroundColor: isDark ? "#080807" : tc.surface,
          borderTop: `1px solid ${tc.border}`,
        }}
      >
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: tc.text }}>
            {orgName}
          </p>
          <EditableText
            enabled={editable}
            value={hydrated.footerNote || ""}
            onChange={(v) => patch("footerNote", v)}
            placeholder="Short footer line"
            className="text-sm"
          />
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em]">Get in touch</p>
          <EditableText
            enabled={editable}
            value={hydrated.email || ""}
            onChange={(v) => patch("email", v)}
            placeholder="Email"
          />
          <EditableText
            enabled={editable}
            value={hydrated.phone || ""}
            onChange={(v) => patch("phone", v)}
            placeholder="Phone"
          />
        </div>
        <div className="space-y-2 text-sm md:text-right">
          <p>Home</p>
          <p>Properties</p>
          <p>About</p>
          <p>Contact</p>
        </div>
      </footer>
    </div>
  );
}

export function WebsitePreview(props: {
  site: WebsiteSite;
  orgName: string;
  listings: Listing[];
  market: Market;
}) {
  return <WebsiteCanvas {...props} />;
}

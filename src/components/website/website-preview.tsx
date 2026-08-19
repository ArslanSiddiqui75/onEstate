"use client";

import { Building2, Send } from "lucide-react";
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

  return (
    <div
      className="min-h-full"
      style={{
        backgroundColor: tc.bg,
        color: tc.text,
        fontFamily: template.fonts.body,
      }}
    >
      <header
        className="flex items-center justify-between px-6 py-4 md:px-12"
        style={{ borderBottom: `1px solid ${tc.border}` }}
      >
        <p className="text-sm font-semibold tracking-tight" style={{ fontFamily: template.fonts.heading }}>
          {orgName}
        </p>
        <div className="hidden gap-6 text-xs md:flex" style={{ color: tc.muted }}>
          <span>Homes</span>
          <span>About</span>
          <span>Contact</span>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: tc.accent, color: tc.accentText }}
        >
          {hydrated.primaryCta}
        </span>
      </header>

      {showHero ? (
        template.heroLayout === "split" ? (
          <section className="grid md:grid-cols-2">
            <div
              className="flex min-h-[70vh] flex-col justify-center px-6 py-16 md:px-12"
              style={{ backgroundColor: tc.heroFrom, color: "#fff" }}
            >
              <p className="text-xs uppercase tracking-[0.22em] opacity-80">{orgName}</p>
              <EditableText
                as="h1"
                enabled={editable}
                value={hydrated.headline}
                onChange={(v) => patch("headline", v)}
                placeholder="Your headline"
                className="mt-4 max-w-xl text-4xl font-semibold leading-tight md:text-5xl"
                style={{ fontFamily: template.fonts.heading }}
              />
              <EditableText
                as="p"
                enabled={editable}
                value={hydrated.tagline}
                onChange={(v) => patch("tagline", v)}
                placeholder="Your tagline"
                className="mt-4 max-w-lg text-base opacity-90"
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <EditableText
                  enabled={editable}
                  value={hydrated.primaryCta}
                  onChange={(v) => patch("primaryCta", v)}
                  placeholder="Primary button"
                  className="inline-flex px-5 py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: "#fff",
                    color: tc.heroFrom,
                    borderRadius: "9999px",
                  }}
                />
                <EditableText
                  enabled={editable}
                  value={hydrated.secondaryCta || ""}
                  onChange={(v) => patch("secondaryCta", v)}
                  placeholder="Secondary button"
                  className="inline-flex px-5 py-2.5 text-sm opacity-90"
                />
              </div>
            </div>
            <EditableImage
              enabled={editable}
              uploading={uploadingHero}
              onPickFile={(file) => onHeroFile?.(file)}
              className="min-h-[320px] bg-cover bg-center md:min-h-[70vh]"
              style={{ backgroundImage: `url(${heroImage})` }}
            >
              <div className="h-full min-h-[320px] md:min-h-[70vh]" />
            </EditableImage>
          </section>
        ) : (
          <EditableImage
            enabled={editable}
            uploading={uploadingHero}
            onPickFile={(file) => onHeroFile?.(file)}
            className="relative min-h-[75vh] bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  template.heroLayout === "overlay"
                    ? "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.72) 100%)"
                    : "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 75%)",
              }}
            />
            <div
              className={`relative z-10 flex min-h-[75vh] flex-col justify-end px-6 py-16 text-white md:px-12 ${
                template.heroLayout === "left-aligned" ? "items-start text-left" : "items-center text-center"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.22em] opacity-80">{orgName}</p>
              <EditableText
                as="h1"
                enabled={editable}
                value={hydrated.headline}
                onChange={(v) => patch("headline", v)}
                placeholder="Your headline"
                className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl"
                style={{ fontFamily: template.fonts.heading }}
              />
              <EditableText
                as="p"
                enabled={editable}
                value={hydrated.tagline}
                onChange={(v) => patch("tagline", v)}
                placeholder="Your tagline"
                className="mt-4 max-w-xl text-base opacity-90 md:text-lg"
              />
              <EditableText
                enabled={editable}
                value={hydrated.primaryCta}
                onChange={(v) => patch("primaryCta", v)}
                placeholder="Primary button"
                className="mt-8 inline-flex px-6 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: tc.accent,
                  color: tc.accentText,
                  borderRadius: "9999px",
                }}
              />
            </div>
          </EditableImage>
        )
      ) : null}

      {showListings ? (
        <section className="px-6 py-16 md:px-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <EditableText
              as="h2"
              enabled={editable}
              value={hydrated.listingsHeading || ""}
              onChange={(v) => patch("listingsHeading", v)}
              placeholder="Featured properties"
              className="text-2xl font-semibold"
              style={{ fontFamily: template.fonts.heading }}
            />
            <span className="text-xs" style={{ color: tc.muted }}>
              {activeListings.length} live
            </span>
          </div>
          <div
            className={`grid gap-5 ${template.listingLayout === "grid-3" ? "md:grid-cols-3" : "md:grid-cols-2"}`}
          >
            {activeListings.slice(0, listingCount).map((item) => (
              <article
                key={item.id}
                className="overflow-hidden"
                style={{
                  backgroundColor: tc.surface,
                  border: `1px solid ${tc.border}`,
                  borderRadius: 16,
                }}
              >
                <div
                  className="h-52 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${item.imageUrl || template.defaultHeroImage})`,
                  }}
                />
                <div className="space-y-1 p-4">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-xs" style={{ color: tc.muted }}>
                    {item.city}
                  </p>
                  <p className="text-lg font-semibold" style={{ color: tc.accent }}>
                    {formatMoney(item.price, market)}
                  </p>
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
        <section className="px-6 py-8 md:px-12">
          <div
            className="mx-auto max-w-3xl space-y-3 p-8"
            style={{
              backgroundColor: tc.surface,
              border: `1px solid ${tc.border}`,
              borderRadius: 20,
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4" />
              <EditableText
                enabled={editable}
                value={hydrated.aboutHeading || ""}
                onChange={(v) => patch("aboutHeading", v)}
                placeholder="About"
              />
            </div>
            <EditableText
              as="p"
              multiline
              enabled={editable}
              value={hydrated.aboutBio || ""}
              onChange={(v) => patch("aboutBio", v)}
              placeholder="Tell visitors about the agency…"
              className="text-sm leading-relaxed"
              style={{ color: tc.muted }}
            />
          </div>
        </section>
      ) : null}

      {showContactForm ? (
        <section className="px-6 py-12 md:px-12">
          <div
            className="mx-auto max-w-xl space-y-4 p-8"
            style={{
              backgroundColor: tc.surface,
              border: `1px solid ${tc.border}`,
              borderRadius: 20,
            }}
          >
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Send className="h-4 w-4" style={{ color: tc.accent }} />
              <EditableText
                enabled={editable}
                value={hydrated.contactHeading || ""}
                onChange={(v) => patch("contactHeading", v)}
                placeholder="Get in touch"
              />
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-xl p-3 text-sm"
                style={{ border: `1px solid ${tc.border}`, color: tc.muted }}
              >
                Your name
              </div>
              <div
                className="rounded-xl p-3 text-sm"
                style={{ border: `1px solid ${tc.border}`, color: tc.muted }}
              >
                Email / phone
              </div>
            </div>
            <div
              className="h-24 rounded-xl p-3 text-sm"
              style={{ border: `1px solid ${tc.border}`, color: tc.muted }}
            >
              How can we help?
            </div>
          </div>
        </section>
      ) : null}

      <footer
        className="flex flex-wrap items-center justify-center gap-2 px-6 py-10 text-xs md:px-12"
        style={{ color: tc.muted, borderTop: `1px solid ${tc.border}` }}
      >
        <EditableText
          enabled={editable}
          value={hydrated.phone || ""}
          onChange={(v) => patch("phone", v)}
          placeholder="Phone"
        />
        <span>·</span>
        <EditableText
          enabled={editable}
          value={hydrated.email || ""}
          onChange={(v) => patch("email", v)}
          placeholder="Email"
        />
        <span>·</span>
        <EditableText
          enabled={editable}
          value={hydrated.footerNote || ""}
          onChange={(v) => patch("footerNote", v)}
          placeholder="Footer note"
        />
      </footer>
    </div>
  );
}

/** @deprecated Use WebsiteCanvas — kept so old imports don't break mid-refactor */
export function WebsitePreview(props: {
  site: WebsiteSite;
  orgName: string;
  listings: Listing[];
  market: Market;
}) {
  return <WebsiteCanvas {...props} />;
}

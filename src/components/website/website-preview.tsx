"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getTemplate } from "@/lib/website/templates";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import { resolveSections, sectionVariant } from "@/lib/website/sections";
import { EditableImage, EditableText } from "@/components/website/editable-field";
import type {
  Listing,
  Market,
  WebsiteQuote,
  WebsiteSectionConfig,
  WebsiteSite,
  WebsiteStat,
} from "@/types";

export function WebsiteCanvas({
  site,
  orgName,
  listings,
  market,
  editable,
  uploadingHero,
  onChange,
  onHeroFile,
  contactForm,
}: {
  site: WebsiteSite;
  orgName: string;
  listings: Listing[];
  market: Market;
  editable?: boolean;
  uploadingHero?: boolean;
  onChange?: (patch: Partial<WebsiteSite>) => void;
  onHeroFile?: (file: File) => void;
  /** Live capture form for the public render; the editor shows placeholders. */
  contactForm?: ReactNode;
}) {
  const hydrated = hydrateWebsiteSite(site, orgName);
  const template = getTemplate(hydrated.templateId);
  const tc = template.colors;
  const heroImage = hydrated.heroImageUrl || template.defaultHeroImage;
  const sections = resolveSections(hydrated);
  const visible = sections.filter((s) => s.visible);
  const heroSection = sections.find((s) => s.kind === "hero");
  const heroOn = heroSection?.visible !== false;
  const heroLayout = heroSection ? sectionVariant(heroSection, template) : template.heroLayout;
  const isSplitHero = heroOn && heroLayout === "split";
  const isDark = template.id === "luxury-dark";
  const activeListings = listings.filter((l) => l.market === market);
  const patch = (next: Partial<WebsiteSite>) => onChange?.(next);

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

  const renderSection = (section: WebsiteSectionConfig) => {
    const variant = sectionVariant(section, template);
    switch (section.kind) {
      case "hero":
        return isSplitHero ? (
          <section key="hero" id="section-hero">
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
            <div className="grid items-stretch gap-5 px-5 pb-8 md:grid-cols-[1.1fr_0.9fr] md:px-8">
              <div
                className="flex min-h-[62vh] flex-col justify-between rounded-[2rem] px-8 py-10 md:px-12"
                style={{ backgroundColor: tc.surface, color: tc.text }}
              >
                <EditableText
                  as="p"
                  enabled={editable}
                  value={hydrated.tagline}
                  onChange={(v) => patch({ tagline: v })}
                  placeholder="Short line above the headline"
                  className="text-center text-xs tracking-wide"
                  style={{ color: tc.muted }}
                />
                <EditableText
                  as="h1"
                  enabled={editable}
                  value={hydrated.headline}
                  onChange={(v) => patch({ headline: v })}
                  placeholder="Your headline"
                  className="text-center text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl"
                />
                <div className="flex items-center justify-between gap-4">
                  <EditableText
                    enabled={editable}
                    value={hydrated.primaryCta}
                    onChange={(v) => patch({ primaryCta: v })}
                    placeholder="Primary button"
                    className="inline-flex px-5 py-2.5 text-sm font-medium"
                    style={pill}
                  />
                  <EditableText
                    enabled={editable}
                    value={hydrated.secondaryCta || ""}
                    onChange={(v) => patch({ secondaryCta: v })}
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
            </div>
          </section>
        ) : (
          <section key="hero" id="section-hero" className="relative">
            <EditableImage
              enabled={editable}
              uploading={uploadingHero}
              onPickFile={(file) => onHeroFile?.(file)}
              className={`relative overflow-hidden bg-cover bg-center ${
                variant === "overlay"
                  ? "mx-0 min-h-[86vh] rounded-b-[2.5rem]"
                  : "mx-4 mt-4 min-h-[78vh] rounded-[2.5rem] md:mx-6"
              }`}
              style={{ backgroundImage: `url(${heroImage})` }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    variant === "left-aligned"
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
                  variant === "left-aligned"
                    ? "items-start justify-end text-left"
                    : "items-start justify-end md:max-w-3xl"
                }`}
              >
                <EditableText
                  as="h1"
                  enabled={editable}
                  value={hydrated.headline}
                  onChange={(v) => patch({ headline: v })}
                  placeholder="Your headline"
                  className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
                />
                <EditableText
                  as="p"
                  enabled={editable}
                  value={hydrated.tagline}
                  onChange={(v) => patch({ tagline: v })}
                  placeholder="Your tagline"
                  className="mt-5 max-w-md text-sm leading-relaxed text-white/80 md:text-base"
                />
                <div className="mt-8 flex flex-wrap gap-3">
                  <EditableText
                    enabled={editable}
                    value={hydrated.primaryCta}
                    onChange={(v) => patch({ primaryCta: v })}
                    placeholder="Primary button"
                    className="inline-flex px-6 py-2.5 text-sm font-medium"
                    style={{ backgroundColor: "#fff", color: "#111", borderRadius: 9999 }}
                  />
                  <EditableText
                    enabled={editable}
                    value={hydrated.secondaryCta || ""}
                    onChange={(v) => patch({ secondaryCta: v })}
                    placeholder="Secondary"
                    className="inline-flex items-center px-5 py-2.5 text-sm text-white/90"
                  />
                </div>
              </div>
            </EditableImage>
          </section>
        );

      case "listings":
        return (
          <ListingsBlock
            key="listings"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            activeListings={activeListings}
            market={market}
            templateImage={template.defaultHeroImage}
            tc={tc}
            patch={patch}
          />
        );

      case "about":
        return (
          <AboutBlock
            key="about"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            tc={tc}
            patch={patch}
          />
        );

      case "testimonials":
        return (
          <TestimonialsBlock
            key="testimonials"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            tc={tc}
            patch={patch}
          />
        );

      case "stats":
        return (
          <StatsBlock
            key="stats"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            tc={tc}
            patch={patch}
          />
        );

      case "cta":
        return (
          <CtaBlock
            key="cta"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            tc={tc}
            pill={pill}
            patch={patch}
          />
        );

      case "contact":
        return (
          <ContactBlock
            key="contact"
            variant={variant}
            hydrated={hydrated}
            editable={editable}
            tc={tc}
            isDark={isDark}
            pill={pill}
            contactForm={contactForm}
            patch={patch}
          />
        );

      default:
        return null;
    }
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
      {!heroOn ? (
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">{orgName}</p>
        </header>
      ) : null}

      {visible.map(renderSection)}

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
            onChange={(v) => patch({ footerNote: v })}
            placeholder="Short footer line"
            className="text-sm"
          />
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em]">Get in touch</p>
          <EditableText
            enabled={editable}
            value={hydrated.email || ""}
            onChange={(v) => patch({ email: v })}
            placeholder="Email"
          />
          <EditableText
            enabled={editable}
            value={hydrated.phone || ""}
            onChange={(v) => patch({ phone: v })}
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

function SlashHeading({
  value,
  placeholder,
  muted,
  editable,
  onChange,
}: {
  value: string;
  placeholder: string;
  muted: string;
  editable?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-light" style={{ color: muted }}>
        /
      </span>
      <EditableText
        as="h2"
        enabled={editable}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="text-3xl font-semibold tracking-tight md:text-4xl"
      />
    </div>
  );
}

function ListingsBlock({
  variant,
  hydrated,
  editable,
  activeListings,
  market,
  templateImage,
  tc,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  activeListings: Listing[];
  market: Market;
  templateImage: string;
  tc: { muted: string; surface: string; border: string };
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const cols =
    variant === "grid-3"
      ? "md:grid-cols-3"
      : variant === "cards"
        ? "md:grid-cols-2 lg:grid-cols-3"
        : "md:grid-cols-2 lg:grid-cols-3";
  const isCards = variant === "cards";

  return (
    <section id="section-listings" className="px-6 py-20 md:px-10">
      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <SlashHeading
          value={hydrated.listingsHeading || ""}
          placeholder="Featured properties"
          muted={tc.muted}
          editable={editable}
          onChange={(v) => patch({ listingsHeading: v })}
        />
        <p className="max-w-sm text-sm leading-relaxed" style={{ color: tc.muted }}>
          {activeListings.length} live {activeListings.length === 1 ? "home" : "homes"} from your listings.
        </p>
      </div>
      <div className={`grid gap-6 ${cols}`}>
        {activeListings.slice(0, 6).map((item) => (
          <article
            key={item.id}
            className="group"
            style={
              isCards
                ? {
                    backgroundColor: tc.surface,
                    border: `1px solid ${tc.border}`,
                    borderRadius: 22,
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            <div
              className={`w-full bg-cover bg-center ${isCards ? "h-56" : "h-72"}`}
              style={{
                backgroundImage: `url(${item.imageUrl || templateImage})`,
                borderRadius: isCards ? 0 : 18,
              }}
            />
            <div className={`flex items-start justify-between gap-3 ${isCards ? "p-4" : "mt-3"}`}>
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
  );
}

function AboutBlock({
  variant,
  hydrated,
  editable,
  tc,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  tc: { muted: string; surface: string };
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const stacked = variant === "stacked";
  return (
    <section id="section-about" className="px-6 py-8 md:px-10">
      <div
        className={`grid gap-10 rounded-[2rem] px-8 py-12 md:px-12 ${stacked ? "" : "md:grid-cols-2"}`}
        style={{ backgroundColor: tc.surface }}
      >
        <div>
          <SlashHeading
            value={hydrated.aboutHeading || ""}
            placeholder="About"
            muted={tc.muted}
            editable={editable}
            onChange={(v) => patch({ aboutHeading: v })}
          />
        </div>
        <div className="space-y-6">
          <EditableText
            as="p"
            multiline
            enabled={editable}
            value={hydrated.aboutBio || ""}
            onChange={(v) => patch({ aboutBio: v })}
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
  );
}

function TestimonialsBlock({
  variant,
  hydrated,
  editable,
  tc,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  tc: { muted: string; surface: string; border: string };
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const quotes = hydrated.testimonials || [];
  const updateQuote = (index: number, next: Partial<WebsiteQuote>) => {
    const list = quotes.map((q, i) => (i === index ? { ...q, ...next } : q));
    patch({ testimonials: list });
  };
  const featured = variant === "featured";
  const shown = featured ? quotes.slice(0, 1) : quotes;

  return (
    <section id="section-testimonials" className="px-6 py-16 md:px-10">
      <div className="mb-10">
        <SlashHeading
          value={hydrated.testimonialsHeading || ""}
          placeholder="What clients say"
          muted={tc.muted}
          editable={editable}
          onChange={(v) => patch({ testimonialsHeading: v })}
        />
      </div>
      <div className={featured ? "max-w-3xl" : "grid gap-5 md:grid-cols-2"}>
        {shown.map((item, index) => (
          <blockquote
            key={`${item.name}-${index}`}
            className="rounded-[1.75rem] px-7 py-8"
            style={{
              backgroundColor: tc.surface,
              border: `1px solid ${tc.border}`,
            }}
          >
            <EditableText
              as="p"
              multiline
              enabled={editable}
              value={item.quote}
              onChange={(v) => updateQuote(index, { quote: v })}
              placeholder="Client quote"
              className={featured ? "text-xl font-medium leading-relaxed" : "text-sm leading-7"}
            />
            <div className="mt-5">
              <EditableText
                enabled={editable}
                value={item.name}
                onChange={(v) => updateQuote(index, { name: v })}
                placeholder="Name"
                className="text-sm font-semibold"
              />
              <EditableText
                enabled={editable}
                value={item.role || ""}
                onChange={(v) => updateQuote(index, { role: v })}
                placeholder="Role"
                className="mt-0.5 block text-xs"
                style={{ color: tc.muted }}
              />
            </div>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function StatsBlock({
  variant,
  hydrated,
  editable,
  tc,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  tc: { muted: string; surface: string; border: string; text: string };
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const stats = hydrated.stats || [];
  const updateStat = (index: number, next: Partial<WebsiteStat>) => {
    const list = stats.map((s, i) => (i === index ? { ...s, ...next } : s));
    patch({ stats: list });
  };
  const asCards = variant === "cards";

  return (
    <section id="section-stats" className="px-6 py-14 md:px-10">
      <div className="mb-8">
        <SlashHeading
          value={hydrated.statsHeading || ""}
          placeholder="By the numbers"
          muted={tc.muted}
          editable={editable}
          onChange={(v) => patch({ statsHeading: v })}
        />
      </div>
      <div className={`grid gap-4 sm:grid-cols-3 ${asCards ? "" : ""}`}>
        {stats.map((item, index) => (
          <div
            key={index}
            className={asCards ? "rounded-[1.5rem] px-6 py-8 text-center" : "py-2"}
            style={
              asCards
                ? { backgroundColor: tc.surface, border: `1px solid ${tc.border}` }
                : { borderTop: `1px solid ${tc.border}` }
            }
          >
            <EditableText
              as="p"
              enabled={editable}
              value={item.value}
              onChange={(v) => updateStat(index, { value: v })}
              placeholder="120+"
              className="text-3xl font-semibold tracking-tight"
              style={{ color: tc.text }}
            />
            <EditableText
              enabled={editable}
              value={item.label}
              onChange={(v) => updateStat(index, { label: v })}
              placeholder="Label"
              className="mt-1 block text-sm"
              style={{ color: tc.muted }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBlock({
  variant,
  hydrated,
  editable,
  tc,
  pill,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  tc: { muted: string; surface: string; accent: string; accentText: string };
  pill: { backgroundColor: string; color: string; borderRadius: number };
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const centered = variant === "centered";
  return (
    <section id="section-cta" className="px-6 py-10 md:px-10">
      <div
        className={`rounded-[2rem] px-8 py-12 md:px-14 ${centered ? "text-center" : "flex flex-col justify-between gap-6 md:flex-row md:items-center"}`}
        style={{ backgroundColor: tc.surface }}
      >
        <div className={centered ? "mx-auto max-w-xl" : "max-w-xl"}>
          <EditableText
            as="h2"
            enabled={editable}
            value={hydrated.ctaHeading || ""}
            onChange={(v) => patch({ ctaHeading: v })}
            placeholder="Work with us"
            className="text-3xl font-semibold tracking-tight"
          />
          <EditableText
            as="p"
            multiline
            enabled={editable}
            value={hydrated.ctaBody || ""}
            onChange={(v) => patch({ ctaBody: v })}
            placeholder="Short invitation"
            className="mt-3 text-sm leading-6"
            style={{ color: tc.muted }}
          />
        </div>
        <EditableText
          enabled={editable}
          value={hydrated.primaryCta}
          onChange={(v) => patch({ primaryCta: v })}
          placeholder="Primary button"
          className={`inline-flex px-6 py-2.5 text-sm font-medium ${centered ? "mt-6" : "shrink-0"}`}
          style={pill}
        />
      </div>
    </section>
  );
}

function ContactBlock({
  variant,
  hydrated,
  editable,
  tc,
  isDark,
  pill,
  contactForm,
  patch,
}: {
  variant: string;
  hydrated: WebsiteSite;
  editable?: boolean;
  tc: { muted: string; surface: string };
  isDark: boolean;
  pill: { backgroundColor: string; color: string; borderRadius: number };
  contactForm?: ReactNode;
  patch: (next: Partial<WebsiteSite>) => void;
}) {
  const stacked = variant === "stacked";
  return (
    <section id="section-contact" className="px-6 py-16 md:px-10">
      <div className={`mb-8 ${stacked ? "max-w-xl" : ""}`}>
        <SlashHeading
          value={hydrated.contactHeading || ""}
          placeholder="Get in touch"
          muted={tc.muted}
          editable={editable}
          onChange={(v) => patch({ contactHeading: v })}
        />
      </div>
      {contactForm ?? (
        <div
          className={
            stacked
              ? "grid max-w-xl gap-3 rounded-[1.75rem] p-4"
              : "grid gap-3 rounded-[1.75rem] p-3 sm:grid-cols-[1fr_1fr_auto]"
          }
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
          {stacked ? (
            <div
              className="min-h-24 rounded-2xl px-4 py-3 text-sm"
              style={{ backgroundColor: tc.surface, color: tc.muted }}
            >
              What are you looking for?
            </div>
          ) : null}
          <span
            className={`inline-flex items-center justify-center px-6 py-3 text-sm font-medium ${stacked ? "w-full sm:w-auto" : ""}`}
            style={pill}
          >
            {hydrated.primaryCta}
          </span>
        </div>
      )}
    </section>
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

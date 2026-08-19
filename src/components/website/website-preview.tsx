"use client";

import { Building2, Send } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getTemplate } from "@/lib/website/templates";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import type { Listing, Market, WebsiteSite } from "@/types";

export function WebsitePreview({
  site,
  orgName,
  listings,
  market,
}: {
  site: WebsiteSite;
  orgName: string;
  listings: Listing[];
  market: Market;
}) {
  const hydrated = hydrateWebsiteSite(site, orgName);
  const template = getTemplate(hydrated.templateId);
  const tc = template.colors;
  const radius =
    template.radius === "sharp" ? "8px" : template.radius === "pill" ? "24px" : "16px";
  const heroImage = hydrated.heroImageUrl || template.defaultHeroImage;
  const showHero = hydrated.showHero ?? true;
  const showListings = hydrated.showListings ?? true;
  const showAgentBio = hydrated.showAgentBio ?? true;
  const showContactForm = hydrated.showContactForm ?? true;
  const activeListings = listings.filter((l) => l.market === market);
  const listingCount = template.listingLayout === "grid-3" ? 3 : 2;

  return (
    <div className="space-y-8 text-left" style={{ fontFamily: template.fonts.body }}>
      {showHero ? (
        template.heroLayout === "split" ? (
          <div
            className="grid overflow-hidden sm:grid-cols-2"
            style={{ borderRadius: radius, border: `1px solid ${tc.border}` }}
          >
            <div
              className="flex min-h-[220px] flex-col justify-center p-6"
              style={{ backgroundColor: tc.heroFrom, color: "#fff" }}
            >
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">{orgName}</p>
              <h1
                className="mt-2 text-2xl font-semibold leading-tight"
                style={{ fontFamily: template.fonts.heading }}
              >
                {hydrated.headline}
              </h1>
              <p className="mt-2 text-sm opacity-85">{hydrated.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className="inline-flex px-4 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: "#fff",
                    color: tc.heroFrom,
                    borderRadius: template.radius === "pill" ? "9999px" : "10px",
                  }}
                >
                  {hydrated.primaryCta}
                </span>
                {hydrated.secondaryCta ? (
                  <span className="inline-flex px-4 py-2 text-xs opacity-90">{hydrated.secondaryCta}</span>
                ) : null}
              </div>
            </div>
            <div
              className="min-h-[220px] bg-cover bg-center"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
          </div>
        ) : (
          <div
            className="relative min-h-[260px] overflow-hidden bg-cover bg-center"
            style={{
              backgroundImage: `url(${heroImage})`,
              borderRadius: radius,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  template.heroLayout === "overlay"
                    ? "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%)"
                    : "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.2) 70%)",
              }}
            />
            <div
              className={`relative z-10 flex min-h-[260px] flex-col justify-end p-6 text-white ${
                template.heroLayout === "left-aligned" ? "items-start text-left" : "items-center text-center"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">{orgName}</p>
              <h1
                className="mt-2 max-w-lg text-2xl font-semibold leading-tight"
                style={{ fontFamily: template.fonts.heading }}
              >
                {hydrated.headline}
              </h1>
              <p className="mt-2 max-w-md text-sm opacity-90">{hydrated.tagline}</p>
              <span
                className="mt-4 inline-flex px-4 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: tc.accent,
                  color: tc.accentText,
                  borderRadius: template.radius === "pill" ? "9999px" : "10px",
                }}
              >
                {hydrated.primaryCta}
              </span>
            </div>
          </div>
        )
      ) : null}

      {showListings ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold"
              style={{ color: tc.text, fontFamily: template.fonts.heading }}
            >
              {hydrated.listingsHeading}
            </h3>
            <span className="text-[11px]" style={{ color: tc.muted }}>
              {activeListings.length} live
            </span>
          </div>
          <div
            className={`grid gap-3 ${template.listingLayout === "grid-3" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
          >
            {activeListings.slice(0, listingCount).map((item) => (
              <div
                key={item.id}
                className="overflow-hidden"
                style={{
                  backgroundColor: tc.surface,
                  border: `1px solid ${tc.border}`,
                  borderRadius: radius,
                }}
              >
                <div
                  className="h-28 w-full bg-cover bg-center"
                  style={{
                    backgroundImage: item.imageUrl
                      ? `url(${item.imageUrl})`
                      : `url(${template.defaultHeroImage})`,
                  }}
                />
                <div className="space-y-1 p-3">
                  <h4 className="truncate text-xs font-semibold" style={{ color: tc.text }}>
                    {item.title}
                  </h4>
                  <p className="text-[11px]" style={{ color: tc.muted }}>
                    {item.city}
                  </p>
                  <p className="text-sm font-bold" style={{ color: tc.accent }}>
                    {formatMoney(item.price, market)}
                  </p>
                </div>
              </div>
            ))}
            {activeListings.length === 0 ? (
              <p className="col-span-full text-xs" style={{ color: tc.muted }}>
                Add listings to show them on your site.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAgentBio ? (
        <div
          className="space-y-2 p-4"
          style={{
            backgroundColor: tc.surface,
            border: `1px solid ${tc.border}`,
            borderRadius: radius,
          }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: tc.text }}>
            <Building2 className="h-3.5 w-3.5" />
            {hydrated.aboutHeading}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: tc.muted }}>
            {hydrated.aboutBio}
          </p>
        </div>
      ) : null}

      {showContactForm ? (
        <div
          className="space-y-3 p-4"
          style={{
            backgroundColor: tc.surface,
            border: `1px solid ${tc.border}`,
            borderRadius: radius,
          }}
        >
          <h4 className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: tc.text }}>
            <Send className="h-3.5 w-3.5" style={{ color: tc.accent }} />
            {hydrated.contactHeading}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className="p-2"
              style={{ backgroundColor: `${tc.text}08`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}
            >
              Your name
            </div>
            <div
              className="p-2"
              style={{ backgroundColor: `${tc.text}08`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}
            >
              Email / phone
            </div>
          </div>
          <div
            className="h-14 p-2 text-xs"
            style={{ backgroundColor: `${tc.text}08`, border: `1px solid ${tc.border}`, borderRadius: "8px", color: tc.muted }}
          >
            How can we help?
          </div>
        </div>
      ) : null}

      <div className="text-center text-[11px]" style={{ color: tc.muted }}>
        {[hydrated.phone, hydrated.email, hydrated.footerNote].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

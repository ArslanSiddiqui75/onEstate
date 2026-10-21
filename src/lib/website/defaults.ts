import type { WebsiteSite } from "@/types";
import { getTemplate, resolveTemplateId } from "@/lib/website/templates";
import {
  CORE_SECTION_ORDER,
  defaultQuotes,
  defaultStats,
  flagsFromSections,
  resolveSections,
} from "@/lib/website/sections";

export function defaultWebsiteSite(
  orgId: string,
  orgName: string,
  email: string,
): WebsiteSite {
  const template = getTemplate("modern-minimal");
  return {
    id: orgId,
    orgId,
    headline: orgName,
    tagline: "Find your next home with a team that actually follows through.",
    primaryCta: "Book a valuation",
    secondaryCta: "View listings",
    phone: "",
    email,
    published: false,
    updatedAt: new Date().toISOString(),
    templateId: "modern-minimal",
    heroImageUrl: template.defaultHeroImage,
    aboutHeading: `About ${orgName}`,
    aboutBio:
      "Premier real estate brokerage delivering tailored properties, market intelligence, and seamless closing experiences.",
    listingsHeading: "Featured properties",
    contactHeading: "Get in touch",
    footerNote: "",
    showHero: true,
    showListings: true,
    showClientPortal: true,
    showContactForm: true,
    showAgentBio: true,
    sections: CORE_SECTION_ORDER.map((kind) => ({ kind, visible: true })),
    testimonialsHeading: "What clients say",
    testimonials: defaultQuotes(),
    statsHeading: "By the numbers",
    stats: defaultStats(),
    ctaHeading: `Work with ${orgName}`,
    ctaBody: "Tell us what you’re looking for — we’ll take it from there.",
  };
}

export function hydrateWebsiteSite(
  site: WebsiteSite,
  orgName: string,
): WebsiteSite {
  const template = getTemplate(site.templateId);
  const sections = resolveSections(site);
  return {
    ...site,
    templateId: resolveTemplateId(site.templateId),
    heroImageUrl: site.heroImageUrl || template.defaultHeroImage,
    aboutHeading: site.aboutHeading || `About ${orgName}`,
    listingsHeading: site.listingsHeading || "Featured properties",
    contactHeading: site.contactHeading || "Get in touch",
    secondaryCta: site.secondaryCta || "View listings",
    footerNote: site.footerNote || "",
    sections,
    ...flagsFromSections(sections),
    testimonialsHeading: site.testimonialsHeading || "What clients say",
    testimonials: site.testimonials?.length ? site.testimonials : defaultQuotes(),
    statsHeading: site.statsHeading || "By the numbers",
    stats: site.stats?.length ? site.stats : defaultStats(),
    ctaHeading: site.ctaHeading || `Work with ${orgName}`,
    ctaBody:
      site.ctaBody || "Tell us what you’re looking for — we’ll take it from there.",
  };
}

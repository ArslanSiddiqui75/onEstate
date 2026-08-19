import type { WebsiteSite } from "@/types";
import { getTemplate, resolveTemplateId } from "@/lib/website/templates";

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
  };
}

export function hydrateWebsiteSite(
  site: WebsiteSite,
  orgName: string,
): WebsiteSite {
  const template = getTemplate(site.templateId);
  return {
    ...site,
    templateId: resolveTemplateId(site.templateId),
    heroImageUrl: site.heroImageUrl || template.defaultHeroImage,
    aboutHeading: site.aboutHeading || `About ${orgName}`,
    listingsHeading: site.listingsHeading || "Featured properties",
    contactHeading: site.contactHeading || "Get in touch",
    secondaryCta: site.secondaryCta || "View listings",
    footerNote: site.footerNote || "",
  };
}

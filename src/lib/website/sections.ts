import type {
  WebsiteQuote,
  WebsiteSectionConfig,
  WebsiteSectionKind,
  WebsiteSite,
  WebsiteStat,
} from "@/types";
import type { WebsiteTemplate } from "@/lib/website/templates";

export interface SectionVariant {
  id: string;
  label: string;
}

export interface SectionDefinition {
  kind: WebsiteSectionKind;
  label: string;
  description: string;
  /** Core blocks start on every site. Optional ones are added from the palette. */
  core: boolean;
  variants: SectionVariant[];
  defaultVariant: string;
}

export const SECTION_CATALOG: Record<WebsiteSectionKind, SectionDefinition> = {
  hero: {
    kind: "hero",
    label: "Hero",
    description: "Headline, photo, and primary call to action",
    core: true,
    defaultVariant: "overlay",
    variants: [
      { id: "overlay", label: "Full-bleed overlay" },
      { id: "left-aligned", label: "Left-aligned" },
      { id: "split", label: "Split" },
    ],
  },
  listings: {
    kind: "listings",
    label: "Listings",
    description: "Live properties from your workspace",
    core: true,
    defaultVariant: "grid-2",
    variants: [
      { id: "grid-2", label: "Two columns" },
      { id: "grid-3", label: "Three columns" },
      { id: "cards", label: "Cards" },
    ],
  },
  about: {
    kind: "about",
    label: "About",
    description: "Agency story and bio",
    core: true,
    defaultVariant: "split",
    variants: [
      { id: "split", label: "Split" },
      { id: "stacked", label: "Stacked" },
    ],
  },
  testimonials: {
    kind: "testimonials",
    label: "Testimonials",
    description: "Client quotes",
    core: false,
    defaultVariant: "quotes",
    variants: [
      { id: "quotes", label: "Quote cards" },
      { id: "featured", label: "Featured quote" },
    ],
  },
  stats: {
    kind: "stats",
    label: "Stats",
    description: "Proof numbers — sales, years, ratings",
    core: false,
    defaultVariant: "row",
    variants: [
      { id: "row", label: "Inline row" },
      { id: "cards", label: "Cards" },
    ],
  },
  cta: {
    kind: "cta",
    label: "Call to action",
    description: "Mid-page banner that drives enquiry",
    core: false,
    defaultVariant: "banner",
    variants: [
      { id: "banner", label: "Full-width banner" },
      { id: "centered", label: "Centered" },
    ],
  },
  contact: {
    kind: "contact",
    label: "Contact",
    description: "Enquiry form",
    core: true,
    defaultVariant: "compact",
    variants: [
      { id: "compact", label: "Compact bar" },
      { id: "stacked", label: "Stacked form" },
    ],
  },
};

export const CORE_SECTION_ORDER: WebsiteSectionKind[] = [
  "hero",
  "listings",
  "about",
  "contact",
];

export const OPTIONAL_SECTION_KINDS: WebsiteSectionKind[] = [
  "testimonials",
  "stats",
  "cta",
];

export function defaultQuotes(): WebsiteQuote[] {
  return [
    {
      quote: "They found us the right home in two weeks and handled every viewing.",
      name: "Sarah & James",
      role: "Buyers",
    },
    {
      quote: "Clear communication and a sale price above asking. We’d use them again.",
      name: "Priya Patel",
      role: "Seller",
    },
  ];
}

export function defaultStats(): WebsiteStat[] {
  return [
    { value: "120+", label: "Homes sold" },
    { value: "4.9", label: "Client rating" },
    { value: "12 yrs", label: "In the market" },
  ];
}

function fromLegacyFlags(site: WebsiteSite): WebsiteSectionConfig[] {
  return [
    { kind: "hero", visible: site.showHero ?? true },
    { kind: "listings", visible: site.showListings ?? true },
    { kind: "about", visible: site.showAgentBio ?? true },
    { kind: "contact", visible: site.showContactForm ?? true },
  ];
}

function dedupeSections(list: WebsiteSectionConfig[]): WebsiteSectionConfig[] {
  const seen = new Set<WebsiteSectionKind>();
  const out: WebsiteSectionConfig[] = [];
  for (const item of list) {
    if (!SECTION_CATALOG[item.kind] || seen.has(item.kind)) continue;
    seen.add(item.kind);
    out.push({
      kind: item.kind,
      visible: item.visible !== false,
      variant: item.variant || undefined,
    });
  }
  return out;
}

/** Resolve the page layout, filling core blocks for older payloads. */
export function resolveSections(site: WebsiteSite): WebsiteSectionConfig[] {
  const existing = site.sections?.length ? dedupeSections(site.sections) : fromLegacyFlags(site);
  const have = new Set(existing.map((s) => s.kind));
  for (const kind of CORE_SECTION_ORDER) {
    if (!have.has(kind)) {
      existing.push({ kind, visible: true });
    }
  }
  return existing;
}

export function sectionVariant(
  section: WebsiteSectionConfig,
  template: WebsiteTemplate,
): string {
  if (section.variant) return section.variant;
  if (section.kind === "hero") return template.heroLayout;
  if (section.kind === "listings") return template.listingLayout === "masonry" ? "cards" : template.listingLayout;
  return SECTION_CATALOG[section.kind].defaultVariant;
}

export function flagsFromSections(sections: WebsiteSectionConfig[]): Pick<
  WebsiteSite,
  "showHero" | "showListings" | "showAgentBio" | "showContactForm"
> {
  const vis = (kind: WebsiteSectionKind) =>
    sections.find((s) => s.kind === kind)?.visible !== false;
  return {
    showHero: vis("hero"),
    showListings: vis("listings"),
    showAgentBio: vis("about"),
    showContactForm: vis("contact"),
  };
}

export function moveSection(
  sections: WebsiteSectionConfig[],
  kind: WebsiteSectionKind,
  direction: -1 | 1,
): WebsiteSectionConfig[] {
  const next = [...sections];
  const index = next.findIndex((s) => s.kind === kind);
  if (index < 0) return next;
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function setSectionVisible(
  sections: WebsiteSectionConfig[],
  kind: WebsiteSectionKind,
  visible: boolean,
): WebsiteSectionConfig[] {
  return sections.map((s) => (s.kind === kind ? { ...s, visible } : s));
}

export function setSectionVariant(
  sections: WebsiteSectionConfig[],
  kind: WebsiteSectionKind,
  variant: string,
): WebsiteSectionConfig[] {
  return sections.map((s) => (s.kind === kind ? { ...s, variant } : s));
}

export function addSection(
  sections: WebsiteSectionConfig[],
  kind: WebsiteSectionKind,
): WebsiteSectionConfig[] {
  if (sections.some((s) => s.kind === kind)) {
    return setSectionVisible(sections, kind, true);
  }
  // Insert optional blocks just above contact so the form stays last.
  const contactAt = sections.findIndex((s) => s.kind === "contact");
  const insertAt = contactAt >= 0 ? contactAt : sections.length;
  const next = [...sections];
  next.splice(insertAt, 0, {
    kind,
    visible: true,
    variant: SECTION_CATALOG[kind].defaultVariant,
  });
  return next;
}

export function removeSection(
  sections: WebsiteSectionConfig[],
  kind: WebsiteSectionKind,
): WebsiteSectionConfig[] {
  if (SECTION_CATALOG[kind].core) {
    return setSectionVisible(sections, kind, false);
  }
  return sections.filter((s) => s.kind !== kind);
}

export function unusedOptionalKinds(
  sections: WebsiteSectionConfig[],
): WebsiteSectionKind[] {
  const have = new Set(sections.map((s) => s.kind));
  return OPTIONAL_SECTION_KINDS.filter((kind) => !have.has(kind));
}

export function applySectionLayout(
  sections: WebsiteSectionConfig[],
): Partial<WebsiteSite> {
  return { sections, ...flagsFromSections(sections) };
}

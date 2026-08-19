import type { WebsiteTemplateId } from "@/types";

export interface WebsiteTemplate {
  id: WebsiteTemplateId;
  name: string;
  description: string;
  tagline: string;
  featured: boolean;
  defaultHeroImage: string;
  colors: {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
    heroFrom: string;
    heroTo: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  heroLayout: "centered" | "left-aligned" | "split" | "overlay";
  listingLayout: "grid-2" | "grid-3" | "cards" | "masonry";
  radius: "sharp" | "rounded" | "pill";
  thumbnailGradient: string;
}

/** Older picker IDs map onto the four live themes. */
const TEMPLATE_ALIASES: Record<string, WebsiteTemplateId> = {
  "bold-vibrant": "coastal-living",
  "heritage-estate": "classic-agency",
  "tech-forward": "modern-minimal",
  "urban-edge": "luxury-dark",
};

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    featured: true,
    description: "Light, airy, and image-led. Headline over a full-bleed hero.",
    tagline: "Clean and contemporary",
    defaultHeroImage:
      "https://images.unsplash.com/photo-1600596542813-85a1c2dae59e?auto=format&fit=crop&w=1600&q=80",
    colors: {
      bg: "#f4f4f5",
      surface: "#ffffff",
      text: "#111111",
      muted: "#737373",
      accent: "#111111",
      accentText: "#ffffff",
      border: "#e7e5e4",
      heroFrom: "#111111",
      heroTo: "#404040",
    },
    fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
    heroLayout: "overlay",
    listingLayout: "grid-2",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #fafafa 0%, #d4d4d4 100%)",
  },
  {
    id: "luxury-dark",
    name: "Luxury Dark",
    featured: true,
    description: "Night palette with gold accents. Built for high-end stock.",
    tagline: "Quiet luxury",
    defaultHeroImage:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80",
    colors: {
      bg: "#0c0c0b",
      surface: "#161614",
      text: "#f5f0e6",
      muted: "#a8a29e",
      accent: "#c6a15b",
      accentText: "#0c0c0b",
      border: "#2a2824",
      heroFrom: "#0c0c0b",
      heroTo: "#1c1917",
    },
    fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
    heroLayout: "overlay",
    listingLayout: "cards",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #0c0c0b 0%, #c6a15b 100%)",
  },
  {
    id: "classic-agency",
    name: "Classic Agency",
    featured: true,
    description: "Navy split layout. Text on one side, photography on the other.",
    tagline: "Established and trusted",
    defaultHeroImage:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80",
    colors: {
      bg: "#f6f4ef",
      surface: "#ffffff",
      text: "#141414",
      muted: "#6b6b6b",
      accent: "#141414",
      accentText: "#ffffff",
      border: "#e8e4dc",
      heroFrom: "#ffffff",
      heroTo: "#ffffff",
    },
    fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
    heroLayout: "split",
    listingLayout: "grid-3",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #1e3a5f 0%, #f8f6f1 100%)",
  },
  {
    id: "coastal-living",
    name: "Coastal Living",
    featured: true,
    description: "Soft teal and sand. Left-aligned copy over a bright coastal hero.",
    tagline: "Light, air, and sea",
    defaultHeroImage:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    colors: {
      bg: "#f7f4ee",
      surface: "#ffffff",
      text: "#1a3c34",
      muted: "#5f8a7d",
      accent: "#0f766e",
      accentText: "#ffffff",
      border: "#d7e5df",
      heroFrom: "#0f766e",
      heroTo: "#134e4a",
    },
    fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
    heroLayout: "left-aligned",
    listingLayout: "grid-2",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #0f766e 0%, #f7f4ee 100%)",
  },
];

export const FEATURED_TEMPLATES = WEBSITE_TEMPLATES.filter((t) => t.featured);

export function resolveTemplateId(id?: string): WebsiteTemplateId {
  if (!id) return "modern-minimal";
  if (TEMPLATE_ALIASES[id]) return TEMPLATE_ALIASES[id];
  if (WEBSITE_TEMPLATES.some((t) => t.id === id)) return id as WebsiteTemplateId;
  return "modern-minimal";
}

export function getTemplate(id?: string): WebsiteTemplate {
  const resolved = resolveTemplateId(id);
  return WEBSITE_TEMPLATES.find((t) => t.id === resolved) || WEBSITE_TEMPLATES[0];
}

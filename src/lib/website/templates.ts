import type { WebsiteTemplateId } from "@/types";

export interface WebsiteTemplate {
  id: WebsiteTemplateId;
  name: string;
  description: string;
  /** Short marketing tagline */
  tagline: string;
  /** CSS variables that override the default dark preview theme */
  colors: {
    /** Primary background */
    bg: string;
    /** Secondary / card surface */
    surface: string;
    /** Primary text */
    text: string;
    /** Muted/secondary text */
    muted: string;
    /** Accent / CTA color */
    accent: string;
    /** Accent text on accent background */
    accentText: string;
    /** Border/separator color */
    border: string;
    /** Hero gradient from */
    heroFrom: string;
    /** Hero gradient to */
    heroTo: string;
  };
  /** Typography pairing */
  fonts: {
    heading: string;
    body: string;
  };
  /** Layout variant for the hero section */
  heroLayout: "centered" | "left-aligned" | "split" | "overlay";
  /** Listing grid style */
  listingLayout: "grid-2" | "grid-3" | "cards" | "masonry";
  /** Border radius scale */
  radius: "sharp" | "rounded" | "pill";
  /** Thumbnail gradient for the template picker card */
  thumbnailGradient: string;
}

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean lines, generous whitespace, and a crisp monochrome palette. Lets your listings speak for themselves.",
    tagline: "Less is more",
    colors: {
      bg: "#ffffff",
      surface: "#f8f9fa",
      text: "#111111",
      muted: "#6b7280",
      accent: "#111111",
      accentText: "#ffffff",
      border: "#e5e7eb",
      heroFrom: "#f8f9fa",
      heroTo: "#ffffff",
    },
    fonts: { heading: "Inter", body: "Inter" },
    heroLayout: "centered",
    listingLayout: "grid-2",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #f8f9fa 0%, #e5e7eb 50%, #ffffff 100%)",
  },
  {
    id: "luxury-dark",
    name: "Luxury Dark",
    description: "Deep blacks with gold accents. Premium feel for high-end brokerages and luxury property portfolios.",
    tagline: "Refined elegance",
    colors: {
      bg: "#0a0a0a",
      surface: "#141414",
      text: "#f5f5f5",
      muted: "#a1a1aa",
      accent: "#d4a853",
      accentText: "#0a0a0a",
      border: "#27272a",
      heroFrom: "#141414",
      heroTo: "#0a0a0a",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    heroLayout: "overlay",
    listingLayout: "cards",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #d4a853 100%)",
  },
  {
    id: "classic-agency",
    name: "Classic Agency",
    description: "Traditional navy and white with serif headings. Trusted, established, professional — the Savills look.",
    tagline: "Time-honoured trust",
    colors: {
      bg: "#ffffff",
      surface: "#f0f4f8",
      text: "#1a2332",
      muted: "#64748b",
      accent: "#1e3a5f",
      accentText: "#ffffff",
      border: "#cbd5e1",
      heroFrom: "#1e3a5f",
      heroTo: "#0f2440",
    },
    fonts: { heading: "Playfair Display", body: "Source Sans Pro" },
    heroLayout: "left-aligned",
    listingLayout: "grid-3",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #1e3a5f 0%, #0f2440 50%, #ffffff 100%)",
  },
  {
    id: "bold-vibrant",
    name: "Bold & Vibrant",
    description: "High-energy gradients, vibrant colours, and dynamic layouts. Stands out in crowded markets.",
    tagline: "Make a statement",
    colors: {
      bg: "#0f0f1a",
      surface: "#1a1a2e",
      text: "#ffffff",
      muted: "#94a3b8",
      accent: "#8b5cf6",
      accentText: "#ffffff",
      border: "#334155",
      heroFrom: "#8b5cf6",
      heroTo: "#ec4899",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    heroLayout: "split",
    listingLayout: "cards",
    radius: "pill",
    thumbnailGradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #0f0f1a 100%)",
  },
  {
    id: "coastal-living",
    name: "Coastal Living",
    description: "Breezy teals and warm sands. Perfect for coastal, resort, and vacation property specialists.",
    tagline: "Life by the water",
    colors: {
      bg: "#fefcf3",
      surface: "#f0f7f4",
      text: "#1a3c34",
      muted: "#5f8a7d",
      accent: "#0d9488",
      accentText: "#ffffff",
      border: "#d1e5df",
      heroFrom: "#0d9488",
      heroTo: "#065f46",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    heroLayout: "centered",
    listingLayout: "grid-2",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #0d9488 0%, #065f46 50%, #fefcf3 100%)",
  },
  {
    id: "urban-edge",
    name: "Urban Edge",
    description: "Industrial charcoals with orange pop accents. Built for city-focused agencies and modern developments.",
    tagline: "City living, redefined",
    colors: {
      bg: "#18181b",
      surface: "#1f1f23",
      text: "#fafafa",
      muted: "#a1a1aa",
      accent: "#f97316",
      accentText: "#18181b",
      border: "#3f3f46",
      heroFrom: "#f97316",
      heroTo: "#ea580c",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    heroLayout: "left-aligned",
    listingLayout: "masonry",
    radius: "sharp",
    thumbnailGradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #f97316 100%)",
  },
  {
    id: "heritage-estate",
    name: "Heritage Estate",
    description: "Warm creams with hunter green and gold touches. Evokes country houses, period properties, and heritage charm.",
    tagline: "Steeped in tradition",
    colors: {
      bg: "#faf8f1",
      surface: "#f5f0e3",
      text: "#2d3a2e",
      muted: "#6b7c6c",
      accent: "#2d5a3d",
      accentText: "#faf8f1",
      border: "#d4cbb8",
      heroFrom: "#2d5a3d",
      heroTo: "#1a3a24",
    },
    fonts: { heading: "Playfair Display", body: "Source Sans Pro" },
    heroLayout: "overlay",
    listingLayout: "grid-2",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #2d5a3d 0%, #1a3a24 50%, #faf8f1 100%)",
  },
  {
    id: "tech-forward",
    name: "Tech-Forward",
    description: "Cool slate with electric blue accents. For proptech-savvy agencies that lead with data and innovation.",
    tagline: "The future of property",
    colors: {
      bg: "#0f172a",
      surface: "#1e293b",
      text: "#f1f5f9",
      muted: "#94a3b8",
      accent: "#3b82f6",
      accentText: "#ffffff",
      border: "#334155",
      heroFrom: "#3b82f6",
      heroTo: "#1d4ed8",
    },
    fonts: { heading: "Inter", body: "Inter" },
    heroLayout: "split",
    listingLayout: "grid-3",
    radius: "rounded",
    thumbnailGradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #3b82f6 100%)",
  },
];

export function getTemplate(id?: string): WebsiteTemplate {
  return WEBSITE_TEMPLATES.find((t) => t.id === id) || WEBSITE_TEMPLATES[0];
}

export function getTemplateById(id: WebsiteTemplateId): WebsiteTemplate {
  return WEBSITE_TEMPLATES.find((t) => t.id === id) || WEBSITE_TEMPLATES[0];
}

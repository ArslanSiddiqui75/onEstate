import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WebsiteCanvas } from "@/components/website/website-preview";
import { PublicContactForm } from "@/components/website/public-contact-form";
import { getPublicSite } from "@/lib/website/public-site";
import { hydrateWebsiteSite } from "@/lib/website/defaults";
import { getTemplate } from "@/lib/website/templates";

// Tenants edit their site at any time, so don't cache the render indefinitely.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const published = await getPublicSite(slug);
  if (!published) return { title: "Site not found" };

  const hydrated = hydrateWebsiteSite(published.site, published.orgName);
  return {
    title: `${published.orgName} — ${hydrated.headline}`,
    description: hydrated.tagline || hydrated.aboutBio,
    openGraph: {
      title: `${published.orgName} — ${hydrated.headline}`,
      description: hydrated.tagline || undefined,
      images: hydrated.heroImageUrl ? [hydrated.heroImageUrl] : undefined,
    },
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const published = await getPublicSite(slug);
  if (!published) notFound();

  const hydrated = hydrateWebsiteSite(published.site, published.orgName);
  const template = getTemplate(hydrated.templateId);
  const isDark = template.id === "luxury-dark";

  return (
    <main className="min-h-screen">
      <WebsiteCanvas
        site={hydrated}
        orgName={published.orgName}
        listings={published.listings}
        market={published.market}
        editable={false}
        contactForm={
          <PublicContactForm
            site={published.slug}
            ctaLabel={hydrated.primaryCta}
            colors={{
              surface: template.colors.surface,
              text: template.colors.text,
              muted: template.colors.muted,
              accent: template.colors.accent,
              accentText: template.colors.accentText,
              border: template.colors.border,
            }}
            wrapperBackground={isDark ? template.colors.surface : "#ececec"}
          />
        }
      />
    </main>
  );
}

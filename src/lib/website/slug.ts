/** URL-safe slug for a public site path (`/site/<slug>`). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Hostnames are compared lowercase without port or leading `www.`. */
export function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .trim()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

export function fallbackSlug(orgId: string, orgName: string): string {
  const base = slugify(orgName);
  // Org id suffix keeps agencies with the same name from colliding.
  return base ? `${base}-${orgId.slice(0, 6)}` : `site-${orgId.slice(0, 8)}`;
}

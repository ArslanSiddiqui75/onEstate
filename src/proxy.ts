import { NextResponse, type NextRequest } from "next/server";

/**
 * Custom-domain routing for tenant websites.
 *
 * A request arriving on a domain that isn't the platform host is a tenant's
 * connected domain, so rewrite it to `/site/<host>`; `getPublicSite` resolves
 * that value against `websites.custom_domain`. Platform hosts pass through
 * untouched so the app, API and marketing site keep their own routes.
 */

function platformHosts(): string[] {
  const hosts = ["localhost", "127.0.0.1"];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      hosts.push(new URL(appUrl).hostname.replace(/^www\./, ""));
    } catch {
      // ignore malformed config
    }
  }
  return hosts;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");

  if (!host) return NextResponse.next();

  // Vercel preview/production deployment hosts are the platform, not tenants.
  const isPlatform =
    platformHosts().includes(host) || host.endsWith(".vercel.app");
  if (isPlatform) return NextResponse.next();

  const url = request.nextUrl.clone();
  // Only the site root maps to a tenant page; deeper paths stay as-is so a
  // custom domain can still reach shared assets and the capture endpoint.
  if (url.pathname === "/") {
    url.pathname = `/site/${host}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip API routes, Next internals and files with extensions.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

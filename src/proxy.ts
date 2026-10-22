import { NextResponse, type NextRequest } from "next/server";
import { defaultMarket, marketFromHost, marketFromPath, UK_DOMAIN, US_DOMAIN } from "@/lib/brand/host";
import type { Market } from "@/types";

/**
 * Custom-domain routing for tenant websites.
 *
 * A request arriving on a domain that isn't the platform host is a tenant's
 * connected domain, so rewrite it to `/site/<host>`; `getPublicSite` resolves
 * that value against `websites.custom_domain`. Platform hosts pass through
 * untouched so the app, API and marketing site keep their own routes.
 */

function platformHosts(): string[] {
  const hosts = ["localhost", "127.0.0.1", "0.0.0.0", UK_DOMAIN, US_DOMAIN];
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

function resolveRequestMarket(request: NextRequest, host: string): Market {
  const fromHost = marketFromHost(host);
  if (fromHost) return fromHost;
  const fromPath = marketFromPath(request.nextUrl.pathname);
  if (fromPath) return fromPath;
  if (request.nextUrl.pathname.startsWith("/app")) {
    const cookie = request.cookies.get("onestreet_market")?.value;
    if (cookie === "uk" || cookie === "us") return cookie;
  }
  return defaultMarket();
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") || "")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");

  const market = resolveRequestMarket(request, host);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-onestreet-market", market);

  if (!host) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Vercel preview/production deployment hosts are the platform, not tenants.
  const isPlatform =
    platformHosts().includes(host) || host.endsWith(".vercel.app");

  let response: NextResponse;
  const pathname = request.nextUrl.pathname;
  const previewPath = pathname === "/uk" ? "/UK" : pathname === "/us" ? "/US" : null;
  if (!isPlatform && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/site/${host}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else if (previewPath) {
    const url = request.nextUrl.clone();
    url.pathname = previewPath;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  const explicit = marketFromHost(host) || marketFromPath(request.nextUrl.pathname);
  if (explicit) {
    response.cookies.set("onestreet_market", explicit, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Skip API routes, Next internals and files with extensions.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

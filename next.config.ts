import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

function supabaseOrigins(): string[] {
  const out = ["https://*.supabase.co", "wss://*.supabase.co"];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      out.push(url.origin, `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`);
    } catch {
      // A malformed URL is reported by the Supabase client itself.
    }
  }
  return out;
}

// Next injects small inline bootstrap scripts, so 'unsafe-inline' stays for
// scripts; everything else is pinned to this site and the services it calls.
function contentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigins().join(" ")}${isProd ? "" : " ws://127.0.0.1:* ws://localhost:*"}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ];
  if (isProd) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev server is opened at 127.0.0.1. Without this, Next blocks the
  // client runtime and the app stays on the server-rendered loader.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/app/deals", destination: "/app/opportunities?view=deals", permanent: false },
      { source: "/app/transactions", destination: "/app/opportunities?view=deals", permanent: false },
      { source: "/app/crm", destination: "/app/conversations", permanent: false },
      { source: "/app/enquiries", destination: "/app/opportunities", permanent: false },
      { source: "/app/billing", destination: "/app/settings/billing", permanent: false },
      { source: "/app/teams", destination: "/app/settings/team", permanent: false },
      { source: "/app/settings/members", destination: "/app/settings/team", permanent: false },
      { source: "/app/settings/phone", destination: "/app/settings/phone-system", permanent: false },
      { source: "/app/settings/email", destination: "/app/settings/phone-system?section=email", permanent: false },
      { source: "/app/settings/routing", destination: "/app/settings/phone-system?section=routing", permanent: false },
      { source: "/app/reports", destination: "/app/settings/reports", permanent: false },
      { source: "/app/documents", destination: "/app/settings/documents", permanent: false },
      { source: "/app/support", destination: "/app/settings/support", permanent: false },
      { source: "/app/tickets", destination: "/app/settings/support", permanent: false },
      { source: "/app/tickets/:id", destination: "/app/settings/support/:id", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { getBrandByMarket } from "@/lib/brand/config";
import { defaultMarket, marketFromHost } from "@/lib/brand/host";
import { BrandProvider } from "@/components/brand/brand-provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/provider";
import { ToastContainer } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { Market } from "@/types";
import "./globals.css";

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

function marketFromHeaders(headerList: Headers): Market {
  const explicit = headerList.get("x-onestreet-market");
  if (explicit === "uk" || explicit === "us") return explicit;
  return marketFromHost(headerList.get("x-forwarded-host") || headerList.get("host") || "") ?? defaultMarket();
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrandByMarket(marketFromHeaders(await headers()));
  return {
    title: {
      default: `${brand.name} — ${brand.localeLabel}`,
      template: `%s · ${brand.name}`,
    },
    description: brand.supporting,
    icons: {
      icon: [
        {
          url: "/brand/favicon-32.png?v=3d",
          sizes: "32x32",
          type: "image/png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/brand/favicon-dark-32.png?v=3d",
          sizes: "32x32",
          type: "image/png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/brand/icon-512.png?v=3d",
          sizes: "512x512",
          type: "image/png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/brand/icon-dark-512.png?v=3d",
          sizes: "512x512",
          type: "image/png",
          media: "(prefers-color-scheme: dark)",
        },
      ],
      apple: [
        { url: "/brand/apple-touch.png?v=3d", sizes: "180x180", media: "(prefers-color-scheme: light)" },
        { url: "/brand/apple-touch-dark.png?v=3d", sizes: "180x180", media: "(prefers-color-scheme: dark)" },
      ],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const market = marketFromHeaders(await headers());
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${body.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <BrandProvider market={market}>
          <ThemeProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <ToastContainer />
          </ThemeProvider>
        </BrandProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { getBrandByMarket } from "@/lib/brand/config";
import { defaultMarket, marketFromHost } from "@/lib/brand/host";
import { BrandProvider } from "@/components/brand/brand-provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/provider";
import { ToastContainer } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { Market } from "@/types";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
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
      icon: [{ url: "/brand/mark.svg", type: "image/svg+xml" }],
      apple: "/brand/apple-touch.png",
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
      className={`${display.variable} ${body.variable} h-full`}
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

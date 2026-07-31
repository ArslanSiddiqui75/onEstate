import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { getActiveBrand } from "@/lib/brand/config";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/provider";
import { ToastContainer } from "@/components/ui/toast";
import { ErrorBoundary } from "@/components/ui/error-boundary";
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

const brand = getActiveBrand();

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Unified Real Estate Operations`,
    template: `%s · ${brand.name}`,
  },
  description: brand.supporting,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <ThemeProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}

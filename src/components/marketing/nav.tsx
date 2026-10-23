"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { getMarketingCopy } from "@/components/marketing/copy";
import { useTheme } from "@/lib/theme/provider";
import type { Market } from "@/types";

export function MarketingNav({ market }: { market: Market }) {
  const copy = getMarketingCopy(market);
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors",
        scrolled
          ? "border-[var(--border)] bg-[var(--surface-solid)]/90 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href={market === "uk" ? "/UK" : "/US"} className="flex items-center" aria-label="0neStreet">
          <BrandMark
            className="text-[17px] text-[var(--foreground)]"
            accentClassName="text-[var(--accent)]"
          />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Product">
          {copy.nav.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-[13px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
          <Button asChild variant="ghost" className="hidden h-9 sm:inline-flex">
            <Link href="/app/login">Sign in</Link>
          </Button>
          <Button asChild className="hidden h-9 px-4 sm:inline-flex">
            <a href="#contact">{copy.primaryCta}</a>
          </Button>
          <details className="group relative lg:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--border)] [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4 group-open:hidden" />
              <X className="hidden h-4 w-4 group-open:block" />
            </summary>
            <nav
              className="absolute right-0 top-12 w-64 rounded-3xl border border-[var(--border)] bg-[var(--surface-solid)] p-3 shadow-[var(--shadow-float)]"
              aria-label="Product"
            >
              {copy.nav.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/app/login">Sign in</Link>
                </Button>
                <Button asChild className="rounded-full">
                  <a href="#contact">{copy.primaryCta}</a>
                </Button>
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

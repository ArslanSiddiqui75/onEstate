"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";
import { getActiveBrand } from "@/lib/brand/config";
import { useTheme } from "@/lib/theme/provider";

const LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#solution", label: "Solution" },
  { href: "#modules", label: "Modules" },
  { href: "#markets", label: "Market fit" },
  { href: "#plans", label: "Plans" },
  { href: "#roadmap", label: "Roadmap" },
];

export function MarketingNav() {
  const brand = getActiveBrand();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full px-4 transition-all duration-300 sm:px-5",
          scrolled
            ? "glass-nav shadow-[var(--shadow-float)]"
            : "bg-transparent",
        )}
      >
        <Link href="/">
          <BrandMark className="text-lg text-white" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Marketing">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-[13px] text-white/70 transition hover:bg-white/8 hover:text-white"
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
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/12 text-white/75 transition hover:border-white/25 hover:bg-white/8 hover:text-white"
          >
            <Sun
              className={cn(
                "absolute h-4 w-4 transition-all duration-300",
                theme === "dark" ? "-translate-y-6 opacity-0" : "translate-y-0 opacity-100",
              )}
              aria-hidden
            />
            <Moon
              className={cn(
                "absolute h-4 w-4 transition-all duration-300",
                theme === "dark" ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
              )}
              aria-hidden
            />
          </button>
          <Button
            asChild
            variant="ghost"
            className="hidden h-9 rounded-full text-white hover:bg-white/10 sm:inline-flex"
          >
            <Link href="/app">Open product</Link>
          </Button>
          <Button asChild className="h-9 rounded-full px-4">
            <a href="#ask">{brand.demandCta}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

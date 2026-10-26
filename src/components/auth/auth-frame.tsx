"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useBrand } from "@/components/brand/brand-provider";

/**
 * Shared sign-in chrome. The left panel is always ink, so it uses the bright
 * lockup. The form column follows the theme, so fields, type, and the toggle
 * stay readable in light and dark.
 */
export function AuthFrame({
  screen,
  kicker,
  title,
  lede,
  asideTitle,
  asideBody,
  points,
  children,
  footer,
}: {
  screen: "login" | "signup" | "reset" | "admin";
  kicker: string;
  title: string;
  lede: string;
  asideTitle: string;
  asideBody: string;
  points: string[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  const brand = useBrand();
  const home = brand.market === "uk" ? "/UK" : "/US";

  return (
    <div
      data-auth-screen={screen}
      className="grid min-h-dvh lg:grid-cols-[minmax(0,0.96fr)_minmax(22rem,1.04fr)]"
    >
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[#071015] px-10 py-10 text-[#f4f7f8] lg:flex xl:px-14">
        <div className="pointer-events-none absolute inset-0 bg-[image:var(--ink-mesh)]" />
        <div className="pointer-events-none absolute -left-20 bottom-[-4rem] h-72 w-72 rounded-full bg-[#17baa8]/25 blur-3xl" />
        <div className="relative">
          <Link href={home} className="inline-flex" aria-label="OneStreet">
            <BrandMark tone="dark" className="text-2xl" />
          </Link>
        </div>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7dccc2]">
            {brand.regionShort} · {brand.domain}
          </p>
          <h2 className="mt-4 font-display text-[2.6rem] leading-[1.05] tracking-[-0.03em] text-white">
            {asideTitle}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">{asideBody}</p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#17baa8]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/45">
          {brand.currency === "GBP" ? "Pounds" : "Dollars"} on {brand.domain}
        </p>
      </aside>

      <div className="relative flex min-h-dvh flex-col bg-[var(--canvas)]">
        <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href={home} className="inline-flex lg:hidden" aria-label="OneStreet">
            <BrandMark className="text-[15px]" />
          </Link>
          <Link
            href={home}
            className="hidden text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] lg:inline"
          >
            Back to site
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 flex-col px-5 pb-12 sm:px-8">
          <div className="mx-auto my-auto w-full max-w-[26rem] py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              {kicker}
            </p>
            <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)]">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{lede}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-sm text-[var(--muted)]">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMarketingCopy } from "@/components/marketing/copy";
import type { Market } from "@/types";

export function Hero({ market }: { market: Market }) {
  const copy = getMarketingCopy(market);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % copy.heroPhrases.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [copy.heroPhrases.length]);

  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-40 text-center sm:px-8 sm:pb-28 sm:pt-44">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_58%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-4xl">
        <a
          href="#jobs"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-solid)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[var(--foreground)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
          See the desk
        </a>
        <h1 className="mt-8 font-sans text-[clamp(3.1rem,7.4vw,6rem)] font-semibold leading-[0.92] tracking-[-0.045em]">
          {copy.heroLead}
          <span className="mt-2 block min-h-[1.05em] text-[var(--accent)]" aria-live="polite">
            {copy.heroPhrases[index]}
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          {copy.heroBody}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full px-7">
            <a href="#contact">{copy.primaryCta}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7">
            <Link href="/app/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

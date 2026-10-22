import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMarketingCopy } from "@/components/marketing/copy";
import { ProductFrame } from "@/components/marketing/product-frame";
import type { Market } from "@/types";

export function Hero({ market }: { market: Market }) {
  const copy = getMarketingCopy(market);

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:pb-24 lg:pt-32">
      <div>
        <p className="eyebrow">{copy.heroEyebrow}</p>
        <h1 className="mt-4 max-w-xl font-display text-[clamp(2.7rem,6vw,4.6rem)] leading-[0.98] tracking-[-0.045em]">
          {copy.heroTitle}
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          {copy.heroBody}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <a href="#contact">{copy.primaryCta}</a>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="/app/login">Sign in</Link>
          </Button>
        </div>
      </div>
      <ProductFrame uk={copy.uk} />
    </section>
  );
}

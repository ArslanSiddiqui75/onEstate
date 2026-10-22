import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { ProductFrame } from "@/components/marketing/product-frame";
import { ClientSwitch, StorySwitch } from "@/components/marketing/story-switch";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { getMarketingCopy } from "@/components/marketing/copy";

const copy = getMarketingCopy();

export const metadata: Metadata = {
  title: `${copy.brand.name} — ${copy.heroEyebrow}`,
  description: copy.heroBody,
};

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;

  return (
    <div className="overflow-x-hidden text-[var(--foreground)]">
      <MarketingNav />
      <main>
        {demo === "received" || demo === "invalid" || demo === "error" ? (
          <p
            className="fixed left-1/2 top-[4.75rem] z-40 w-[min(100%-1.5rem,36rem)] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-2 text-center text-sm font-medium shadow-[var(--shadow-float)]"
            role="status"
          >
            {demo === "received"
              ? "Demo request received. We’ll be in touch."
              : demo === "invalid"
                ? "Add a name and a valid work email, then send it again."
                : "We couldn’t save that request. Try again in a moment."}
          </p>
        ) : null}
        <Hero />

        <section className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <ul className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-5 py-4 sm:px-8">
            {copy.proof.map((item) => (
              <li
                key={item}
                className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-medium"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="software" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Software</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">
              Everything the office needs. Nothing bolted on afterwards.
            </h2>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {copy.pillars.map((point) => (
              <article
                key={point.title}
                className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)]"
              >
                <h3 className="text-lg font-semibold tracking-tight">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{point.body}</p>
              </article>
            ))}
          </div>
          <div id="diary" className="mt-16 scroll-mt-28">
            <StorySwitch stories={copy.stories} />
          </div>
        </section>

        <section id="clients" className="scroll-mt-28 border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="eyebrow">Clients</p>
            <h2 className="mt-3 max-w-2xl font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">
              Your clients expect a link. The office keeps the file.
            </h2>
            <div className="mt-12">
              <ClientSwitch clients={copy.clients} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Sample office</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">{copy.sampleTitle}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">{copy.sampleBody}</p>
          </div>
          <ProductFrame />
        </section>

        <section id="ai" className="scroll-mt-28 border-t border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="eyebrow">On the record</p>
            <h2 className="mt-3 max-w-2xl font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">
              Drafts, referrals, and fee requests. Built into the deal.
            </h2>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {copy.blocks.map((block) => (
                <article key={block.title} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
                  <h3 className="text-lg font-semibold">{block.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{block.body}</p>
                </article>
              ))}
            </div>
            <dl className="mt-10 grid gap-3 sm:grid-cols-3">
              {copy.facts.map(([value, label]) => (
                <div key={label} className="rounded-[1.5rem] bg-[var(--surface-elevated)] px-5 py-6">
                  <dt className="font-display text-4xl tracking-tight">{value}</dt>
                  <dd className="mt-2 text-sm text-[var(--muted)]">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05]">{copy.supportTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{copy.supportBody}</p>
        </section>

        <section id="contact" className="scroll-mt-28 px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-10 shadow-[var(--shadow-card)] sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <p className="eyebrow">Book a demo</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">{copy.contactTitle}</h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">{copy.contactBody}</p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--surface-muted)] p-5 sm:p-6">
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <BrandMark className="text-xl text-[var(--foreground)]" accentClassName="text-[var(--accent)]" />
        <p className="text-sm text-[var(--muted)]">{copy.footerLine}</p>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/app/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Sign in
          </Link>
          <a href="#contact" className="text-[var(--accent)]">
            Book a demo
          </a>
        </div>
      </footer>
    </div>
  );
}

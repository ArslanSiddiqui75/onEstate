import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { ProductFrame } from "@/components/marketing/product-frame";
import { Pricing } from "@/components/marketing/pricing";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { getMarketingCopy } from "@/components/marketing/copy";
import type { Market } from "@/types";

export function MarketingHome({
  market,
  demo,
}: {
  market: Market;
  demo?: string;
}) {
  const copy = getMarketingCopy(market);

  return (
    <div className="overflow-x-hidden text-[var(--foreground)]">
      <MarketingNav market={market} />
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
        <Hero market={market} />

        <section className="border-y border-[var(--border)]">
          <ul className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
            {copy.proof.map((item) => (
              <li key={item} className="text-[13px] font-medium text-[var(--muted)]">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {copy.chapters.map((chapter) => (
          <section
            key={chapter.id}
            id={chapter.id}
            className="scroll-mt-28 border-b border-[var(--border)]"
          >
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
              <div className="max-w-3xl">
                <p className="eyebrow">{chapter.eyebrow}</p>
                <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                  {chapter.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{chapter.lede}</p>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {chapter.items.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-card)]"
                  >
                    <h3 className="text-base font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ))}

        <section id="desk" className="scroll-mt-28">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">A deal, in order</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                From the enquiry to the file you would hand over.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                Four moves. Same property. The office does not retype the address each time the deal changes hands.
              </p>
            </div>
            <ol className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {copy.steps.map((step) => (
                <li
                  key={step.n}
                  className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
                >
                  <p className="font-display text-3xl text-[var(--accent)]">{step.n}</p>
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="clients" className="scroll-mt-28 border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">Client links</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                They get a link. You keep the file.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
                No extra login for the person you act for. Approval, booking, an offer, and a repair report arrive on the desk you already have open.
              </p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {copy.clients.map((client) => (
                <article
                  key={client.id}
                  className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6"
                >
                  <h3 className="font-display text-3xl font-medium">{client.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{client.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">The office</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
              A seat for each person who already touches the deal.
            </h2>
          </div>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {copy.roles.map((role) => (
              <li key={role.title} className="rounded-[1.25rem] border border-[var(--border)] px-5 py-4">
                <p className="font-semibold">{role.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{role.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Sample office</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                {copy.sampleTitle}
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">{copy.sampleBody}</p>
            </div>
            <ProductFrame uk={copy.uk} />
          </div>
        </section>

        <section id="ai" className="scroll-mt-28">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">On the record</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                Drafts, referrals, and the fee. Written on the deal.
              </h2>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {copy.blocks.map((block) => (
                <article key={block.title} className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
                  <h3 className="text-lg font-semibold">{block.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{block.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="max-w-3xl">
              <p className="eyebrow">In the box</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                What the {copy.uk ? "UK" : "US"} book actually contains.
              </h2>
            </div>
            <ul className="mt-10 grid gap-2 sm:grid-cols-2">
              {copy.checklist.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Pricing market={market} />

        <section id="questions" className="scroll-mt-28 border-t border-[var(--border)]">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="eyebrow">Questions</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.4rem)] font-medium leading-[1.08]">
              Before you book the hour.
            </h2>
            <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {copy.faqs.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-base font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-4">
                      {item.q}
                      <span className="mt-1 text-[var(--muted)] group-open:hidden" aria-hidden>
                        +
                      </span>
                      <span className="mt-1 hidden text-[var(--muted)] group-open:inline" aria-hidden>
                        –
                      </span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-8 text-center sm:px-8">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.08]">{copy.supportTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{copy.supportBody}</p>
        </section>

        <section id="contact" className="scroll-mt-28 px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto grid max-w-7xl gap-10 rounded-[2rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-10 shadow-[var(--shadow-card)] sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <p className="eyebrow">Book a demo</p>
              <h2 className="mt-3 font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
                {copy.contactTitle}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">{copy.contactBody}</p>
              <p className="mt-6 text-sm text-[var(--muted)]">
                Already on the desk?{" "}
                <Link href="/app/login" className="font-semibold text-[var(--accent)]">
                  Sign in
                </Link>
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--surface-muted)] p-5 sm:p-6">
              <WaitlistForm market={market} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark brand={copy.brand} className="text-base" />
            <p className="max-w-md text-sm text-[var(--muted)]">
              {copy.footerLine} {copy.brand.domain}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <a href="#product" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Product
            </a>
            <a href="#desk" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              The desk
            </a>
            <a href="#clients" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Clients
            </a>
            <a href="#pricing" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Pricing
            </a>
            <Link href="/app/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Sign in
            </Link>
            <a href="#contact" className="text-[var(--accent)]">
              Book a demo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

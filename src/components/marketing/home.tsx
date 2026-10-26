import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { BeforeAfter } from "@/components/marketing/before-after";
import { JobPanel } from "@/components/marketing/job-panel";
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
    <div className="overflow-x-hidden bg-[var(--canvas)] text-[var(--foreground)]">
      <MarketingNav market={market} />
      <main>
        {demo === "received" || demo === "invalid" || demo === "error" ? (
          <p
            className="fixed left-1/2 top-28 z-40 w-[min(100%-1.5rem,36rem)] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-4 py-2 text-center text-sm font-medium shadow-[var(--shadow-float)]"
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

        <section id="compare" className="scroll-mt-36">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold text-[var(--accent)]">The same morning</p>
            <h2 className="mt-3 max-w-3xl font-sans text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              Scattered across inboxes. Or on the file.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              Drag the line. Calls, messages, and portal questions stay where they landed, until that property is on the desk.
            </p>
            <div className="mt-10">
              <BeforeAfter uk={copy.uk} />
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center">
            <div>
              <p className="font-sans text-5xl font-semibold tracking-[-0.04em]">One login</p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
                {copy.uk
                  ? "The UK book: enquiries, the diary, progression, lettings, and four client links. Priced in pounds."
                  : "The US book: enquiries, the diary, progression, and client links. Priced in dollars."}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {copy.proof.map((item) => (
                <li
                  key={item}
                  className="flex min-h-16 items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-medium"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="jobs" className="scroll-mt-36">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold text-[var(--accent)]">The everyday work</p>
            <h2 className="mt-3 max-w-3xl font-sans text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              The jobs the office keeps meaning to get to.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              Pick a job. The desk on the right is the same record the team opens in the morning.
            </p>
            <div className="mt-12">
              <JobPanel jobs={copy.jobs} uk={copy.uk} />
            </div>
          </div>
        </section>

        <section id="product" className="scroll-mt-36 border-y border-[var(--border)] bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold text-[var(--accent)]">One system</p>
            <h2 className="mt-3 max-w-3xl font-sans text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              The last desk you have to retrain the office on.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">
              New portals and new rules show up as another column on the same file, not as another login.
            </p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--border)] lg:grid-cols-3">
              {copy.pillars.map((pillar) => (
                <article key={pillar.eyebrow} className="flex flex-col bg-[var(--surface-elevated)] p-6 sm:p-8">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent)]">{pillar.eyebrow}</p>
                  <h3 className="mt-3 font-sans text-2xl font-semibold tracking-[-0.03em]">{pillar.title}</h3>
                  <ul className="mt-6 flex-1 divide-y divide-[var(--border)]">
                    {pillar.points.map((point) => (
                      <li key={point} className="py-3 text-sm leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={pillar.href}
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)]"
                  >
                    {pillar.cta}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="clients" className="scroll-mt-36">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold text-[var(--accent)]">Client links</p>
            <h2 className="mt-3 max-w-3xl font-sans text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              They get a link. You keep the file.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {copy.clients.map((client) => (
                <article key={client.id} className="rounded-[1.5rem] border border-[var(--border)] p-6">
                  <h3 className="font-sans text-2xl font-semibold tracking-[-0.03em]">{client.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{client.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {copy.uk ? (
          <section id="lettings" className="scroll-mt-36 border-t border-[var(--border)] bg-[var(--surface-muted)]">
            <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
              <p className="text-sm font-semibold text-[var(--accent)]">Lettings</p>
              <h2 className="mt-3 max-w-3xl font-sans text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">
                England, Wales, and Scotland, on the tenancy.
              </h2>
              <ul className="mt-8 grid gap-2 sm:grid-cols-2">
                {copy.checklist.filter((item) => /[Ll]etting|[Rr]epair|[Rr]ent|Right to Rent|[Kk]ey|[Cc]ontractor|[Gg]as|[Dd]ispute|[Ii]nspection/.test(item)).map((item) => (
                  <li key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="bg-[var(--surface-muted)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className="max-w-3xl font-sans text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              Whatever size the office is <span className="text-[var(--accent)]">next.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base text-[var(--muted)]">From one negotiator to as many offices as you run.</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {copy.scales.map((scale) => (
                <article key={scale.eyebrow} className="flex flex-col rounded-[1.5rem] bg-[var(--ink)] p-7 text-[var(--ink-foreground)] sm:p-9">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--accent-on-ink)]">{scale.eyebrow}</p>
                  <h3 className="mt-4 font-sans text-3xl font-semibold tracking-[-0.03em]">{scale.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">{scale.body}</p>
                  <Link
                    href={scale.href}
                    className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)]"
                  >
                    {scale.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[var(--ink)] text-[var(--ink-foreground)]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold text-[var(--accent-on-ink)]">Why offices stay</p>
            <h2 className="mt-3 max-w-2xl font-sans text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">
              What you are actually buying.
            </h2>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {copy.reasons.map((reason) => (
                <article key={reason.title} className="rounded-2xl bg-white/6 p-5">
                  <h3 className="font-sans text-lg font-semibold">{reason.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{reason.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[var(--ink)] pb-16 text-[var(--ink-foreground)] sm:pb-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-8 border-t border-white/10 pt-12 sm:grid-cols-2 lg:grid-cols-4">
              {copy.facts.map(([value, label]) => (
                <div key={label}>
                  <p className="font-sans text-4xl font-semibold tracking-[-0.04em]">{value}</p>
                  <span className="mt-3 block h-0.5 w-10 bg-[var(--accent)]" />
                  <p className="mt-3 text-sm text-white/70">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Pricing market={market} />

        <section id="questions" className="scroll-mt-36 border-t border-[var(--border)]">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
            <h2 className="font-sans text-[clamp(2rem,4vw,3.2rem)] font-semibold tracking-[-0.04em]">
              Before you book the hour.
            </h2>
            <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {copy.faqs.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-4">
                      {item.q}
                      <span className="text-[var(--muted)] group-open:hidden" aria-hidden>+</span>
                      <span className="hidden text-[var(--muted)] group-open:inline" aria-hidden>–</span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-36 px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-7xl rounded-[1.75rem] bg-[var(--ink)] px-6 py-10 text-[var(--ink-foreground)] sm:px-10 sm:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="max-w-xl font-sans text-[clamp(2.2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
                Now’s the time to see it on your own stock.
              </h2>
              <a
                href="#demo-form"
                className="inline-flex h-12 w-fit items-center rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-foreground)]"
              >
                Book a demo
              </a>
            </div>
          </div>
          <div id="demo-form" className="mx-auto mt-6 grid max-w-7xl gap-8 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-8 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Book a demo</p>
              <h3 className="mt-3 font-sans text-3xl font-semibold tracking-[-0.03em]">{copy.contactTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{copy.contactBody}</p>
            </div>
            <WaitlistForm market={market} />
          </div>
        </section>
      </main>

      <footer className="bg-[var(--ink)] text-[var(--ink-foreground)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.7fr))]">
          <div>
            <BrandMark tone="dark" className="text-[15px]" />
            <p className="mt-4 max-w-xs text-sm text-white/70">{copy.footerLine}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--accent-on-ink)]">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li><a href="#jobs">The desk</a></li>
              <li><a href="#product">{copy.uk ? "Sales and lettings" : "Sales and listings"}</a></li>
              <li><a href="#clients">Client links</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--accent-on-ink)]">The book</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>{copy.uk ? "Pounds, on 0nestreet.co.uk" : "Dollars, on 0nestreet.com"}</li>
              <li>{copy.uk ? "England, Wales, and Scotland" : "Sales through to close"}</li>
              <li><Link href="/app/signup?plan=solo">Start solo</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--accent-on-ink)]">Office</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li><Link href="/app/login">Sign in</Link></li>
              <li><a href="#contact">Book a demo</a></li>
              <li><a href="#questions">Questions</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

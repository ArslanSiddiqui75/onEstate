import Link from "next/link";
import { PLANS } from "@/lib/plans/catalog";
import { formatPlanPrice, planLines, regionModules } from "@/lib/brand/offer";
import type { PlanId } from "@/types";
import type { Market } from "@/types";

const ORDER: PlanId[] = ["solo", "team", "enterprise"];

export function Pricing({ market }: { market: Market }) {
  const modules = regionModules(market);
  return (
    <section id="pricing" className="scroll-mt-28 border-t border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow">Pricing</p>
        <h2 className="mt-3 max-w-2xl font-display text-[clamp(2.1rem,4.2vw,3.5rem)] font-medium leading-[1.08]">
          {market === "uk" ? "UK pricing, in pounds." : "US pricing, in dollars."}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          {market === "uk"
            ? "Lettings, viewings, and the four client links are included. Billing is in pounds."
            : "Showings, MLS-ready stock, and client links are included. Billing is in dollars."}
        </p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((item) => (
            <li key={item.name} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {ORDER.map((id) => {
            const plan = PLANS[id];
            return (
              <article
                key={id}
                className={`rounded-[1.5rem] border bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-card)] ${
                  plan.popular ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {plan.popular ? (
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-foreground)]">
                      Usual choice
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{plan.tagline}</p>
                <p className="mt-5 font-display text-4xl tracking-tight">
                  {formatPlanPrice(market, id)}
                  {id === "enterprise" ? null : <span className="text-base font-sans font-medium text-[var(--muted)]"> / month</span>}
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {planLines(market, id).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Link
                  href={id === "enterprise" ? "#contact" : `/app/signup?plan=${id}`}
                  className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
                >
                  {id === "enterprise" ? "Talk to sales" : "Start this plan"}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

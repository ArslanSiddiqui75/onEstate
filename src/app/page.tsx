import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { getActiveBrand } from "@/lib/brand/config";
import { getTerminology } from "@/lib/market/terminology";
import { RBAC_MATRIX, ROLE_LABELS, MODULE_LABELS } from "@/lib/rbac/matrix";
import { PLANS } from "@/lib/plans/catalog";
import type { AccessLevel, ModuleId, Role } from "@/types";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const PROBLEMS = [
  {
    title: "Fragmented stack",
    body: "CRM, listings, compliance, web, and social live in separate tools stitched together.",
  },
  {
    title: "Paid add-ons",
    body: "Essentials like lead import sit behind extra fees, inflating cost and slowing onboarding.",
  },
  {
    title: "Dated UI",
    body: "Clunky interfaces slow adoption among agents and ISAs who expect consumer-grade software.",
  },
  {
    title: "Flat access control",
    body: "One-size-fits-all permissions ignore how owners, brokers, leads, and agents actually delegate work.",
  },
];

const PILLARS = [
  {
    title: "One unified core",
    body: "Six modules, one data model, one login — not six subscriptions.",
  },
  {
    title: "Built for this market",
    body: "Portal feeds, compliance workflows, currency, and terminology configured for your region.",
  },
  {
    title: "All-in-one pricing",
    body: "No paywalled add-ons for essentials like lead import.",
  },
  {
    title: "Role-aware by design",
    body: "Every module is gated by a real RBAC matrix, not a flat feature list.",
  },
];

const MODULES = [
  {
    id: "01",
    title: "CRM & Lead Management",
    points: [
      "Configurable pipelines for buyers, sellers, landlords, and tenants",
      "Automated nurture and drip sequences by lead stage",
      "Lead routing and assignment by role and territory",
      "Lead scoring to prioritize follow-up",
    ],
  },
  {
    id: "02",
    title: "Listings & Portal Sync",
    points: [
      "Two-way portal feeds with pre-upload validation",
      "Bulk media management for photos, floorplans, tours",
      "Listing status sync across connected portals",
      "Error-checking to prevent rejected feeds",
    ],
  },
  {
    id: "03",
    title: "Transaction & Compliance",
    points: [
      "E-signature workflows via certified providers",
      "Configurable deal checklists by transaction type",
      "Deal-linked ledger and reconciliation",
    ],
  },
  {
    id: "04",
    title: "Website Builder",
    points: [
      "Branded sites for agents, teams, and brokerages",
      "Listing embeds always in sync with inventory",
      "Custom domains and professional templates",
      "Client portal for buyers, sellers, and tenants",
    ],
  },
  {
    id: "05",
    title: "Social Media Tools",
    points: [
      "Cross-platform scheduling from one calendar",
      "Automatic listing-to-post generation",
      "Branded templates matching client identity",
      "Performance tracking across accounts",
    ],
  },
  {
    id: "06",
    title: "Billing & Subscriptions",
    points: [
      "Solo, Team/Brokerage, and Enterprise tiers",
      "Usage limits tracked and enforced per plan",
      "Self-serve upgrade and downgrade flows",
      "Feature-gating tied directly to RBAC",
    ],
  },
];

const ROADMAP = [
  {
    phase: "Phase 1",
    when: "Q3 2026",
    title: "Core Launch",
    body: "CRM, listings, portal sync, and billing live for customer deployments.",
  },
  {
    phase: "Phase 2",
    when: "Q4 2026",
    title: "Transactions & Compliance",
    body: "E-signatures, deal checklists, ledger & reconciliation.",
  },
  {
    phase: "Phase 3",
    when: "Q1 2027",
    title: "Website & Social",
    body: "Branded site builder, listing embeds, client portal, auto listing-to-post.",
  },
  {
    phase: "Phase 4",
    when: "2027+",
    title: "Enterprise & Expansion",
    body: "Multi-office governance, advanced analytics, deeper partner integrations.",
  },
];

const ACCESS_LABEL: Record<AccessLevel, string> = {
  full: "Full",
  edit: "Edit",
  view: "View",
  none: "—",
};

const ROLES = Object.keys(ROLE_LABELS) as Role[];
const MODULE_IDS = Object.keys(MODULE_LABELS) as ModuleId[];

export default function MarketingPage() {
  const brand = getActiveBrand();
  const terms = getTerminology(brand.market);

  const marketItems =
    brand.market === "uk"
      ? ([
          ["Listing portals", brand.portalsLabel],
          ["Listings", "Leasehold / freehold tenure fields"],
          ["Currency", "GBP with UK VAT handling"],
          ["E-signatures", "UK-compliant providers"],
          ["Terminology", `${terms.agent}, ${terms.lease.toLowerCase()}, ${terms.conveyancer.toLowerCase()}`],
        ] as [string, string][])
      : ([
          ["Listing portals", brand.portalsLabel],
          ["Listings", "MLS disclosures auto-validated"],
          ["Currency", "USD with US sales tax"],
          ["E-signatures", "ESIGN-compliant providers"],
          ["Terminology", `${terms.agent}, ${terms.lease.toLowerCase()}, ${terms.conveyancer.toLowerCase()}`],
        ] as [string, string][]);

  const operationalRows =
    brand.market === "uk"
      ? [
          ["Listing distribution", brand.portalsLabel],
          ["Contracting", "Provider-backed e-sign with audit trails"],
          ["Finance", "VAT-aware billing and accounting handoff"],
          ["Compliance", "Deal-level activity logs and document traces"],
          ["Access control", "RBAC across 6 roles × 6 modules × plan"],
        ]
      : [
          ["Listing distribution", brand.portalsLabel],
          ["Contracting", "Provider-backed e-sign with disclosure tracking"],
          ["Finance", "Sales-tax aware billing and accounting handoff"],
          ["Compliance", "Deal-level activity logs and workflow auditability"],
          ["Access control", "RBAC across 6 roles × 6 modules × plan"],
        ];

  return (
    <div className="overflow-x-hidden text-[var(--foreground)]">
      <MarketingNav />
      <Hero />

      <section id="problem" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="eyebrow">The problem</p>
        <h2 className="mt-4 max-w-4xl font-display text-[clamp(2.2rem,5vw,4.25rem)] leading-[1.02]">
          Real estate software wasn&apos;t built for how modern agencies actually
          operate.
        </h2>
        <div className="mt-14 grid gap-3 sm:grid-cols-2">
          {PROBLEMS.map((item, index) => (
            <article key={item.title} className="surface-panel p-6 transition hover:-translate-y-0.5">
              <p className="font-display text-4xl text-[var(--accent)]/30">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="solution"
        className="relative mx-4 overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#0b121a_0%,#152031_55%,#0c6e63_140%)] px-5 py-24 text-white sm:mx-6 sm:px-8 lg:mx-auto lg:max-w-7xl"
      >
        <div className="marketing-grain absolute inset-0 opacity-30" />
        <div className="relative">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white/45">
            The solution
          </p>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
            One platform. Every role, properly gated.
          </h2>
          <p className="mt-5 max-w-2xl text-base text-white/65">
            {brand.name} unifies six operational modules under a single
            RBAC-driven system — configured for {brand.localeLabel}.
          </p>
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {PILLARS.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
              >
                <h3 className="text-lg font-semibold text-[var(--accent-on-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Product modules</p>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
              Six modules. One data model.
            </h2>
          </div>
          <Link
            href="/app/signup"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)]"
          >
            See them in the product
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid gap-3 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <article key={mod.id} className="surface-panel group p-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)]">
                MODULE {mod.id}
              </p>
              <h3 className="mt-3 font-display text-2xl leading-tight transition group-hover:text-[var(--accent)]">
                {mod.title}
              </h3>
              <ul className="mt-5 space-y-2.5 text-sm text-[var(--muted)]">
                {mod.points.map((point) => (
                  <li key={point} className="flex gap-2 leading-relaxed">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="markets" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="surface-panel overflow-hidden p-6 sm:p-10">
          <p className="eyebrow">Market fit</p>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
            Built for {brand.localeLabel}.
          </h2>
          <div className="mt-10 max-w-2xl rounded-3xl bg-[var(--surface-muted)] p-6">
            <dl className="space-y-4">
              {marketItems.map(([label, value]) => (
                <div key={label} className="border-t border-[var(--border)] pt-4 first:border-0 first:pt-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-8 max-w-3xl text-sm text-[var(--muted)]">
            Regional rules, portal adapters, and compliance partners are managed
            in the backend for this brand. Regulated e-signature actions are
            performed by accredited partners — {brand.name} manages the request,
            data, and audit trail.
          </p>
        </div>
      </section>

      <section id="rbac" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="eyebrow">Access control</p>
        <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
          RBAC matrix — six roles, six modules
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-[var(--muted)]">
          Access is granted by role, then bounded by plan tier. Enterprise
          ceilings shown below.
        </p>
        <div className="surface-panel mt-8 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Module
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-4 text-xs font-semibold text-[var(--muted)]"
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_IDS.map((module) => (
                <tr
                  key={module}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-5 py-3.5 font-medium">
                    {MODULE_LABELS[module]}
                  </td>
                  {ROLES.map((role) => {
                    const level = RBAC_MATRIX[role][module];
                    return (
                      <td key={role} className="px-3 py-3.5">
                        <span
                          className={
                            level === "none"
                              ? "text-[var(--muted)]/50"
                              : level === "full"
                                ? "font-semibold text-[var(--accent)]"
                                : "text-[var(--muted)]"
                          }
                        >
                          {ACCESS_LABEL[level]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="plans" className="mx-4 my-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#0b121a,#152031)] px-5 py-24 text-white sm:mx-6 sm:px-8 lg:mx-auto lg:max-w-7xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white/45">
          Plans & packaging
        </p>
        <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
          Three tiers, one upgrade path
        </h2>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => {
            const plan = PLANS[id];
            return (
              <article
                key={id}
                className={`rounded-[1.75rem] border p-6 ${
                  plan.popular
                    ? "border-[var(--accent-on-ink)]/50 bg-white/8"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {plan.popular ? (
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-ink)]">
                    Most popular
                  </p>
                ) : (
                  <div className="mb-4 h-4" />
                )}
                <h3 className="font-display text-3xl">{plan.name}</h3>
                <p className="mt-2 text-sm text-white/60">{plan.tagline}</p>
                <p className="mt-6 text-sm text-white/80">Seats: {plan.seats}</p>
                <ul className="mt-6 space-y-2.5 text-sm text-white/60">
                  {Object.entries(plan.modules).map(([key, value]) => (
                    <li key={key}>
                      <span className="text-white/85">
                        {MODULE_LABELS[key as ModuleId]}
                      </span>
                      : {value}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section id="compete" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="eyebrow">Operational depth</p>
        <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
          Built for real brokerage operations, not surface-level feature checklists.
        </h2>
        <div className="surface-panel mt-8 overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Capability
                </th>
                <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {brand.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {operationalRows.map(([dim, c]) => (
                <tr
                  key={dim}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-5 py-4 font-medium">{dim}</td>
                  <td className="px-5 py-4 font-medium text-[var(--accent)]">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="roadmap" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="surface-panel p-6 sm:p-10">
          <p className="eyebrow">Roadmap</p>
          <h2 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.05]">
            Path to the full {brand.name} platform
          </h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((item, index) => (
              <li key={item.phase}>
                <p className="font-display text-5xl text-[var(--accent)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {item.phase} · {item.when}
                </p>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ask" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="eyebrow">Request a demo</p>
        <h2 className="mt-4 max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.02]">
          See how {brand.name} fits your brokerage operations.
        </h2>
        <div className="mt-10 grid gap-3 lg:grid-cols-3">
          {[
            {
              title: "Brokerage fit",
              body: `Configured for ${brand.localeLabel} with the terminology, pricing, and workflow expectations your team already uses.`,
            },
            {
              title: "Operational coverage",
              body: "CRM, listings, transactions, websites, social tools, and billing in one system with shared permissions.",
            },
            {
              title: "Integration roadmap",
              body: "Portal/MLS distribution, e-sign, accounting, and compliance adapters built into the core architecture.",
            },
          ].map((item) => (
            <article key={item.title} className="surface-panel p-6">
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </div>
        <div className="surface-panel mt-8 max-w-2xl p-6 sm:p-8">
          <h3 className="font-display text-3xl">Book a product walkthrough</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Tell us about your brokerage and workflows. We&apos;ll follow up with a tailored {brand.name} demo.
          </p>
          <WaitlistForm />
        </div>
      </section>

      <footer className="mx-4 mb-4 overflow-hidden rounded-[2rem] bg-[linear-gradient(145deg,#0b121a,#152031)] px-6 py-10 text-white sm:mx-6 lg:mx-auto lg:max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark className="text-2xl text-white" />
          <p className="text-sm text-white/45">
            {brand.name} · Property Operations Platform
          </p>
          <div className="flex gap-4 text-sm font-medium text-white/70">
            <Link href="/app/signup" className="hover:text-white">
              Start free
            </Link>
            <Link href="/app/login" className="hover:text-white">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

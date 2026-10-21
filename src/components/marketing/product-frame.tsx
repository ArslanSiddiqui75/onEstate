import { BrandMark } from "@/components/brand/brand-mark";
import { getActiveBrand } from "@/lib/brand/config";
import { cn } from "@/lib/utils";

type Variant = "desk" | "website" | "portal";

export function ProductFrame({
  variant = "desk",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const uk = getActiveBrand().market === "uk";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e7b3a4]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ead7a1]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#b7d7c5]" />
        <p className="ml-2 truncate text-xs text-[var(--muted)]">
          {variant === "website"
            ? uk
              ? "harbourandco.co.uk"
              : "harbourandco.com"
            : variant === "portal"
              ? "Client portal"
              : "Today"}
        </p>
      </div>
      {variant === "desk" ? <Desk uk={uk} /> : null}
      {variant === "website" ? <Website uk={uk} /> : null}
      {variant === "portal" ? <Portal uk={uk} /> : null}
    </div>
  );
}

function Desk({ uk }: { uk: boolean }) {
  const stats = uk
    ? [
        ["12", "Instructions"],
        ["8", "Viewings"],
        ["3", "Offers"],
      ]
    : [
        ["12", "Listings"],
        ["8", "Showings"],
        ["3", "Offers"],
      ];
  const rows = uk
    ? [
        ["14 Elm Grove", "Greenwich", "Viewing · 14:00"],
        ["8 Harbour Street", "To let", "Offer in"],
        ["Flat 2, Quay Walk", "For sale", "On the portals"],
      ]
    : [
        ["14 Elm Street", "Brooklyn", "Showing · 2:00"],
        ["8 Harbor Avenue", "For lease", "Offer in"],
        ["Unit 2, Quay Walk", "For sale", "Ready for MLS"],
      ];
  const nav = ["Home", "Pipeline", "Listings", "Diary"];

  return (
    <div className="grid min-h-[22rem] grid-cols-[7.5rem_1fr] sm:grid-cols-[9.5rem_1fr]">
      <aside className="border-r border-[var(--border)] bg-[var(--surface-muted)] px-3 py-4">
        <BrandMark
          className="px-2 text-sm text-[var(--foreground)]"
          accentClassName="text-[var(--accent)]"
        />
        <ul className="mt-5 space-y-1">
          {nav.map((item, index) => (
            <li key={item}>
              <span
                className={cn(
                  "block rounded-lg px-2 py-1.5 text-xs font-medium",
                  index === 0
                    ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-soft)]"
                    : "text-[var(--muted)]",
                )}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Today
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stats.map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3"
            >
              <p className="font-display text-2xl leading-none">{value}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {rows.map(([address, meta, status]) => (
            <li
              key={address}
              className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{address}</p>
                <p className="text-xs text-[var(--muted)]">{meta}</p>
              </div>
              <span className="w-fit shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Website({ uk }: { uk: boolean }) {
  const listings = uk
    ? [
        ["14 Elm Grove", "For sale", "£725,000"],
        ["8 Harbour Street", "To let", "£2,400 pcm"],
        ["Flat 2, Quay Walk", "Under offer", "£540,000"],
      ]
    : [
        ["14 Elm Street", "For sale", "$925,000"],
        ["8 Harbor Avenue", "For lease", "$3,200 / mo"],
        ["Unit 2, Quay Walk", "Pending", "$610,000"],
      ];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <p className="font-display text-lg">Harbour & Co</p>
        <span className="rounded-full bg-[var(--foreground)] px-3 py-1 text-[11px] font-semibold text-[var(--canvas)]">
          Book a valuation
        </span>
      </div>
      <div className="bg-[var(--ink)] px-5 py-8 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
          {uk ? "Sales and lettings" : "Sales and leases"}
        </p>
        <p className="mt-2 max-w-sm font-display text-3xl leading-[1.05]">
          Homes across the harbour.
        </p>
      </div>
      <ul className="grid gap-px bg-[var(--border)] sm:grid-cols-3">
        {listings.map(([address, status, price]) => (
          <li key={address} className="bg-[var(--surface-elevated)] p-4">
            <div className="h-16 rounded-xl bg-[var(--surface-muted)]" />
            <p className="mt-3 text-sm font-semibold">{address}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{status}</p>
            <p className="mt-2 text-sm font-medium">{price}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Portal({ uk }: { uk: boolean }) {
  const steps = uk
    ? ["Valuation", "Live", "Viewings", "Offer"]
    : ["Valuation", "Live", "Showings", "Offer"];

  return (
    <div className="p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Your property
      </p>
      <h3 className="mt-2 font-display text-3xl leading-none">
        {uk ? "14 Elm Grove" : "14 Elm Street"}
      </h3>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {uk ? "Offer accepted · survey booked Thursday" : "Offer accepted · inspection booked Thursday"}
      </p>
      <ol className="mt-6 grid grid-cols-4 gap-2">
        {steps.map((step, index) => (
          <li key={step}>
            <span
              className={cn(
                "block h-1.5 rounded-full",
                index < 3 ? "bg-[var(--accent)]" : "bg-[var(--surface-muted)]",
              )}
            />
            <p className="mt-2 text-[11px] font-medium text-[var(--muted)]">{step}</p>
          </li>
        ))}
      </ol>
      <ul className="mt-6 space-y-2">
        {[
          "3 documents shared",
          uk ? "Viewing confirmed, Thursday 14:00" : "Showing confirmed, Thursday 2:00",
          "Message from the office waiting",
        ].map((item) => (
          <li
            key={item}
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

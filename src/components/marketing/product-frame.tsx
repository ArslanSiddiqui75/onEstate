import { BrandMark } from "@/components/brand/brand-mark";
import { getActiveBrand } from "@/lib/brand/config";
import { cn } from "@/lib/utils";

type Variant = "desk" | "enquiry" | "progression" | "diary" | "vendor" | "buyer" | "landlord" | "tenant";

export function ProductFrame({
  variant = "desk",
  className,
  uk = getActiveBrand().market === "uk",
}: {
  variant?: Variant;
  className?: string;
  uk?: boolean;
}) {
  const titles: Record<Variant, string> = {
    desk: "Today",
    enquiry: "Enquiry centre",
    progression: uk ? "Progression" : "Progression",
    diary: uk ? "Diary" : "Calendar",
    vendor: uk ? "Vendor link" : "Seller link",
    buyer: "Buyer link",
    landlord: "Landlord link",
    tenant: uk ? "Tenant link" : "Resident link",
  };

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
        <p className="ml-2 truncate text-xs text-[var(--muted)]">{titles[variant]}</p>
      </div>
      {variant === "desk" ? <Desk uk={uk} /> : null}
      {variant === "enquiry" ? <Enquiry uk={uk} /> : null}
      {variant === "progression" ? <Progression uk={uk} /> : null}
      {variant === "diary" ? <Diary uk={uk} /> : null}
      {variant === "vendor" || variant === "buyer" || variant === "landlord" || variant === "tenant" ? (
        <Client variant={variant} uk={uk} />
      ) : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[22rem] p-4 sm:p-5">{children}</div>;
}

function Desk({ uk }: { uk: boolean }) {
  const rows = uk
    ? [
        ["New enquiry", "14 Elm Grove", "Website"],
        ["Viewing 14:00", "14 Elm Grove", "Confirmed"],
        ["Offer in", "8 Harbour Street", "£425,000"],
      ]
    : [
        ["New enquiry", "14 Elm Street", "Website"],
        ["Showing 2:00", "14 Elm Street", "Confirmed"],
        ["Offer in", "8 Harbor Avenue", "$640,000"],
      ];
  return (
    <div className="grid min-h-[22rem] grid-cols-[7.5rem_1fr] sm:grid-cols-[9.5rem_1fr]">
      <aside className="border-r border-[var(--border)] bg-[var(--surface-muted)] px-3 py-4">
        <BrandMark className="w-full max-w-[7.5rem] text-[13px]" />
        <ul className="mt-5 space-y-1 text-xs font-medium">
          {["Today", "Enquiries", uk ? "Diary" : "Calendar", "Deals"].map((item, index) => (
            <li
              key={item}
              className={cn(
                "rounded-lg px-2 py-1.5",
                index === 0 ? "bg-[var(--surface-elevated)] shadow-[var(--shadow-soft)]" : "text-[var(--muted)]",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <div className="p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Harbour & Co</p>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {rows.map(([title, address, meta]) => (
            <li key={title} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-[var(--muted)]">{address}</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {meta}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Enquiry({ uk }: { uk: boolean }) {
  const rows = uk
    ? [
        ["Sam Okonkwo", "Buyer", "Rightmove", "Call today"],
        ["Helen Croft", "Landlord", "Website", "Book valuation"],
        ["Alex Harbour", "Vendor", "Office", "Approve listing"],
      ]
    : [
        ["Sam Okonkwo", "Buyer", "Website", "Call today"],
        ["Helen Croft", "Landlord", "Referral", "Book valuation"],
        ["Alex Harbour", "Seller", "Office", "Approve listing"],
      ];
  return (
    <Shell>
      <p className="text-sm font-semibold">Open enquiries</p>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {rows.map(([name, type, source, next]) => (
          <li key={name} className="grid grid-cols-2 gap-2 py-3 text-sm sm:grid-cols-4">
            <span className="font-medium">{name}</span>
            <span className="text-[var(--muted)]">{type}</span>
            <span className="text-[var(--muted)]">{source}</span>
            <span className="font-medium text-[var(--accent)]">{next}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Progression({ uk }: { uk: boolean }) {
  const stages = uk
    ? ["Listed", "Viewing", "Offer", "Progressing", "Exchanged"]
    : ["Listed", "Showing", "Offer", "Progressing", "Closed"];
  return (
    <Shell>
      <p className="text-sm font-semibold">14 Elm Grove</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{uk ? "£725,000 · Alex Harbour" : "$890,000 · Alex Harbour"}</p>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stages.map((stage, index) => (
          <li
            key={stage}
            className={cn(
              "rounded-xl px-2 py-2 text-center text-[11px] font-semibold",
              index <= 2 ? "bg-[var(--accent-soft)] text-[var(--foreground)]" : "bg-[var(--surface-muted)] text-[var(--muted)]",
            )}
          >
            {stage}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm">Fee requested · £4,500. Referral agreed · Harbour Introductions.</p>
    </Shell>
  );
}

function Diary({ uk }: { uk: boolean }) {
  const rows = uk
    ? [
        ["14:00", "Viewing", "14 Elm Grove", "Confirmed"],
        ["10:30", "Valuation", "Flat 2, Quay Walk", "Requested"],
      ]
    : [
        ["2:00", "Showing", "14 Elm Street", "Confirmed"],
        ["10:30", "Valuation", "Unit 2, Quay Walk", "Requested"],
      ];
  return (
    <Shell>
      <p className="text-sm font-semibold">Thursday</p>
      <ul className="mt-3 space-y-2">
        {rows.map(([time, kind, address, status]) => (
          <li key={time} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-muted)] px-3 py-3">
            <div>
              <p className="text-sm font-semibold">{time} · {kind}</p>
              <p className="text-xs text-[var(--muted)]">{address}</p>
            </div>
            <span className="text-[11px] font-semibold text-[var(--accent)]">{status}</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Client({ variant, uk }: { variant: "vendor" | "buyer" | "landlord" | "tenant"; uk: boolean }) {
  const copy = {
    vendor: {
      title: uk ? "Approve 14 Elm Grove" : "Approve 14 Elm Street",
      lines: ["Feedback from two viewings", "Sale at offer"],
      action: "Approve the listing",
    },
    buyer: {
      title: uk ? "Book 14 Elm Grove" : "Book 14 Elm Street",
      lines: ["Thursday 14:00 is open", "Offer form on the same page"],
      action: uk ? "Request a viewing" : "Request a showing",
    },
    landlord: {
      title: "12 Oak Road",
      lines: ["Rent received £1,250", "Kitchen tap booked"],
      action: "Approve the repair",
    },
    tenant: {
      title: "12 Oak Road, Flat 2",
      lines: ["No account needed", "Reply-by and fix-by clocks"],
      action: "Report a repair",
    },
  }[variant];
  return (
    <Shell>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Your link</p>
      <h3 className="mt-2 font-display text-2xl tracking-tight">{copy.title}</h3>
      <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        {copy.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <span className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]">
        {copy.action}
      </span>
    </Shell>
  );
}

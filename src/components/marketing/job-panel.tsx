"use client";

import { useState } from "react";
import { ProductFrame } from "@/components/marketing/product-frame";
import { cn } from "@/lib/utils";

type Frame = "desk" | "enquiry" | "progression" | "diary" | "vendor" | "buyer" | "landlord" | "tenant";

export function JobPanel({
  jobs,
  uk,
}: {
  jobs: { id: string; title: string; body: string; frame: Frame }[];
  uk: boolean;
}) {
  const [active, setActive] = useState(0);
  const job = jobs[active] ?? jobs[0];
  if (!job) return null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
      <div role="tablist" aria-label="Jobs on the desk">
        {jobs.map((item, index) => {
          const selected = index === active;
          return (
            <div key={item.id} className="border-b border-[var(--border)] py-5">
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(index)}
                className="block w-full text-left"
              >
                <span
                  className={cn(
                    "block font-sans text-[1.65rem] font-semibold tracking-[-0.03em] sm:text-3xl",
                    selected ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                  )}
                >
                  {item.title}
                </span>
                {selected ? (
                  <span className="mt-3 block max-w-md text-sm leading-relaxed text-[var(--muted)]">{item.body}</span>
                ) : null}
              </button>
              {selected ? (
                <a href="#contact" className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)]">
                  Book a demo →
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="rounded-[1.75rem] bg-[var(--accent-soft)] p-3 sm:p-5">
        <ProductFrame variant={job.frame} uk={uk} />
      </div>
    </div>
  );
}

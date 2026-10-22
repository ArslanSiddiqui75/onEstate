"use client";

import { useState } from "react";
import { ProductFrame } from "@/components/marketing/product-frame";
import { cn } from "@/lib/utils";

type Story = { id: string; eyebrow: string; title: string; body: string };
type Frame = "enquiry" | "progression" | "diary";

const frames: Frame[] = ["enquiry", "progression", "diary"];

export function StorySwitch({ stories, uk = true }: { stories: Story[]; uk?: boolean }) {
  const [active, setActive] = useState(0);
  const story = stories[active] ?? stories[0];
  const frame = frames[active] ?? "enquiry";
  if (!story) return null;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Workflows">
          {stories.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold",
                index === active
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--surface-muted)] text-[var(--muted)]",
              )}
            >
              {item.eyebrow}
            </button>
          ))}
        </div>
        <p className="mt-8 eyebrow">{story.eyebrow}</p>
        <h2 className="mt-3 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">{story.title}</h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">{story.body}</p>
      </div>
      <ProductFrame variant={frame} uk={uk} />
    </div>
  );
}

export function ClientSwitch({
  clients,
  uk = true,
}: {
  clients: { id: string; title: string; body: string }[];
  uk?: boolean;
}) {
  const [active, setActive] = useState(0);
  const client = clients[active] ?? clients[0];
  const frames = ["vendor", "buyer", "landlord", "tenant"] as const;
  if (!client) return null;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <ProductFrame variant={frames[active] ?? "vendor"} uk={uk} />
      <div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Clients">
          {clients.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold",
                index === active
                  ? "bg-[var(--foreground)] text-[var(--surface-solid)]"
                  : "bg-[var(--surface-muted)] text-[var(--muted)]",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        <h2 className="mt-8 font-display text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.05]">{client.title}</h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)]">{client.body}</p>
      </div>
    </div>
  );
}

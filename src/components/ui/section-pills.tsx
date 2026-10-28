"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function pillClass(active: boolean) {
  return cn(
    "rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap",
    active
      ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(20,17,15,0.08)]"
      : "text-[var(--muted)]",
  );
}

function PillTrack({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0">
      <div className="overflow-x-auto">
        <div
          className="inline-flex w-max rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1"
          role="tablist"
          aria-label={label}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SectionPills<T extends string>({
  items,
  value,
  onChange,
  label = "Section",
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  return (
    <PillTrack label={label}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={pillClass(active)}
          >
            {item.label}
          </button>
        );
      })}
    </PillTrack>
  );
}

export function SectionPillLinks({
  items,
  isActive,
  label = "Section",
}: {
  items: { href: string; label: string }[];
  isActive: (href: string) => boolean;
  label?: string;
}) {
  return (
    <PillTrack label={label}>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={pillClass(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </PillTrack>
  );
}

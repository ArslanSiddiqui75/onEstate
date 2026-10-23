"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/brand/brand-provider";
import type { BrandConfig } from "@/lib/brand/config";

export function StreetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-[1.15em] w-[1.15em] shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#114740" />
      <path
        d="M16 5.4c-3.35 0-5.9 2.55-5.9 5.85 0 4.35 5.9 9.35 5.9 9.35s5.9-5 5.9-9.35c0-3.3-2.55-5.85-5.9-5.85z"
        fill="#F4F1EA"
      />
      <circle cx="16" cy="11.15" r="1.85" fill="#114740" />
      <path d="M7.25 24.15h17.5" stroke="#F4F1EA" strokeWidth="2.05" strokeLinecap="round" />
    </svg>
  );
}

export function BrandMark({
  brand,
  className,
  accentClassName = "text-[var(--accent)]",
  showMark = true,
}: {
  brand?: BrandConfig;
  className?: string;
  accentClassName?: string;
  showMark?: boolean;
}) {
  const contextBrand = useBrand();
  const active = brand ?? contextBrand;
  return (
    <span className={cn("inline-flex items-center gap-[0.45em] font-sans font-semibold tracking-[-0.04em] [font-feature-settings:'zero'_1]", className)}>
      {showMark ? <StreetMark /> : null}
      <span>
        0ne
        <span className={accentClassName}>{active.suffix}</span>
      </span>
    </span>
  );
}

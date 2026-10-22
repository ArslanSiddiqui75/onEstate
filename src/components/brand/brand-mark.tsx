"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/brand/brand-provider";
import type { BrandConfig } from "@/lib/brand/config";

export function StreetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0c6e63" />
      <path
        d="M7 12.5h11a5 5 0 0 1 5 5V25"
        fill="none"
        stroke="#f4fbf8"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="12.5" r="2.15" fill="#f4fbf8" />
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
    <span className={cn("inline-flex items-center gap-[0.4em] font-display tracking-[-0.045em]", className)}>
      {showMark ? <StreetMark className="h-[1.2em] w-[1.2em]" /> : null}
      <span>
        0ne
        <span className={accentClassName}>{active.suffix}</span>
      </span>
    </span>
  );
}

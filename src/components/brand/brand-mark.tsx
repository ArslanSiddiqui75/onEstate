"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/components/brand/brand-provider";
import type { BrandConfig } from "@/lib/brand/config";

export function StreetMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/mark.png"
      alt=""
      aria-hidden
      className={cn("h-[1.65em] w-[1.65em] shrink-0", className)}
    />
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
      {showMark ? <StreetMark className="h-[1.65em] w-[1.65em]" /> : null}
      <span>
        0ne
        <span className={accentClassName}>{active.suffix}</span>
      </span>
    </span>
  );
}

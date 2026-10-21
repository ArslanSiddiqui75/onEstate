import { cn } from "@/lib/utils";
import { getActiveBrand, type BrandConfig } from "@/lib/brand/config";

export function BrandMark({
  brand,
  className,
  accentClassName = "text-[var(--accent-on-ink)]",
}: {
  brand?: BrandConfig;
  className?: string;
  accentClassName?: string;
}) {
  const active = brand ?? getActiveBrand();
  return (
    <span className={cn("font-display tracking-tight", className)}>
      Certified
      <span className={accentClassName}>{active.suffix}</span>
    </span>
  );
}

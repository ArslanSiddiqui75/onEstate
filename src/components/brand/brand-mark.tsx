import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand/config";

type Tone = "auto" | "light" | "dark";

/**
 * Light surfaces use the dark-green OneStreet lockup.
 * Dark surfaces — dark theme, the ink footer, and the ink sidebar — use the
 * bright lockup. `auto` follows the active theme.
 */
export function BrandMark({
  className,
  tone = "auto",
}: {
  brand?: BrandConfig;
  className?: string;
  accentClassName?: string;
  showMark?: boolean;
  tone?: Tone;
}) {
  return (
    <span
      className={cn("brand-mark inline-flex items-center leading-none", className)}
      data-tone={tone}
      role="img"
      aria-label="OneStreet"
    >
      <img
        src="/brand/logo-light.png"
        alt=""
        width={1292}
        height={331}
        className="brand-logo-light"
        draggable={false}
      />
      <img
        src="/brand/logo-dark.png"
        alt=""
        width={1359}
        height={354}
        className="brand-logo-dark"
        draggable={false}
      />
    </span>
  );
}

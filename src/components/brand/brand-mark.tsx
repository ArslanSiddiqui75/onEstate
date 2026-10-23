import { cn } from "@/lib/utils";
import type { BrandConfig } from "@/lib/brand/config";

type Tone = "auto" | "light" | "dark";

/**
 * Wordmark for the current theme. `auto` follows `.dark`.
 * Pass `dark` on surfaces that stay ink-colored, such as the admin sidebar.
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
      aria-label="0neStreet"
    >
      {tone !== "dark" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/logo-light.png" alt="" className="brand-mark-light" />
      ) : null}
      {tone !== "light" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/logo-dark.png" alt="" className="brand-mark-dark" />
      ) : null}
    </span>
  );
}

"use client";

import { cn } from "@/lib/utils";

/** The 3D house, lifting slightly. The picture itself is not tilted. */
export function LogoLoader({
  label,
  layout = "screen",
}: {
  label?: string;
  layout?: "screen" | "pane" | "compact";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex flex-col items-center justify-center",
        layout === "screen" && "min-h-dvh bg-[var(--canvas)]",
        layout === "pane" && "min-h-[70vh]",
        layout === "compact" && "py-10",
      )}
    >
      {layout === "screen" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(12,110,99,0.09),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(23,186,168,0.12),transparent_58%)]"
        />
      ) : null}
      <div className="relative">
        <div aria-hidden className="absolute bottom-[8%] left-1/2 h-8 w-36 -translate-x-1/2">
          <div className="logo-loader-glow h-full w-full rounded-full bg-[var(--accent)]/50 blur-xl" />
        </div>
        <div className="logo-loader-mark relative">
          <img
            src="/brand/loader-mark-light.webp"
            alt=""
            width={537}
            height={687}
            draggable={false}
            className={cn(
              "relative h-auto w-[8.75rem] dark:hidden",
              layout === "compact" && "w-24",
            )}
          />
          <img
            src="/brand/loader-mark-dark.webp"
            alt=""
            width={553}
            height={725}
            draggable={false}
            className={cn(
              "relative hidden h-auto w-[8.75rem] dark:block",
              layout === "compact" && "w-24",
            )}
          />
        </div>
      </div>
      {label ? (
        <p className="relative mt-6 text-sm font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

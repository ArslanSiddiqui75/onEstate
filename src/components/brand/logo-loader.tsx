"use client";

import { cn } from "@/lib/utils";

/** The house mark, held still and sharp, with a quiet glow behind it. */
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
      <div className="logo-loader-mark relative">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
          <div className="logo-loader-glow h-full w-full rounded-full bg-[var(--accent)]/25 blur-2xl" />
        </div>
        <img
          src="/brand/mark.png"
          alt=""
          width={291}
          height={322}
          draggable={false}
          className={cn(
            "relative h-auto w-[4.5rem] dark:hidden",
            layout === "compact" && "w-14",
          )}
        />
        <img
          src="/brand/mark-dark.png"
          alt=""
          width={304}
          height={345}
          draggable={false}
          className={cn(
            "relative hidden h-auto w-[4.5rem] dark:block",
            layout === "compact" && "w-14",
          )}
        />
      </div>
      {label ? (
        <p className="relative mt-6 text-sm font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

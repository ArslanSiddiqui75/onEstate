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
        layout === "screen" && "fixed inset-0 z-[300] bg-[var(--canvas)]",
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
      <div
        className={cn(
          "logo-loader-mark relative",
          layout === "compact" ? "h-24 w-24" : "h-[11.25rem] w-[9.5rem]",
        )}
      >
        <img
          src="/brand/loader-mark-light.webp"
          alt=""
          width={512}
          height={601}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain dark:hidden"
        />
        <img
          src="/brand/loader-mark-dark.webp"
          alt=""
          width={524}
          height={706}
          draggable={false}
          className="absolute inset-0 hidden h-full w-full object-contain dark:block"
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

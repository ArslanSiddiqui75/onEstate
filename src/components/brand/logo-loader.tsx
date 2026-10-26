"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The house mark, assembled for a loading screen.
 * The cap, wall, and roof come in once. The windows keep a quiet pulse.
 */
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
        <div aria-hidden className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
          <div className="logo-loader-glow h-full w-full rounded-full bg-[var(--accent)]/25 blur-2xl" />
        </div>
        <HouseMark className={layout === "compact" ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem]"} />
      </div>
      {label ? (
        <p className="relative mt-6 text-sm font-medium tracking-[-0.01em] text-[var(--muted)]">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}

function HouseMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const body = `${id}-body`;
  const light = `${id}-light`;
  const clip = `${id}-clip`;

  return (
    <svg
      viewBox="0 0 292 322"
      className={cn("relative overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="58%" stopColor="#14958a" />
          <stop offset="100%" stopColor="#7dccc2" />
        </linearGradient>
        <linearGradient id={light} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8fffb" />
          <stop offset="100%" stopColor="#7dccc2" />
        </linearGradient>
        <clipPath id={clip}>
          <polygon points="149,2 150,96 68,122 0,84" />
          <polygon points="68,118 150,98 150,278 68,322" />
          <polygon points="156,90 168,132 248,198 248,276 290,258 290,164 214,128 172,96" />
        </clipPath>
      </defs>

      <g className="logo-loader-mark">
        <g className="logo-loader-cap">
          <polygon points="149,2 150,96 68,122 0,84" fill={`url(#${body})`} />
          <polygon points="149,2 150,48 96,78 28,52" fill="white" opacity="0.28" />
        </g>
        <polygon className="logo-loader-wall" points="68,118 150,98 150,278 68,322" fill={`url(#${body})`} />
        <polygon
          className="logo-loader-roof"
          points="156,90 168,132 248,198 248,276 290,258 290,164 214,128 172,96"
          fill={`url(#${body})`}
        />
        <g fill={`url(#${light})`}>
          <rect className="logo-loader-window" x="166" y="198" width="22" height="18" rx="2" style={{ animationDelay: "0.72s, 1.35s" }} />
          <rect className="logo-loader-window" x="194" y="198" width="22" height="18" rx="2" style={{ animationDelay: "0.86s, 1.7s" }} />
          <rect className="logo-loader-window" x="166" y="224" width="22" height="18" rx="2" style={{ animationDelay: "1s, 2.05s" }} />
          <rect className="logo-loader-window" x="194" y="224" width="22" height="18" rx="2" style={{ animationDelay: "1.14s, 2.4s" }} />
        </g>
        <g clipPath={`url(#${clip})`}>
          <rect
            className="logo-loader-sheen"
            x="-80"
            y="-20"
            width="70"
            height="380"
            fill="white"
            opacity="0.28"
          />
        </g>
      </g>
    </svg>
  );
}

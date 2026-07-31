import * as React from "react";
import { cn } from "@/lib/utils";

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  }
>(({ className, tone = "neutral", ...props }, ref) => {
  const tones = {
    neutral:
      "bg-[var(--surface-muted)] text-[var(--foreground)] border-[var(--border)]",
    success: "bg-[var(--success-soft)] text-[var(--success)] border-transparent",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
    danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-transparent",
  };

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

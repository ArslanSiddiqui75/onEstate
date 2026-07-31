import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: {
    wrap: "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
    icon: "text-[var(--muted)]",
    Icon: Info,
  },
  success: {
    wrap: "border-transparent bg-[var(--success-soft)] text-[var(--success)]",
    icon: "text-[var(--success)]",
    Icon: CheckCircle2,
  },
  warning: {
    wrap: "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]",
    icon: "text-[var(--warning)]",
    Icon: AlertTriangle,
  },
  danger: {
    wrap: "border-transparent bg-[var(--danger-soft)] text-[var(--danger)]",
    icon: "text-[var(--danger)]",
    Icon: XCircle,
  },
} as const;

export function Alert({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  const Icon = config.Icon;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-[0.85rem] border px-3.5 py-3 text-sm",
        config.wrap,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.icon)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

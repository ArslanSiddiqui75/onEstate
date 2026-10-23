"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";

const TONE_CHIP = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--foreground)]",
};

function RegionLine({
  code,
  value,
  detail,
}: {
  code: "UK" | "US";
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{code}</span>
      {detail != null ? (
        <span className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-baseline gap-3">
          <span className="text-right font-display text-xl leading-none tracking-tight whitespace-nowrap tabular-nums">
            {value}
          </span>
          <span className="text-right text-[11px] font-medium text-[var(--muted)]">{detail}</span>
        </span>
      ) : (
        <span className="text-right font-display text-xl leading-none tracking-tight whitespace-nowrap tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

export function RegionPair({
  uk,
  us,
  ukDetail,
  usDetail,
}: {
  uk: ReactNode;
  us: ReactNode;
  ukDetail?: ReactNode;
  usDetail?: ReactNode;
}) {
  return (
    <div className="mt-1 divide-y divide-[var(--border)]" data-stacked-values="true">
      <RegionLine code="UK" value={uk} detail={ukDetail} />
      <RegionLine code="US" value={us} detail={usDetail} />
    </div>
  );
}

export function MetricCard({
  label,
  icon: Icon,
  tone,
  uk,
  us,
  className,
}: {
  label: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_CHIP;
  uk: ReactNode;
  us: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={cn("data-card data-card-hover flex h-full flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
        <span className={cn("stat-icon-chip h-9 w-9 rounded-[0.7rem]", TONE_CHIP[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <RegionPair uk={uk} us={us} />
    </motion.div>
  );
}

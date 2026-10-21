"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";

const TONE_CHIP: Record<string, string> = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--foreground)]",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "accent",
  trend,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: "accent" | "success" | "warning" | "danger" | "neutral";
  trend?: { value: number; label?: string };
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn("data-card data-card-hover p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </p>
        {Icon ? (
          <span className={cn("stat-icon-chip h-9 w-9 rounded-[0.7rem]", TONE_CHIP[tone])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-[1.85rem] leading-none tracking-tight">
        {value}
      </p>
      {(trend || sub) ? (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                trend.value >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
              )}
            >
              {trend.value >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(trend.value)}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          ) : null}
          {sub ? <span className="text-[var(--muted)]">{sub}</span> : null}
        </div>
      ) : null}
    </motion.div>
  );
}

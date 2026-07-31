"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="stat-icon-chip mt-0.5 h-11 w-11 rounded-[0.9rem]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className={cn("font-display text-3xl tracking-tight", eyebrow && "mt-1.5")}>
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </motion.div>
  );
}

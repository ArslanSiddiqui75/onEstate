"use client";

import { motion } from "framer-motion";

export function MiniBars({
  values,
  className,
  tone = "accent",
}: {
  values: number[];
  className?: string;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  };
  const max = Math.max(1, ...values);
  return (
    <div className={`flex h-8 items-end gap-[3px] ${className || ""}`} aria-hidden>
      {values.map((v, i) => (
        <motion.span
          key={i}
          className="w-1.5 rounded-full"
          style={{ background: colors[tone], opacity: 0.35 + (v / max) * 0.65 }}
          initial={{ height: 0 }}
          animate={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

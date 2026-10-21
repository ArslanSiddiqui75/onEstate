import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover = false,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  tone?: "default" | "ink" | "muted";
}) {
  return (
    <div
      className={cn(
        "data-card p-5",
        hover && "data-card-hover",
        tone === "ink" && "data-card-ink",
        tone === "muted" && "border-transparent bg-[var(--surface-muted)] shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h2 className="font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

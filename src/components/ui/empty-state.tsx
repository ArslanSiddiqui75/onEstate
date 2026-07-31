import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-6 py-20 text-center",
        className,
      )}
    >
      <h3 className="font-display text-2xl tracking-tight text-[var(--foreground)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

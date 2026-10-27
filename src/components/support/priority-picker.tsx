"use client";

import { SUPPORT_PRIORITIES } from "@/lib/support/book";
import { cn } from "@/lib/utils";
import type { TicketPriority } from "@/lib/admin/ticket-desk";

export function PriorityPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TicketPriority;
  onChange: (priority: TicketPriority) => void;
  disabled?: boolean;
}) {
  const current = SUPPORT_PRIORITIES.find((option) => option.id === value) ?? SUPPORT_PRIORITIES[1];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Priority">
        {SUPPORT_PRIORITIES.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                selected && option.id === "high" && "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
                selected && option.id !== "high" && "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]",
                !selected && "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{current.detail}</p>
    </div>
  );
}

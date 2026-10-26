"use client";

import { formatPlanPrice } from "@/lib/brand/offer";
import { PLANS } from "@/lib/plans/catalog";
import { cn } from "@/lib/utils";
import type { Market, PlanId } from "@/types";

const PLAN_ORDER: PlanId[] = ["solo", "team", "enterprise"];

export function PlanPicker({
  plan,
  market,
  onChange,
  error,
}: {
  plan: PlanId;
  market: Market;
  onChange: (plan: PlanId) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--foreground)]">
        Plan
        <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
          *
        </span>
      </legend>
      <div className="grid gap-2">
        {PLAN_ORDER.map((id) => {
          const item = PLANS[id];
          const price = formatPlanPrice(market, id);
          const selected = plan === id;
          return (
            <label
              key={id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 transition",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="sr-only"
              />
              <span>
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{item.seats}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">
                {id === "enterprise" ? price : `${price}/mo`}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="text-xs font-medium text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

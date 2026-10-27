"use client";

import { Suspense } from "react";
import { CrmDesk } from "@/app/app/(workspace)/crm/page";
import { DealsBoard } from "@/app/app/(workspace)/transactions/page";
import { useModuleSection } from "@/lib/nav/module-section";
import { cn } from "@/lib/utils";

function Opportunities() {
  const [section, setSection] = useModuleSection("view", ["pipeline", "deals"] as const, "pipeline");

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Website, portal, and office enquiries arrive here as new opportunities, with the source, the property, and the next step.
      </p>
      <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1">
        <button
          type="button"
          onClick={() => setSection("pipeline")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold",
            section === "pipeline"
              ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(20,17,15,0.08)]"
              : "text-[var(--muted)]",
          )}
        >
          Pipeline
        </button>
        <button
          type="button"
          onClick={() => setSection("deals")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold",
            section === "deals"
              ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(20,17,15,0.08)]"
              : "text-[var(--muted)]",
          )}
        >
          Deals
        </button>
      </div>
      {section === "deals" ? <DealsBoard /> : <CrmDesk view="pipeline" />}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <Opportunities />
    </Suspense>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrmDesk } from "@/app/app/(workspace)/crm/page";
import { DealsBoard } from "@/app/app/(workspace)/transactions/page";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { cn } from "@/lib/utils";

function Opportunities() {
  const params = useSearchParams();
  const { user, org } = useAppSession();
  const canDeals = user && org ? hasModuleAccess(user.role, org.plan, "transactions", "view") : false;
  const [section, setSection] = useState<"pipeline" | "deals">(
    params.get("view") === "deals" && canDeals ? "deals" : "pipeline",
  );

  return (
    <div className="space-y-5">
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
        {canDeals ? (
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
        ) : null}
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

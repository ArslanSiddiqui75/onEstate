"use client";

import { Suspense } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { LettingsDesk } from "@/components/lettings/lettings-desk";

export default function LettingsPage() {
  const { user, org, market } = useAppSession();
  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Lettings locked"
        reason="The landlord desk follows CRM access."
        role={user.role}
        plan={org.plan}
      />
    );
  }

  if (market !== "uk") {
    return (
      <div className="max-w-xl space-y-3">
        <h2 className="font-semibold">Lettings isn’t available here</h2>
        <p className="text-sm text-[var(--muted)]">
          Repairs, rent, and keys are part of a UK workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <LettingsDesk orgId={org.id} canEdit={hasModuleAccess(user.role, org.plan, "crm", "edit")} />
      </Suspense>
    </div>
  );
}

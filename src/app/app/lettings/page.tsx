"use client";

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
        <h2 className="font-semibold">Lettings is a UK module</h2>
        <p className="text-sm text-[var(--muted)]">
          Repairs, rent, Right to Rent, keys, and contractor cover live on the UK setup at 0nestreet.co.uk. This US workspace keeps enquiries, showings, progression, and dollar payments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LettingsDesk orgId={org.id} canEdit={hasModuleAccess(user.role, org.plan, "crm", "edit")} />
    </div>
  );
}

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

  return (
    <div className="space-y-4">
      {market !== "uk" ? (
        <p className="text-sm text-[var(--muted)]">
          This desk follows the rules for England, Wales, and Scotland.
        </p>
      ) : null}
      <LettingsDesk orgId={org.id} canEdit={hasModuleAccess(user.role, org.plan, "crm", "edit")} />
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { AccountsPanel } from "@/components/social/social-planner";
import { OAuthReturnBanner } from "@/components/social/oauth-return-banner";
import { LockedModule } from "@/components/ui/locked-module";
import { Button } from "@/components/ui/button";

export default function SocialAccountsSettingsPage() {
  const {
    user,
    org,
    socialAccounts,
    persistence,
    upsertSocialAccount,
    deleteSocialAccount,
    getAuthToken,
  } = useAppSession();
  const [busy, setBusy] = useState(false);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "social", "view")) {
    return (
      <LockedModule
        title="Social accounts locked"
        reason="Social tools are limited for your role."
        role={user.role}
        plan={org.plan}
        module="social"
      />
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "social", "edit");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          Networks this workspace can publish to. Compose and schedule from{" "}
          <Link href="/app/social" className="text-[var(--accent)] hover:underline">
            Social
          </Link>
          .
        </p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/app/settings">Back to settings</Link>
        </Button>
      </div>
      <Suspense fallback={null}>
        <OAuthReturnBanner />
      </Suspense>
      <AccountsPanel
        accounts={socialAccounts}
        orgName={org.name}
        canEdit={canEdit}
        busy={busy}
        live={persistence === "supabase"}
        getAuthToken={getAuthToken}
        onConnect={async (input) => {
          setBusy(true);
          try {
            await upsertSocialAccount({
              ...input,
              status: "connected",
              connectedAt: new Date().toISOString(),
            });
          } finally {
            setBusy(false);
          }
        }}
        onDisconnect={async (account) => {
          setBusy(true);
          try {
            await upsertSocialAccount({
              ...account,
              status: "disconnected",
            });
          } finally {
            setBusy(false);
          }
        }}
        onRemove={async (id) => {
          setBusy(true);
          try {
            await deleteSocialAccount(id);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

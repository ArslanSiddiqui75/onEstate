"use client";

import { Suspense, useEffect, useRef } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { OAuthReturnBanner } from "@/components/social/oauth-return-banner";
import { SocialPlanner } from "@/components/social/social-planner";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

/** Hobby Vercel can't run every-few-minutes crons — flush due posts when Social opens. */
function DuePostsFlusher() {
  const { persistence, getAuthToken, refresh } = useAppSession();
  const ranRef = useRef(false);

  useEffect(() => {
    if (persistence !== "supabase" || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getAuthToken();
        if (!token || cancelled) return;
        const res = await fetch("/api/social/publish-due", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json().catch(() => ({}))) as { processed?: number };
        if ((json.processed || 0) > 0 && !cancelled) {
          await refresh();
        }
      } catch {
        // Non-fatal — manual Publish / external cron still work
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistence, getAuthToken, refresh]);

  return null;
}

export default function AppSocialPage() {
  const {
    user,
    org,
    listings,
    socialAccounts,
    socialPosts,
    persistence,
    createSocialPost,
    updateSocialPost,
    deleteSocialPost,
    getAuthToken,
    publishSocialPostNow,
    market,
  } = useAppSession();

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "social", "view")) {
    return (
      <LockedModule
        title="Social locked"
        reason="Social tools are limited for your role."
        role={user.role}
        plan={org.plan}
        module="social"
      />
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "social", "edit");
  const flags = PLAN_FEATURE_FLAGS[org.plan];

  return (
    <div className="space-y-4">
      <DuePostsFlusher />
      <Suspense fallback={null}>
        <OAuthReturnBanner />
      </Suspense>
      <SocialPlanner
        posts={socialPosts}
        accounts={socialAccounts}
        listings={listings}
        market={market}
        canEdit={canEdit}
        live={persistence === "supabase"}
        getAuthToken={getAuthToken}
        onPublishNow={publishSocialPostNow}
        planHint={
          flags.autoListingPosts
            ? "Auto listing-to-post is enabled on your plan. Due posts also flush when you open this page."
            : "Manual scheduling on your plan — ask your Owner to upgrade for auto listing-to-post."
        }
        onCreate={createSocialPost}
        onUpdate={updateSocialPost}
        onDelete={deleteSocialPost}
      />
    </div>
  );
}

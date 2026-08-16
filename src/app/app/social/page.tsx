"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { SocialPlanner } from "@/components/social/social-planner";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";
import { PLATFORM_LABEL } from "@/lib/social/media";
import type { SocialPlatform } from "@/types";

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

function OAuthReturnBanner() {
  const searchParams = useSearchParams();
  const { refresh } = useAppSession();
  const [banner, setBanner] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    const connected = searchParams.get("social_connected");
    const count = searchParams.get("count");
    const error = searchParams.get("social_error");

    if (!connected && !error) return;
    handledRef.current = true;

    if (connected) {
      const label = PLATFORM_LABEL[connected as SocialPlatform] || connected;
      const n = Number(count || 1);
      setBanner({
        tone: "success",
        message: `Connected ${n} ${label} ${n === 1 ? "account" : "accounts"}.`,
      });
      void refresh();
    } else if (error) {
      setBanner({
        tone: "danger",
        message: error,
      });
    }

    // Safely clear the query params and #_ fragment from the URL bar without triggering Next.js routing loops
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams, refresh]);

  if (!banner) return null;

  return (
    <div
      className={
        banner.tone === "success"
          ? "flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--success)]/30 bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]"
          : "flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
      }
    >
      <span>{banner.message}</span>
      <button
        type="button"
        onClick={() => setBanner(null)}
        className="text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss banner"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function AppSocialPage() {
  const {
    user,
    org,
    listings,
    socialAccounts,
    socialPosts,
    persistence,
    upsertSocialAccount,
    deleteSocialAccount,
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
        href="/app/billing"
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
        orgName={org.name}
        market={market}
        canEdit={canEdit}
        live={persistence === "supabase"}
        getAuthToken={getAuthToken}
        onPublishNow={publishSocialPostNow}
        planHint={
          flags.autoListingPosts
            ? "Auto listing-to-post is enabled on your plan. On Vercel Hobby, due schedules also flush when you open this page (or use an external 5‑min ping)."
            : "Manual scheduling on your plan — upgrade for auto listing-to-post. On Vercel Hobby, due schedules flush when you open this page."
        }
        onUpsertAccount={upsertSocialAccount}
        onDeleteAccount={deleteSocialAccount}
        onCreate={createSocialPost}
        onUpdate={updateSocialPost}
        onDelete={deleteSocialPost}
      />
    </div>
  );
}

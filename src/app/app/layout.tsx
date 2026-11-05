"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSessionProvider, useAppSession } from "@/lib/app/session";
import { AppShell } from "@/components/shell/app-shell";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { sanitizeRedirectTo } from "@/lib/auth/redirect";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { LogoLoader } from "@/components/brand/logo-loader";
import { isSubscriptionSoftLocked } from "@/lib/billing/subscription-lock";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, org, loading, signOut } =
    useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute =
    pathname.startsWith("/app/login") ||
    pathname.startsWith("/app/signup") ||
    pathname.startsWith("/app/reset-password") ||
    pathname.startsWith("/app/checkout") ||
    pathname.startsWith("/app/invite");
  const softLocked = isSubscriptionSoftLocked(org?.subscriptionStatus);
  const onBilling =
    pathname.startsWith("/app/settings/billing") || pathname.startsWith("/app/onboarding");

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) {
      const redirectUrl = `/app/login?redirectTo=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
    }
    if (user && isAuthRoute && !pathname.startsWith("/app/reset-password") && !pathname.startsWith("/app/invite")) {
      // Honor the page the user originally asked for (validated in-app path).
      const params = new URLSearchParams(window.location.search);
      router.replace(sanitizeRedirectTo(params.get("redirectTo")));
    }
    if (
      user &&
      org &&
      org.onboardingCompleted === false &&
      !isAuthRoute &&
      !pathname.startsWith("/app/onboarding")
    ) {
      router.replace("/app/onboarding");
    }
    if (user && org && softLocked && !isAuthRoute && !onBilling) {
      router.replace("/app/settings/billing");
    }
  }, [user, org, loading, isAuthRoute, onBilling, softLocked, router, pathname]);

  // Auth screens render immediately. Session hydration used to block them,
  // and the workspace skeleton then stayed on screen for signed-out visitors.
  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return <LogoLoader label="Loading workspace…" />;
  }

  if (!user || !org) {
    return null;
  }

  return (
    <AppShell
      basePath="/app"
      role={user.role}
      moduleAccess={user.moduleAccess}
      plan={org.plan}
      userName={user.name}
      orgName={org.name}
      orgId={org.id}
      onSignOut={() => signOut()}
    >
      <div
        className={
          pathname === "/app/conversations" || pathname === "/app/crm"
            ? "flex min-h-0 flex-1 flex-col gap-3"
            : "space-y-3"
        }
      >
        <ImpersonationBanner />
        {softLocked ? (
          <Alert tone="warning">
            This workspace is {org.subscriptionStatus?.replace(/_/g, " ") || "paused"}.{" "}
            <Link href="/app/settings/billing" className="font-semibold underline underline-offset-2">
              Update billing
            </Link>{" "}
            to reopen the product.
          </Alert>
        ) : null}
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <Guard>{children}</Guard>
    </AppSessionProvider>
  );
}

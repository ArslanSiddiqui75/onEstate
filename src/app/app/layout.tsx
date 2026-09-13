"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSessionProvider, useAppSession } from "@/lib/app/session";
import { AppShell } from "@/components/shell/app-shell";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SkeletonPage } from "@/components/ui/skeleton";
import { sanitizeRedirectTo } from "@/lib/auth/redirect";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, org, loading, signOut, brand, persistence, authMode } =
    useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute =
    pathname.startsWith("/app/login") ||
    pathname.startsWith("/app/signup") ||
    pathname.startsWith("/app/reset-password");

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) {
      const redirectUrl = `/app/login?redirectTo=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
    }
    if (user && isAuthRoute && !pathname.startsWith("/app/reset-password")) {
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
  }, [user, org, loading, isAuthRoute, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <span className="h-2 w-2 animate-pulse-ring rounded-full bg-[var(--accent)]" />
        Loading workspace…
      </div>
    );
  }

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (!user || !org) {
    return null;
  }

  return (
    <AppShell
      basePath="/app"
      role={user.role}
      plan={org.plan}
      userName={user.name}
      orgName={org.name}
      orgId={org.id}
      onSignOut={() => signOut()}
      headerMeta={`${org.name} · ${brand.name} · ${persistence}`}
    >
      <ErrorBoundary>{children}</ErrorBoundary>
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

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSessionProvider, useAppSession } from "@/lib/app/session";
import { AppShell } from "@/components/shell/app-shell";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SkeletonPage } from "@/components/ui/skeleton";

function Guard({ children }: { children: React.ReactNode }) {
  const { user, org, loading, signOut, brand, persistence, authMode } =
    useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute =
    pathname.startsWith("/app/login") || pathname.startsWith("/app/signup");

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute) {
      const redirectUrl = `/app/login?redirectTo=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
    }
    if (user && isAuthRoute) {
      router.replace("/app");
    }
  }, [user, loading, isAuthRoute, router, pathname]);

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
      onSignOut={() => signOut()}
      headerMeta={`${brand.name} product · ${persistence} · ${authMode} auth · ${org.plan} plan`}
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

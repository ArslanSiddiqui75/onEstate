"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  ScrollText,
  LogOut,
  ShieldCheck,
  Activity,
  Users2,
  type LucideIcon,
} from "lucide-react";
import {
  AdminSessionProvider,
  useAdminSession,
} from "@/lib/admin/session";
import { BrandMark } from "@/components/brand/brand-mark";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

const PAGES: Array<{
  match: (pathname: string) => boolean;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    match: (p) => p === "/admin",
    eyebrow: "Command center",
    title: "Platform overview",
    description: "Live SaaS health across tenants, subscriptions, and seats.",
    icon: Activity,
  },
  {
    match: (p) => p === "/admin/organizations",
    eyebrow: "Tenants",
    title: "Organizations",
    description:
      "Every paying and trial tenant with plan, seats, health, and billing state.",
    icon: Building2,
  },
  {
    match: (p) => p.startsWith("/admin/organizations/"),
    eyebrow: "Tenant",
    title: "Organization",
    description: "Subscription, seats, usage, members, and operator notes.",
    icon: Building2,
  },
  {
    match: (p) => p.startsWith("/admin/subscriptions"),
    eyebrow: "Revenue",
    title: "Subscriptions",
    description: "Billing state, plan mix, and renewal risk across the SaaS base.",
    icon: CreditCard,
  },
  {
    match: (p) => p.startsWith("/admin/users"),
    eyebrow: "Directory",
    title: "Users",
    description:
      "Cross-tenant directory of brokerage members and seat occupancy.",
    icon: Users2,
  },
  {
    match: (p) => p.startsWith("/admin/audit"),
    eyebrow: "Trail",
    title: "Audit log",
    description: "Immutable operator trail for tenant and subscription changes.",
    icon: ScrollText,
  },
];

function resolvePage(
  pathname: string,
  tenantName?: string,
): {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
} {
  const page = PAGES.find((p) => p.match(pathname)) || PAGES[0];
  if (pathname.startsWith("/admin/organizations/") && tenantName) {
    return {
      ...page,
      title: tenantName,
      description: "Subscription, seats, usage, members, and operator notes.",
    };
  }
  return page;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading, signOut, getTenant } = useAdminSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.startsWith("/admin/login");

  const tenantId = pathname.startsWith("/admin/organizations/")
    ? pathname.split("/")[3]
    : undefined;
  const tenant = tenantId ? getTenant(tenantId) : undefined;

  const activePage = useMemo(
    () => resolvePage(pathname, tenant?.name),
    [pathname, tenant?.name],
  );
  const Icon = activePage.icon;

  useEffect(() => {
    if (loading) return;
    if (!admin && !isLogin) router.replace("/admin/login");
    if (admin && isLogin) router.replace("/admin");
  }, [admin, loading, isLogin, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <span className="h-2 w-2 animate-pulse-ring rounded-full bg-[var(--accent)]" />
        Loading admin console…
      </div>
    );
  }

  if (isLogin) return <>{children}</>;
  if (!admin) return null;

  return (
    <div className="h-screen overflow-hidden bg-[var(--canvas)]">
      <div className="mx-auto flex h-full max-w-[1600px] gap-4 p-3 lg:p-4">
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(165deg,#0b121a_0%,#152031_100%)] bg-[image:var(--ink-mesh),linear-gradient(165deg,#0b121a_0%,#152031_100%)] p-4 text-white shadow-[var(--shadow-ink)] lg:flex">
          <div className="flex items-center gap-2">
            <BrandMark className="text-xl text-white" />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[var(--accent-on-ink)]" aria-hidden />
            <p className="text-xs text-white/50">SaaS Admin Console</p>
          </div>

          <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const NavIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active ? "text-white" : "text-white/65 hover:bg-white/8 hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="admin-nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-white/12"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 flex h-7 w-7 items-center justify-center rounded-lg transition",
                      active
                        ? "bg-[var(--accent-gradient)] text-white shadow-[0_4px_14px_-2px_rgba(12,110,99,0.65)]"
                        : "bg-white/6 text-white/70 group-hover:bg-white/10",
                    )}
                  >
                    <NavIcon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/8 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={admin.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{admin.name}</p>
                <p className="truncate text-xs text-white/50">{admin.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold capitalize text-white/70">
                {admin.role.replace("_", " ")}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  signOut();
                  router.replace("/admin/login");
                }}
              >
                <LogOut className="h-3 w-3" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)] sm:px-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="stat-icon-chip mt-0.5 h-10 w-10 shrink-0 rounded-[0.85rem] sm:h-11 sm:w-11 sm:rounded-[0.9rem]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="eyebrow truncate">{activePage.eyebrow}</p>
                <h1 className="mt-0.5 truncate font-display text-xl tracking-tight sm:text-2xl">
                  {activePage.title}
                </h1>
                <p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">
                  {activePage.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex max-w-full flex-wrap gap-2 lg:hidden">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="surface-panel min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-[1400px]"
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminSessionProvider>
      <AdminGuard>{children}</AdminGuard>
    </AdminSessionProvider>
  );
}

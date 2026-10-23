"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  ScrollText,
  Ticket,
  UserCog,
  LogOut,
  ShieldCheck,
  Activity,
  Users2,
  Menu,
  X,
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
import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket },
  { href: "/admin/impersonate", label: "Impersonate", icon: UserCog },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

// Per-role admin console access (QA audit P1-5). Super admin sees everything;
// billing focuses on revenue, support on tenants/users/audit.
const NAV_ACCESS: Record<string, string[]> = {
  super_admin: [
    "/admin",
    "/admin/organizations",
    "/admin/subscriptions",
    "/admin/users",
    "/admin/tickets",
    "/admin/support",
    "/admin/impersonate",
    "/admin/audit",
  ],
  billing_admin: ["/admin", "/admin/organizations", "/admin/subscriptions"],
  support_admin: [
    "/admin",
    "/admin/organizations",
    "/admin/users",
    "/admin/tickets",
    "/admin/support",
    "/admin/impersonate",
    "/admin/audit",
  ],
};

function adminCanViewPath(role: string, pathname: string): boolean {
  const allowed = NAV_ACCESS[role] || [];
  if (pathname === "/admin") return allowed.includes("/admin");
  return allowed.some(
    (href) => href !== "/admin" && pathname.startsWith(href),
  );
}

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
    description: "UK and US books side by side. Each region is billed on its own Stripe account.",
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
    description: "Pause, continue, or cancel each account. UK subscriptions bill in GBP and US subscriptions in USD, on separate Stripe accounts.",
    icon: CreditCard,
  },
  {
    match: (p) => p.startsWith("/admin/users"),
    eyebrow: "Directory",
    title: "Users",
    description: "Change a role, disable sign-in, or remove someone from their organization.",
    icon: Users2,
  },
  {
    match: (p) => p.startsWith("/admin/tickets") || p.startsWith("/admin/support"),
    eyebrow: "Support",
    title: "Tickets",
    description: "Tenant-filed issues and operator replies.",
    icon: Ticket,
  },
  {
    match: (p) => p.startsWith("/admin/impersonate"),
    eyebrow: "Support",
    title: "Impersonate",
    description: "Open a workspace as an active member. Audited and time-boxed.",
    icon: UserCog,
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
  const { admin, loading, signOut, getTenant, registryError, refresh } =
    useAdminSession();
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [orgSessionEmail, setOrgSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!admin || !isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setOrgSessionEmail(data.session?.user?.email || null);
        }
      } catch {
        // Session probe is best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, pathname]);

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

  const navItems = NAV.filter((item) =>
    (NAV_ACCESS[admin.role] || []).includes(item.href),
  );
  const forbidden = !adminCanViewPath(admin.role, pathname);

  return (
    <div className="flex h-dvh w-full gap-3 overflow-hidden bg-[var(--canvas)] p-2 sm:gap-4 sm:p-3">
        <AnimatePresence>
          {menuOpen ? (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-[#0b121a]/45 backdrop-blur-sm lg:hidden"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
          ) : null}
        </AnimatePresence>
        <aside
          className={cn(
            "fixed top-2 bottom-2 left-2 z-40 w-[min(18.5rem,calc(100vw-1.25rem))] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-[var(--foreground)] shadow-[var(--shadow-soft)] sm:top-3 sm:bottom-3 sm:left-3 lg:static lg:inset-auto lg:flex lg:w-64 dark:border-white/8 dark:bg-[image:var(--ink-mesh),linear-gradient(165deg,#0b121a_0%,#152031_100%)] dark:text-white dark:shadow-[var(--shadow-ink)]",
            menuOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <BrandMark className="text-xl" />
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] lg:hidden dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[var(--accent)] dark:text-[var(--accent-on-ink)]" aria-hidden />
            <p className="text-xs text-[var(--muted)] dark:text-white/50">SaaS Admin Console</p>
          </div>

          <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const NavIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "text-[var(--foreground)] dark:text-white"
                      : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)] dark:text-white/65 dark:hover:bg-white/8 dark:hover:text-white",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="admin-nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-[var(--accent-soft)] dark:bg-white/12"
                    />
                  ) : null}
                  <span
                    data-active={active ? "true" : undefined}
                    className="nav-icon-chip relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-[background,color,box-shadow] duration-150"
                  >
                    <NavIcon className="h-3.5 w-3.5 overflow-visible" aria-hidden />
                  </span>
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 dark:border-white/8 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <Avatar name={admin.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)] dark:text-white">{admin.name}</p>
                <p className="truncate text-xs text-[var(--muted)] dark:text-white/50">{admin.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold capitalize text-[var(--muted)] dark:bg-white/8 dark:text-white/70">
                {admin.role.replace("_", " ")}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={() => {
                  void signOut().then(() => router.replace("/admin/login"));
                }}
              >
                <LogOut className="h-3 w-3" aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <header className="flex shrink-0 items-center gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-card)] sm:gap-3 sm:px-5 sm:py-3">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[var(--surface-muted)] lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="mt-0.5 hidden shrink-0 sm:block">
                <span className="stat-icon-chip h-10 w-10 rounded-[0.85rem] sm:h-11 sm:w-11 sm:rounded-[0.9rem]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              </span>
              <div className="min-w-0">
                <p className="eyebrow truncate">{activePage.eyebrow}</p>
                <h1 className="truncate font-display text-lg tracking-tight sm:text-2xl">
                  {activePage.title}
                </h1>
                <p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">
                  {activePage.description}
                </p>
              </div>
            </div>
            <ThemeToggle />
          </header>
          <main className="surface-panel min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
            {orgSessionEmail ? (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
              >
                <span>
                  A brokerage session ({orgSessionEmail}) is also active in this
                  browser. Admin sign-out ends that brokerage session too.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const supabase = createBrowserSupabaseClient();
                      void supabase.auth.signOut().then(() => setOrgSessionEmail(null));
                    } catch {
                      setOrgSessionEmail(null);
                    }
                  }}
                  className="rounded-full border border-current px-3 py-1 text-xs font-semibold"
                >
                  End brokerage session
                </button>
              </div>
            ) : null}
            {registryError ? (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-300/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
              >
                <span>Tenant data could not be loaded: {registryError}</span>
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-full border border-current px-3 py-1 text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            ) : null}
            <motion.div key={pathname}>
              {forbidden ? (
                <div
                  role="alert"
                  className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"
                >
                  <ShieldCheck className="mx-auto h-8 w-8 text-[var(--muted)]" aria-hidden />
                  <h2 className="mt-3 text-lg font-semibold">403 — Not available for your role</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Your admin role ({admin.role.replace("_", " ")}) does not have
                    access to this area.
                  </p>
                  <Link
                    href="/admin"
                    className="mt-4 inline-block rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-semibold"
                  >
                    Back to overview
                  </Link>
                </div>
              ) : (
                <ErrorBoundary>{children}</ErrorBoundary>
              )}
            </motion.div>
          </main>
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

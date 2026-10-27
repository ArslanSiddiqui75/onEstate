"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FolderOpen,
  Globe2,
  BookUser,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  Share2,
  Target,
  Workflow,
  Menu,
  X,
  Lock,
  LogOut,
  Settings,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hasModuleAccess } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { PLANS } from "@/lib/plans/catalog";
import type { ModuleId, PlanId, Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandMark } from "@/components/brand/brand-mark";
import { useBrand } from "@/components/brand/brand-provider";
import { useTheme } from "@/lib/theme/provider";

const NAV: {
  id: string;
  /** Plan lock. Dashboard and Settings are always available. */
  module?: ModuleId;
  href: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Inbox;
}[] = [
  {
    id: "dashboard",
    href: "/app",
    short: "Home",
    eyebrow: "Overview",
    title: "Dashboard",
    description: "Pipeline, inventory, and team pulse at a glance.",
    icon: LayoutDashboard,
  },
  {
    id: "conversations",
    module: "crm",
    href: "/app/conversations",
    short: "Conversations",
    eyebrow: "Communications",
    title: "Conversations",
    description: "Texts, email, and calls for each person, in one thread.",
    icon: MessagesSquare,
  },
  {
    id: "opportunities",
    module: "crm",
    href: "/app/opportunities",
    short: "Opportunities",
    eyebrow: "Pipeline",
    title: "Opportunities",
    description: "Website, portal, and office enquiries land here, then move toward a deal.",
    icon: Target,
  },
  {
    id: "contacts",
    module: "crm",
    href: "/app/contacts",
    short: "Contacts",
    eyebrow: "Address book",
    title: "Contacts",
    description: "Everyone you work with, whether or not they are in a live thread.",
    icon: BookUser,
  },
  {
    id: "listings",
    module: "listings",
    href: "/app/listings",
    short: "Listings",
    eyebrow: "Inventory",
    title: "Listings & Portals",
    description: "Listing packs, portal readiness, and sync status.",
    icon: Building2,
  },
  {
    id: "automations",
    module: "crm",
    href: "/app/automations",
    short: "Automations",
    eyebrow: "Follow-up",
    title: "Automations",
    description: "When something happens, the next message or task runs itself.",
    icon: Workflow,
  },
  {
    id: "website",
    module: "website",
    href: "/app/website",
    short: "Website",
    eyebrow: "Public presence",
    title: "Website",
    description: "Brokerage site headline, CTA, and publish state.",
    icon: Globe2,
  },
  {
    id: "social",
    module: "social",
    href: "/app/social",
    short: "Social",
    eyebrow: "Distribution",
    title: "Social",
    description: "Compose, queue, and schedule posts. Accounts live in Settings.",
    icon: Share2,
  },
  {
    id: "settings",
    href: "/app/settings",
    short: "Settings",
    eyebrow: "Workspace",
    title: "Settings",
    description: "Profile, brokerage, team, lead routing, social accounts, and billing.",
    icon: Settings,
  },
];

const WORKSPACE_NAV: {
  href: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Inbox;
  markets?: readonly string[];
}[] = [
  { href: "/app/diary", short: "Diary", eyebrow: "Diary", title: "Diary", description: "Viewings and valuations, including requests from the public booking link.", icon: CalendarDays, markets: ["uk", "us"] },
  { href: "/app/lettings", short: "Lettings", eyebrow: "Landlords", title: "Lettings", description: "Open repairs, this month's rent, and the file for each let.", icon: KeyRound, markets: ["uk"] },
  { href: "/app/tasks", short: "Tasks", eyebrow: "Follow-ups", title: "Tasks", description: "Open and done lead tasks.", icon: ListChecks },
  { href: "/app/reports", short: "Reports", eyebrow: "Snapshot", title: "Reports", description: "Live pipeline and inventory counts.", icon: BarChart3 },
  { href: "/app/documents", short: "Documents", eyebrow: "Files", title: "Documents", description: "Uploads, e-sign, and listing media.", icon: FolderOpen },
  { href: "/app/tickets", short: "Support", eyebrow: "Help", title: "Support", description: "File a ticket with platform support.", icon: LifeBuoy },
];

interface AppShellProps {
  children: React.ReactNode;
  role: Role;
  plan: PlanId;
  userName: string;
  orgName?: string;
  /** Distinguishes duplicate org names (e.g. multiple "tp" workspaces). */
  orgId?: string;
  basePath?: "/app";
  onSignOut?: () => void;
  /** Subtle status meta shown in the header (e.g. persistence · auth · plan). */
  headerMeta?: string;
}

export function AppShell({
  children,
  role,
  plan,
  userName,
  orgName = "Workspace",
  orgId,
  basePath = "/app",
  onSignOut,
  headerMeta,
}: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const brand = useBrand();
  const { theme } = useTheme();
  const [ink, setInk] = useState(false);
  useEffect(() => {
    setInk(document.documentElement.classList.contains("dark"));
  }, [theme]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = NAV.map((item) => {
    const href = item.id === "dashboard" ? basePath : item.href;
    const locked = item.module
      ? !hasModuleAccess(role, plan, item.module, "view")
      : false;
    return { ...item, href, locked };
  });

  const workspaceNav = WORKSPACE_NAV.filter((item) => {
    if (!("markets" in item)) return true;
    return (item.markets as readonly string[]).includes(brand.market);
  }).map((item) => {
    if (item.href !== "/app/diary" || brand.market !== "us") return item;
    return {
      ...item,
      short: "Calendar",
      eyebrow: "Calendar",
      title: "Calendar",
      description: "Showings and valuations, including requests from the public booking link.",
    };
  });
  const workspaceActive = workspaceNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const activePage =
    workspaceActive ||
    items
      .filter((item) => item.id !== "dashboard")
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ||
    items.find((item) => item.id === "dashboard") ||
    items[0];

  const statusLine = headerMeta || `${brand.name} · ${PLANS[plan].name}`;

  useEffect(() => {
    document.title = `${activePage.title} — ${brand.name}`;
  }, [activePage.title, brand.name]);

  return (
    <div className="flex h-dvh w-full gap-3 overflow-hidden bg-[var(--canvas)] p-2 text-[var(--foreground)] sm:gap-4 sm:p-3">
        <aside
          className={cn(
            "fixed top-2 bottom-2 left-2 z-40 w-[17.5rem] flex-col overflow-hidden rounded-[1.75rem] sm:top-3 sm:bottom-3 sm:left-3 lg:static lg:inset-auto lg:flex",
            open ? "flex" : "hidden lg:flex",
            ink
              ? "border border-white/8 bg-[linear-gradient(165deg,#0b121a_0%,#152031_100%)] bg-[image:var(--ink-mesh),linear-gradient(165deg,#0b121a_0%,#152031_100%)] text-[var(--ink-foreground)] shadow-[var(--shadow-ink)]"
              : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-soft)]",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <Link href={basePath}>
              <BrandMark className="text-xl" tone={ink ? "dark" : "auto"} />
            </Link>
            <button
              className={cn(
                "rounded-full p-2 lg:hidden",
                ink ? "hover:bg-white/8" : "hover:bg-[var(--surface-muted)]",
              )}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav
            className="mt-6 flex-1 space-y-1 overflow-y-auto px-3"
            aria-label="Primary"
          >
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== basePath && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    ink
                      ? active
                        ? "text-white"
                        : "text-white/60 hover:bg-white/6 hover:text-white"
                      : active
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
                    item.locked && "opacity-45",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={cn(
                        "absolute inset-0 rounded-2xl",
                        ink
                          ? "bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "bg-[var(--accent-soft)]",
                      )}
                    />
                  ) : null}
                  <span
                    data-active={active ? "true" : undefined}
                    className="nav-icon-chip relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-[background,color,box-shadow] duration-150"
                  >
                    {item.locked ? (
                      <Lock className="h-3.5 w-3.5 overflow-visible" aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4 overflow-visible" aria-hidden />
                    )}
                  </span>
                  <span className="relative z-10 min-w-0 flex-1 truncate font-medium">
                    {item.short}
                  </span>
                  {item.locked ? (
                    <Badge
                      className={cn(
                        "relative z-10 text-[10px]",
                        ink
                          ? "border-white/10 bg-white/5 text-white/55"
                          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]",
                      )}
                    >
                      Locked
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
            <p
              className={cn(
                "px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wide",
                ink ? "text-white/35" : "text-[var(--muted)]",
              )}
            >
              Workspace
            </p>
            {workspaceNav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    ink
                      ? active
                        ? "text-white"
                        : "text-white/60 hover:bg-white/6 hover:text-white"
                      : active
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={cn(
                        "absolute inset-0 rounded-2xl",
                        ink
                          ? "bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "bg-[var(--accent-soft)]",
                      )}
                    />
                  ) : null}
                  <span
                    data-active={active ? "true" : undefined}
                    className="nav-icon-chip relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-[background,color,box-shadow] duration-150"
                  >
                    <Icon className="h-4 w-4 overflow-visible" aria-hidden />
                  </span>
                  <span className="relative z-10 min-w-0 flex-1 truncate font-medium">
                    {item.short}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div
            className={cn(
              "m-3 rounded-[1.35rem] border p-3",
              ink
                ? "border-white/8 bg-white/5"
                : "border-[var(--border)] bg-[var(--surface-muted)]",
            )}
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={userName} size="md" />
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-semibold",
                    ink ? "text-white" : "text-[var(--foreground)]",
                  )}
                >
                  {userName}
                </p>
                <p
                  className={cn(
                    "truncate text-xs",
                    ink ? "text-white/50" : "text-[var(--muted)]",
                  )}
                >
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "mt-2.5 rounded-[1rem] border px-3 py-2",
                ink
                  ? "border-white/10 bg-black/20"
                  : "border-[var(--border)] bg-[var(--surface-elevated)]",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  ink ? "text-white/40" : "text-[var(--muted)]",
                )}
              >
                Workspace
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate text-sm font-semibold",
                  ink ? "text-white" : "text-[var(--foreground)]",
                )}
                title={orgId ? `${orgName} (${orgId.slice(0, 8)})` : orgName}
              >
                {orgName}
              </p>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              <p className={cn("text-[11px]", ink ? "text-white/45" : "text-[var(--muted)]")}>
                {PLANS[plan].name}
              </p>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className={cn(
                    "inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[1rem] border px-3 text-[13px] font-medium transition",
                    ink
                      ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <LogOut className="h-3 w-3 shrink-0" aria-hidden />
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        <AnimatePresence>
          {open ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-[#0b121a]/45 backdrop-blur-sm lg:hidden"
              aria-label="Close overlay"
              onClick={() => setOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <header className="surface-panel flex shrink-0 items-center gap-3 px-3 py-3 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{activePage.eyebrow}</p>
              <h1 className="truncate font-display text-xl tracking-tight sm:text-2xl">
                {activePage.title}
              </h1>
              <p className="mt-0.5 hidden truncate text-xs text-[var(--muted)] sm:block">
                {activePage.description}
              </p>
            </div>

            <div className="hidden min-w-0 max-w-[16rem] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--muted)] lg:flex">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <Zap className="h-3 w-3" aria-hidden />
              </span>
              <span className="truncate">{statusLine}</span>
            </div>

            <ThemeToggle />
          </header>

          <main className="surface-panel min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 lg:p-8">
            <motion.div key={pathname}>{children}</motion.div>
          </main>
        </div>
    </div>
  );
}

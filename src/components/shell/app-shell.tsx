"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  Globe2,
  LayoutDashboard,
  Share2,
  Users,
  FileText,
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
import { MODULE_LABELS, ROLE_LABELS } from "@/lib/rbac/matrix";
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
  id: ModuleId | "dashboard" | "settings";
  label: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    short: "Home",
    eyebrow: "Overview",
    title: "Dashboard",
    description: "Pipeline, inventory, and team pulse at a glance.",
    icon: LayoutDashboard,
  },
  {
    id: "crm",
    label: MODULE_LABELS.crm,
    short: "CRM",
    eyebrow: "Operator CRM",
    title: "CRM & Contacts",
    description:
      "One workspace for the whole relationship lifecycle: pipeline, address book, SMS, calls, and sequences.",
    icon: Users,
  },
  {
    id: "listings",
    label: MODULE_LABELS.listings,
    short: "Listings",
    eyebrow: "Inventory",
    title: "Listings & Portals",
    description: "Listing packs, portal readiness, and sync status.",
    icon: Building2,
  },
  {
    id: "transactions",
    label: MODULE_LABELS.transactions,
    short: "Deals",
    eyebrow: "Deal flow",
    title: "Transactions & Compliance",
    description: "Checklists, e-sign, and compliance through close.",
    icon: FileText,
  },
  {
    id: "website",
    label: MODULE_LABELS.website,
    short: "Website",
    eyebrow: "Public presence",
    title: "Website",
    description: "Brokerage site headline, CTA, and publish state.",
    icon: Globe2,
  },
  {
    id: "social",
    label: MODULE_LABELS.social,
    short: "Social",
    eyebrow: "Distribution",
    title: "Social",
    description: "Connect accounts, upload media, and schedule posts.",
    icon: Share2,
  },
  {
    id: "billing",
    label: MODULE_LABELS.billing,
    short: "Billing",
    eyebrow: "Plans",
    title: "Billing & Plans",
    description: "Subscription, seats, and payment method.",
    icon: CreditCard,
  },
  {
    id: "settings",
    label: "Settings",
    short: "Settings",
    eyebrow: "Workspace",
    title: "Settings",
    description: "Profile, brokerage details, workspace ID, and team members.",
    icon: Settings,
  },
];

const WORKSPACE_NAV = [
  { href: "/app/enquiries", short: "Enquiries", eyebrow: "Pipeline", title: "Enquiry centre", description: "Every lead, with source, property interest, and the next step.", markets: ["uk", "us"] },
  { href: "/app/diary", short: "Diary", eyebrow: "Diary", title: "Diary", description: "Viewings and valuations, including requests from the public booking link.", markets: ["uk", "us"] },
  { href: "/app/lettings", short: "Lettings", eyebrow: "Landlords", title: "Lettings desk", description: "Repairs, rent, compliance, inspections, and a dispute pack.", markets: ["uk"] },
  { href: "/app/teams", short: "Teams", eyebrow: "Roster", title: "Teams", description: "Office groups. CRM stays shared." },
  { href: "/app/tasks", short: "Tasks", eyebrow: "Follow-ups", title: "Tasks", description: "Open and done lead tasks." },
  { href: "/app/reports", short: "Reports", eyebrow: "Snapshot", title: "Reports", description: "Live pipeline and inventory counts." },
  { href: "/app/documents", short: "Documents", eyebrow: "Files", title: "Documents", description: "Uploads, e-sign, and listing media." },
  { href: "/app/tickets", short: "Support", eyebrow: "Help", title: "Support", description: "File a ticket with platform support." },
] as const;

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
  const [ink, setInk] = useState(true);
  useEffect(() => {
    setInk(document.documentElement.classList.contains("dark"));
  }, [theme]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = NAV.map((item) => {
    const href =
      item.id === "dashboard" ? basePath : `${basePath}/${item.id}`;
    const locked =
      item.id !== "dashboard" &&
      item.id !== "settings" &&
      !hasModuleAccess(role, plan, item.id as ModuleId, "view");
    return { ...item, href, locked };
  });

  const workspaceNav = WORKSPACE_NAV.filter((item) => {
    if (!("markets" in item)) return true;
    return (item.markets as readonly string[]).includes(brand.market);
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
    <div className="h-screen overflow-hidden text-[var(--foreground)]">
      <div className="mx-auto flex h-full max-w-[1600px] gap-4 p-3 lg:p-4">
        <aside
          className={cn(
            "fixed inset-y-3 left-3 z-40 w-[17.5rem] flex-col overflow-hidden rounded-[1.75rem] lg:static lg:flex",
            open ? "flex" : "hidden lg:flex",
            ink
              ? "border border-white/8 bg-[linear-gradient(165deg,#0b121a_0%,#152031_100%)] bg-[image:var(--ink-mesh),linear-gradient(165deg,#0b121a_0%,#152031_100%)] text-[var(--ink-foreground)] shadow-[var(--shadow-ink)]"
              : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-soft)]",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <Link href={basePath}>
              <BrandMark
                className={cn("text-xl", ink ? "text-white" : "text-[var(--foreground)]")}
                accentClassName={ink ? "text-[var(--accent-on-ink)]" : "text-[var(--accent)]"}
              />
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
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
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
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-xl transition",
                      active
                        ? "bg-[var(--accent-gradient)] text-white shadow-[0_4px_14px_-2px_rgba(12,110,99,0.65)]"
                        : ink
                          ? "bg-white/6 text-white/70 group-hover:bg-white/10"
                          : "bg-[var(--surface-muted)] text-[var(--muted)]",
                    )}
                  >
                    {item.locked ? (
                      <Lock className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden />
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
                    ink
                      ? active
                        ? "bg-white/12 text-white"
                        : "text-white/55 hover:bg-white/6 hover:text-white"
                      : active
                        ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="truncate font-medium">{item.short}</span>
                </Link>
              );
            })}
          </nav>

          <div
            className={cn(
              "m-3 rounded-2xl border p-4",
              ink
                ? "border-white/8 bg-white/5"
                : "border-[var(--border)] bg-[var(--surface-muted)]",
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar name={userName} size="lg" />
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
                "mt-3 rounded-xl border px-3 py-2",
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
            <div className="mt-3 flex flex-col gap-2">
              <p className={cn("text-[11px]", ink ? "text-white/45" : "text-[var(--muted)]")}>
                {PLANS[plan].name}
              </p>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className={cn(
                    "inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
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

        <div className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-hidden">
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
            <motion.div
              key={pathname}
              className="mx-auto max-w-[1400px]"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

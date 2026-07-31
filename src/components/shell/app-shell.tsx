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
  Zap,
} from "lucide-react";
import { useState } from "react";
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
import { getActiveBrand } from "@/lib/brand/config";

const NAV: {
  id: ModuleId | "dashboard";
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
];

interface AppShellProps {
  children: React.ReactNode;
  role: Role;
  plan: PlanId;
  userName: string;
  orgName?: string;
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
  basePath = "/app",
  onSignOut,
  headerMeta,
}: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const brand = getActiveBrand();

  const items = NAV.map((item) => {
    const href =
      item.id === "dashboard" ? basePath : `${basePath}/${item.id}`;
    const locked =
      item.id !== "dashboard" &&
      !hasModuleAccess(role, plan, item.id as ModuleId, "view");
    return { ...item, href, locked };
  });

  const activePage =
    items
      .filter((item) => item.id !== "dashboard")
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ||
    items.find((item) => item.id === "dashboard") ||
    items[0];

  const statusLine = headerMeta || `${brand.name} workspace`;

  return (
    <div className="h-screen overflow-hidden text-[var(--foreground)]">
      <div className="mx-auto flex h-full max-w-[1600px] gap-4 p-3 lg:p-4">
        <aside
          className={cn(
            "fixed inset-y-3 left-3 z-40 flex w-[17.5rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(165deg,#0b121a_0%,#152031_100%)] bg-[image:var(--ink-mesh),linear-gradient(165deg,#0b121a_0%,#152031_100%)] text-[var(--ink-foreground)] shadow-[var(--shadow-ink)] transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-[120%]",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <Link href={basePath}>
              <BrandMark className="text-xl text-white" />
            </Link>
            <button
              className="rounded-full p-2 hover:bg-white/8 lg:hidden"
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
                  href={item.locked ? `${basePath}/billing` : item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "text-white"
                      : "text-white/60 hover:bg-white/6 hover:text-white",
                    item.locked && "opacity-45",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-2xl bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-xl transition",
                      active
                        ? "bg-[var(--accent-gradient)] text-white shadow-[0_4px_14px_-2px_rgba(12,110,99,0.65)]"
                        : "bg-white/6 text-white/70 group-hover:bg-white/10",
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
                    <Badge className="relative z-10 border-white/10 bg-white/5 text-[10px] text-white/55">
                      Locked
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="m-3 rounded-2xl border border-white/8 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={userName} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {userName}
                </p>
                <p className="truncate text-xs text-white/50">
                  {ROLE_LABELS[role]}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[11px] text-white/45">
                {PLANS[plan].name} · {brand.name}
              </p>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
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

            <div className="hidden min-w-0 max-w-[18rem] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-[11px] text-[var(--muted)] lg:flex">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <Zap className="h-3 w-3" aria-hidden />
              </span>
              <span className="truncate">{statusLine}</span>
            </div>

            <div className="hidden text-right lg:block">
              <p className="truncate text-xs font-semibold tracking-tight">
                {orgName}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {ROLE_LABELS[role]}
              </p>
            </div>

            <ThemeToggle />
          </header>

          <main className="surface-panel min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 lg:p-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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

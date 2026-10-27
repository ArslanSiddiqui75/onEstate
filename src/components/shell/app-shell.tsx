"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Globe2,
  BookUser,
  KeyRound,
  LayoutDashboard,
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
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hasModuleAccess } from "@/lib/access";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { PLANS } from "@/lib/plans/catalog";
import type { ModuleGrants, ModuleId, PlanId, Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NoticeBell } from "@/components/notices/notice-bell";
import { useBrand } from "@/components/brand/brand-provider";
import { useTheme } from "@/lib/theme/provider";
import { settingsSectionFor } from "@/lib/nav/settings-sections";

const NAV: {
  id: string;
  /** Plan lock. Dashboard and Settings are always available. */
  module?: ModuleId;
  href: string;
  short: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  markets?: readonly string[];
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
    id: "diary",
    href: "/app/diary",
    short: "Diary",
    eyebrow: "Diary",
    title: "Diary",
    description: "Viewings and valuations, including requests from the public booking link.",
    icon: CalendarDays,
    markets: ["uk", "us"],
  },
  {
    id: "tasks",
    href: "/app/tasks",
    short: "Tasks",
    eyebrow: "Follow-ups",
    title: "Tasks",
    description: "Pending follow-ups, with anything overdue first.",
    icon: ListChecks,
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
    id: "lettings",
    href: "/app/lettings",
    short: "Lettings",
    eyebrow: "Landlords",
    title: "Lettings",
    description: "Open repairs, this month's rent, and the file for each let.",
    icon: KeyRound,
    markets: ["uk"],
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
    description: "Contact details, workspace, and the brokerage business profile.",
    icon: Settings,
  },
];

function SideLink({
  href,
  short,
  icon: Icon,
  active,
  locked,
  ink,
  className,
  onNavigate,
}: {
  href: string;
  short: string;
  icon: LucideIcon;
  active: boolean;
  locked?: boolean;
  ink: boolean;
  className?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
        className,
        ink
          ? active
            ? "text-white"
            : "text-white/60 hover:bg-white/6 hover:text-white"
          : active
            ? "text-[var(--foreground)]"
            : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]",
        locked && "opacity-45",
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
        {locked ? (
          <Lock className="h-3.5 w-3.5 overflow-visible" aria-hidden />
        ) : (
          <Icon className="h-4 w-4 overflow-visible" aria-hidden />
        )}
      </span>
      <span className="relative z-10 min-w-0 flex-1 truncate font-medium">{short}</span>
      {locked ? (
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
}

function moduleOpen(pathname: string, href: string, basePath: string) {
  if (href === basePath) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AppShellProps {
  children: React.ReactNode;
  role: Role;
  moduleAccess?: ModuleGrants;
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

const EMPTY_SEARCH = { get: () => null as string | null };

export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={<ShellFrame {...props} searchParams={EMPTY_SEARCH} />}>
      <ShellSearch {...props} />
    </Suspense>
  );
}

function ShellSearch(props: AppShellProps) {
  const searchParams = useSearchParams();
  return <ShellFrame {...props} searchParams={searchParams} />;
}

function ShellFrame({
  children,
  role,
  moduleAccess,
  plan,
  userName,
  orgName = "Workspace",
  orgId,
  basePath = "/app",
  onSignOut,
  headerMeta,
  searchParams,
}: AppShellProps & { searchParams: { get(name: string): string | null } }) {
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

  const items = NAV.filter((item) => !item.markets || item.markets.includes(brand.market)).map((item) => {
    const href = item.id === "dashboard" ? basePath : item.href;
    const locked = item.module
      ? !hasModuleAccess({ role, moduleAccess }, plan, item.module, "view")
      : false;
    if (item.id === "diary" && brand.market === "us") {
      return {
        ...item,
        href,
        locked,
        short: "Calendar",
        eyebrow: "Calendar",
        title: "Calendar",
        description: "Showings and valuations, including requests from the public booking link.",
      };
    }
    return { ...item, href, locked };
  });

  const activeParent = items
    .filter((item) => item.id !== "dashboard")
    .find((item) => moduleOpen(pathname, item.href, basePath));
  const basePage =
    activeParent || items.find((item) => item.id === "dashboard") || items[0];
  const settingsSection = settingsSectionFor(pathname);
  const activePage = settingsSection
    ? {
        ...basePage,
        eyebrow: settingsSection.eyebrow,
        title: settingsSection.title,
        description: settingsSection.description,
      }
    : pathname === "/app/diary" && searchParams.get("section") === "links"
      ? {
          ...basePage,
          title: "Client links",
          description: "Private links a client uses to follow their sale or let.",
        }
      : pathname === "/app/opportunities" && searchParams.get("view") === "deals"
        ? {
            ...basePage,
            eyebrow: "Opportunities",
            title: "Deals",
            description: "Offers, progression, and the checklist for each sale.",
          }
        : basePage;

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
          <div className="relative flex items-center justify-center px-5 pt-4">
            <Link href={basePath} aria-label="OneStreet" className="flex justify-center">
              <img
                src="/brand/loader-mark-light.webp"
                alt=""
                width={512}
                height={601}
                draggable={false}
                className="h-[6.75rem] w-auto dark:hidden"
              />
              {/* The dark render includes the floor, so the house needs a taller frame to match. */}
              <img
                src="/brand/loader-mark-dark.webp"
                alt=""
                width={524}
                height={706}
                draggable={false}
                className="hidden h-[7.85rem] w-auto dark:block"
              />
            </Link>
            <button
              className={cn(
                "absolute top-3 right-3 rounded-full p-2 lg:hidden",
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
            {items.map((item) => (
              <SideLink
                key={item.href}
                href={item.href}
                short={item.short}
                icon={item.icon}
                ink={ink}
                locked={item.locked}
                className={item.id === "settings" ? "mt-3" : undefined}
                active={moduleOpen(pathname, item.href, basePath)}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>

          <div
            className={cn(
              "mx-3 mb-3 mt-1 border-t px-1 pt-3",
              ink ? "border-white/10" : "border-[var(--border)]",
            )}
          >
            <div className="flex items-start gap-2.5">
              <Avatar name={userName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-semibold leading-tight",
                      ink ? "text-white" : "text-[var(--foreground)]",
                    )}
                  >
                    {userName}
                  </p>
                  {onSignOut ? (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium transition",
                        ink
                          ? "text-white/55 hover:bg-white/10 hover:text-white"
                          : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <LogOut className="h-3 w-3" aria-hidden />
                      Sign out
                    </button>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-0.5 truncate text-xs leading-tight",
                    ink ? "text-white/50" : "text-[var(--muted)]",
                  )}
                >
                  {ROLE_LABELS[role]}
                </p>
                <p
                  className={cn(
                    "mt-2 truncate text-[13px] font-medium leading-tight",
                    ink ? "text-white/90" : "text-[var(--foreground)]",
                  )}
                  title={orgId ? `${orgName} (${orgId.slice(0, 8)})` : orgName}
                >
                  {orgName}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[11px] leading-tight",
                    ink ? "text-white/40" : "text-[var(--muted)]",
                  )}
                >
                  {PLANS[plan].name}
                </p>
              </div>
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

            <div className="flex shrink-0 items-center gap-2">
              <NoticeBell />
              <ThemeToggle />
            </div>
          </header>

          <main
            className={cn(
              "surface-panel min-h-0 flex-1",
              pathname === "/app/conversations" || pathname === "/app/crm"
                ? "flex flex-col overflow-hidden p-0"
                : "overflow-y-auto scrollbar-thin p-4 sm:p-6 lg:p-8",
            )}
          >
            <motion.div
              key={pathname}
              className={
                pathname === "/app/conversations" || pathname === "/app/crm"
                  ? "flex min-h-0 flex-1 flex-col"
                  : undefined
              }
            >
              {children}
            </motion.div>
          </main>
        </div>
    </div>
  );
}

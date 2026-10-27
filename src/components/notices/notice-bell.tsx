"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  FileText,
  KeyRound,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  Phone,
  Receipt,
  Share2,
  Target,
} from "lucide-react";
import { useAgencyBook } from "@/components/agency/use-agency-book";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { loadBook } from "@/lib/lettings/store";
import { buildNotices, noticeKinds, type Notice, type NoticeKind } from "@/lib/notices/feed";
import { useSupportDesk } from "@/lib/support/use-desk";
import type { LettingsBook } from "@/lib/lettings/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ICONS: Record<NoticeKind, typeof Bell> = {
  conversation: MessagesSquare,
  call: Phone,
  enquiry: Target,
  task: ListChecks,
  diary: CalendarDays,
  offer: FileText,
  fee: Receipt,
  deal: FileText,
  listing: Building2,
  letting: KeyRound,
  social: Share2,
  support: LifeBuoy,
};

export function NoticeBell() {
  const { user, org, market, leads, messages, callLogs, tasks, listings, deals, socialAccounts, socialPosts, resolveTask } =
    useAppSession();
  const { book } = useAgencyBook(org?.id ?? "workspace");
  const desk = useSupportDesk();
  const [lettings, setLettings] = useState<LettingsBook | null>(null);
  const [filter, setFilter] = useState<NoticeKind | "all">("all");

  useEffect(() => {
    if (!org || market !== "uk") {
      setLettings(null);
      return;
    }
    setLettings(loadBook(org.id));
  }, [org, market]);

  const notices = useMemo(() => {
    if (!user || !org) return [];
    const allowed = (module: "crm" | "listings" | "transactions" | "social") =>
      hasModuleAccess(user, org.plan, module, "view");
    return buildNotices({
      market,
      diaryLabel: market === "us" ? "Calendar" : "Diary",
      access: {
        crm: allowed("crm"),
        listings: allowed("listings"),
        transactions: allowed("transactions"),
        social: allowed("social"),
      },
      leads,
      messages,
      callLogs,
      tasks,
      listings,
      deals,
      socialAccounts,
      socialPosts,
      appointments: book.appointments,
      offers: book.offers,
      fees: book.fees,
      lettings,
      tickets: desk.tickets,
    });
  }, [
    user,
    org,
    market,
    leads,
    messages,
    callLogs,
    tasks,
    listings,
    deals,
    socialAccounts,
    socialPosts,
    book.appointments,
    book.offers,
    book.fees,
    lettings,
    desk.tickets,
  ]);

  const diaryLabel = market === "us" ? "Calendar" : "Diary";
  const kinds = useMemo(() => noticeKinds(notices, diaryLabel), [notices, diaryLabel]);

  useEffect(() => {
    if (filter !== "all" && !notices.some((notice) => notice.kind === filter)) setFilter("all");
  }, [filter, notices]);

  if (!user || !org) return null;

  const visible = filter === "all" ? notices : notices.filter((notice) => notice.kind === filter);
  const danger = notices.some((notice) => notice.tone === "danger");
  const count = notices.length;
  const label =
    count === 0 ? "No notifications" : count === 1 ? "1 notification" : `${count} notifications`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[var(--surface-elevated)] transition hover:text-[var(--foreground)]",
            count > 0
              ? danger
                ? "border-[var(--danger)] text-[var(--danger)]"
                : "border-[var(--accent)] text-[var(--accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)]",
          )}
        >
          <Bell className="h-4 w-4" aria-hidden />
          {count > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white",
                danger ? "bg-[var(--danger)]" : "bg-[var(--accent)]",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-[var(--muted)]">{count === 0 ? "Up to date" : label}</p>
        </div>
        {kinds.length > 1 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-3 py-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            {kinds.map((kind) => (
              <FilterChip
                key={kind.kind}
                active={filter === kind.kind}
                onClick={() => setFilter(kind.kind)}
              >
                {kind.label}
                <span className="ml-1 tabular-nums text-[10px] opacity-70">{kind.count}</span>
              </FilterChip>
            ))}
          </div>
        ) : null}
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
            {count === 0 ? "Nothing needs you right now." : "Nothing in this type."}
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {visible.map((notice) => (
              <NoticeRow key={notice.id} notice={notice} onDone={notice.taskId ? () => void resolveTask(notice.taskId!) : undefined} />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}

function NoticeRow({ notice, onDone }: { notice: Notice; onDone?: () => void }) {
  const Icon = ICONS[notice.kind];
  return (
    <li className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0">
      {onDone ? (
        <button
          type="button"
          aria-label={`Mark ${notice.title} done`}
          className="mt-1 h-4 w-4 shrink-0 rounded-full border border-[var(--border-strong)] hover:border-[var(--accent)]"
          onClick={onDone}
        />
      ) : (
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            notice.tone === "danger"
              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
              : notice.tone === "warning"
                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                : "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      <Link href={notice.href} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{notice.title}</p>
        <p
          className={cn(
            "truncate text-xs",
            notice.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--muted)]",
          )}
        >
          {notice.label} · {notice.detail}
        </p>
      </Link>
    </li>
  );
}

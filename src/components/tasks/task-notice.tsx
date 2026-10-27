"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { dueLabel, dueState, pendingTasks } from "@/lib/tasks/due";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function TaskNotice() {
  const { user, org, tasks, leads, resolveTask } = useAppSession();
  if (!user || !org || !hasModuleAccess(user.role, org.plan, "crm", "view")) return null;

  const pending = pendingTasks(tasks);
  const overdue = pending.filter((task) => dueState(task.dueAt) === "overdue").length;
  const count = pending.length;
  const label = count === 0 ? "No pending tasks" : count === 1 ? "1 pending task" : `${count} pending tasks`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-[var(--surface-elevated)] transition hover:text-[var(--foreground)]",
            count > 0
              ? overdue > 0
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
                overdue > 0 ? "bg-[var(--danger)]" : "bg-[var(--accent)]",
              )}
            >
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5">
          <p className="text-sm font-semibold">Pending tasks</p>
          <Link href="/app/tasks" className="text-xs font-semibold text-[var(--accent)]">
            Open tasks
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">Nothing waiting.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {pending.slice(0, 6).map((task) => {
              const lead = leads.find((item) => item.id === task.leadId);
              const state = dueState(task.dueAt);
              return (
                <li key={task.id} className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0">
                  <button
                    type="button"
                    aria-label={`Mark ${task.title} done`}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[var(--border-strong)] hover:border-[var(--accent)]"
                    onClick={() => void resolveTask(task.id)}
                  />
                  <Link href="/app/tasks" className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className={cn("truncate text-xs", state === "overdue" ? "text-[var(--danger)]" : "text-[var(--muted)]")}>
                      {lead?.name || "Lead"} · {dueLabel(task.dueAt)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pending.length > 6 ? (
          <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
            {pending.length - 6} more on the tasks page.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

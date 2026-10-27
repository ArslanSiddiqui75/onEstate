import type { LeadTask } from "@/types";

export type DueState = "none" | "overdue" | "today" | "later";

export function localToday(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function taskDay(dueAt?: string) {
  if (!dueAt) return null;
  return dueAt.slice(0, 10);
}

export function dueState(dueAt?: string, today = localToday()): DueState {
  const day = taskDay(dueAt);
  if (!day) return "none";
  if (day < today) return "overdue";
  if (day === today) return "today";
  return "later";
}

export function dueLabel(dueAt?: string, today = localToday()) {
  const state = dueState(dueAt, today);
  if (state === "none") return "No date";
  if (state === "overdue") return "Overdue";
  if (state === "today") return "Due today";
  const day = taskDay(dueAt);
  if (!day) return "No date";
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(year, (month || 1) - 1, date || 1),
  );
}

export function pendingTasks(tasks: LeadTask[], today = localToday()) {
  const rank: Record<DueState, number> = { overdue: 0, today: 1, later: 2, none: 3 };
  return tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => rank[dueState(a.dueAt, today)] - rank[dueState(b.dueAt, today)] || (taskDay(a.dueAt) || "").localeCompare(taskDay(b.dueAt) || ""));
}

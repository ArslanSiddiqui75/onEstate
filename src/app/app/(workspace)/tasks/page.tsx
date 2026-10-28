"use client";

import { MenuSelect } from "@/components/ui/select";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { dueLabel, dueState, pendingTasks } from "@/lib/tasks/due";
import { LockedModule } from "@/components/ui/locked-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import type { LeadTask } from "@/types";

const selectClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm";

export default function AppTasksPage() {
  return <TasksDesk />;
}

function TasksDesk() {
  const { user, org, leads, tasks, resolveTask, createLeadTask } = useAppSession();
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = useMemo(() => pendingTasks(tasks), [tasks]);
  const overdue = open.filter((task) => dueState(task.dueAt) === "overdue").length;

  if (!user || !org) return null;
  if (!hasModuleAccess(user, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Tasks locked"
        reason="Tasks follow CRM access."
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
      />
    );
  }

  const canEdit = hasModuleAccess(user, org.plan, "crm", "edit");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          {open.length === 0 ? "Nothing waiting." : open.length === 1 ? "1 pending task." : `${open.length} pending tasks.`}
          {overdue > 0 ? <span className="text-[var(--danger)]"> {overdue === 1 ? "1 is overdue." : `${overdue} are overdue.`}</span> : null}
        </p>
        {canEdit ? (
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add task
          </Button>
        ) : null}
      </div>

      {open.length === 0 ? (
        <EmptyState
          title="No pending tasks"
          description="Follow-ups you add, and ones from a sequence, show up here."
          action={
            canEdit ? (
              <Button type="button" onClick={() => setAddOpen(true)}>
                Add task
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">
          <ul>
            {open.map((task) => {
              const lead = leads.find((item) => item.id === task.leadId);
              const state = dueState(task.dueAt);
              return (
                <li key={task.id} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label={`Mark ${task.title} done`}
                      className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-strong)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      onClick={() => void resolveTask(task.id).then(() => toast.success("Task done"))}
                    />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-strong)]" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {lead?.name || "Lead"} · {task.channel}
                    </p>
                  </div>
                  <Badge tone={state === "overdue" ? "danger" : state === "today" ? "warning" : "neutral"}>
                    {dueLabel(task.dueAt)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {addOpen ? (
        <AddTaskDialog
          leads={leads.map((lead) => ({ id: lead.id, name: lead.name }))}
          busy={busy}
          onClose={() => setAddOpen(false)}
          onCreate={async (input) => {
            setBusy(true);
            try {
              await createLeadTask({ ...input, status: "open" });
              setAddOpen(false);
              toast.success("Task added");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add that task");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function AddTaskDialog({
  leads,
  busy,
  onClose,
  onCreate,
}: {
  leads: { id: string; name: string }[];
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { leadId: string; title: string; dueAt?: string; channel: LeadTask["channel"] }) => Promise<void>;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a task</DialogTitle>
          <DialogDescription>A follow-up on a lead. It stays pending until you mark it done.</DialogDescription>
        </DialogHeader>
        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Add a lead first, then come back to give it a follow-up.{" "}
            <Link href="/app/opportunities" className="font-semibold text-[var(--accent)]">
              Open opportunities
            </Link>
          </p>
        ) : (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const title = String(data.get("title") || "").trim();
              const leadId = String(data.get("leadId") || "");
              const dueAt = String(data.get("dueAt") || "");
              const channel = String(data.get("channel") || "Call") as LeadTask["channel"];
              if (!leadId) {
                toast.error("Pick a lead");
                return;
              }
              void onCreate({ leadId, title, dueAt: dueAt || undefined, channel });
            }}
          >
            <label className="block text-sm font-medium">
              What needs doing
              <Input name="title" className="mt-1.5" required maxLength={200} placeholder="Call back about the viewing" />
            </label>
            <label className="block text-sm font-medium">
              Lead
              <MenuSelect name="leadId" className={`${selectClass} mt-1.5`} defaultValue="" required>
                <option value="" disabled>
                  Choose a lead
                </option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name}
                  </option>
                ))}
              </MenuSelect>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                How
                <MenuSelect name="channel" className={`${selectClass} mt-1.5`} defaultValue="Call">
                  <option value="Call">Call</option>
                  <option value="SMS">Text</option>
                  <option value="Email">Email</option>
                </MenuSelect>
              </label>
              <label className="block text-sm font-medium">
                Due
                <Input name="dueAt" type="date" className="mt-1.5" />
              </label>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save task"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

export default function AppTasksPage() {
  const { user, org, leads, tasks, resolveTask, createLeadTask } = useAppSession();
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const open = tasks.filter((t) => t.status === "open");
    const done = tasks.filter((t) => t.status === "done");
    return { open, done };
  }, [tasks]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Tasks locked"
        reason="Tasks follow CRM access."
        role={user.role}
        plan={org.plan}
      />
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "crm", "edit");

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Follow-ups from sequences and anything you add by hand.
      </p>
      {canEdit ? (
        <form
          className="grid gap-2 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!leadId) {
              toast.error("Pick a lead");
              return;
            }
            setBusy(true);
            void createLeadTask({
              leadId,
              title: title.trim(),
              dueAt: dueAt || undefined,
              channel: "Call",
              status: "open",
            })
              .then(() => {
                setTitle("");
                setDueAt("");
                toast.success("Task added");
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Could not add task"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            required
          >
            <option value="">Lead…</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add task"}
          </Button>
        </form>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-semibold">Open ({grouped.open.length})</h2>
        {grouped.open.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing open.</p>
        ) : (
          grouped.open.map((task) => {
            const lead = leads.find((l) => l.id === task.leadId);
            return (
              <Card key={task.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {lead?.name || "Lead"} · {task.channel}
                    {task.dueAt ? ` · due ${task.dueAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void resolveTask(task.id).then(() => toast.success("Task done"))
                    }
                  >
                    Done
                  </Button>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Done ({grouped.done.length})</h2>
        {grouped.done.map((task) => (
          <Card key={task.id} className="p-3">
            <p className="font-medium">{task.title}</p>
            <Badge className="mt-1">Done</Badge>
          </Card>
        ))}
      </section>
    </div>
  );
}

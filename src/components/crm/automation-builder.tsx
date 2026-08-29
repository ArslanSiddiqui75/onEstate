"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Mail,
  MessageSquare,
  Plus,
  Bell,
  ListTodo,
  Play,
  Tag,
  GitBranch,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  Automation,
  AutomationActionType,
  AutomationStep,
  AutomationTrigger,
  LeadStage,
} from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function newStepId() {
  return `step_${crypto.randomUUID()}`;
}

const TRIGGERS: { value: AutomationTrigger; label: string; hint: string }[] = [
  { value: "lead_created", label: "Lead created", hint: "Fires when a new lead is added" },
  { value: "stage_changed", label: "Stage changed", hint: "Fires when pipeline stage updates" },
  { value: "lead_contacted", label: "Lead contacted", hint: "Fires on the first CRM SMS or email (not automation sends)" },
  { value: "no_reply", label: "No reply", hint: "Fires after 48h of silence; a reply cancels a waiting run" },
  { value: "manual", label: "Manual start", hint: "Run only when an agent starts it" },
];

const ACTION_TYPES: {
  value: AutomationActionType;
  label: string;
  icon: typeof MessageSquare;
}[] = [
  { value: "send_sms", label: "Send SMS", icon: MessageSquare },
  { value: "send_email", label: "Send email", icon: Mail },
  { value: "create_task", label: "Create task", icon: ListTodo },
  { value: "wait", label: "Wait / delay", icon: Clock },
  { value: "update_stage", label: "Update stage", icon: GitBranch },
  { value: "notify_owner", label: "Notify owner", icon: Bell },
  { value: "add_tag", label: "Add tag", icon: Tag },
];

const STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "viewing",
  "offer",
  "won",
  "lost",
];

function defaultStep(type: AutomationActionType): AutomationStep {
  const meta = ACTION_TYPES.find((a) => a.value === type)!;
  const base = {
    id: newStepId(),
    type,
    label: meta.label,
    config: {} as AutomationStep["config"],
  };
  if (type === "send_sms") {
    base.config.body = "Hi {{first_name}}, just following up…";
  } else if (type === "send_email") {
    base.config.subject = "Thanks for getting in touch, {{first_name}}";
    base.config.body =
      "Hi {{first_name}}, thanks for reaching out — I'll send a few options shortly.";
  } else if (type === "wait") {
    base.config.delayHours = 24;
    base.label = "Wait 24 hours";
  } else if (type === "create_task") {
    base.config.taskTitle = "Follow up";
    base.config.channel = "Call";
  } else if (type === "update_stage") {
    base.config.stage = "contacted";
  } else if (type === "add_tag") {
    base.config.tag = "nurture";
  }
  return base;
}

function stepSummary(step: AutomationStep) {
  switch (step.type) {
    case "send_sms":
      return step.config.body || "Empty SMS body";
    case "send_email":
      return step.config.subject || step.config.body || "Empty email";
    case "wait":
      return `Wait ${step.config.delayHours || 0} hours`;
    case "create_task":
      return `${step.config.taskTitle || "Task"} · ${step.config.channel || "Call"}`;
    case "update_stage":
      return `Move to ${step.config.stage || "—"}`;
    case "add_tag":
      return `Tag: ${step.config.tag || "—"}`;
    case "notify_owner":
      return "Ping assigned owner";
    default:
      return step.label;
  }
}

export interface AutomationBuilderProps {
  automations: Automation[];
  canEdit: boolean;
  busy?: boolean;
  onCreate: (
    automation: Omit<Automation, "id" | "createdAt" | "updatedAt" | "orgId">,
  ) => Promise<void> | void;
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        Automation,
        | "name"
        | "description"
        | "trigger"
        | "triggerStage"
        | "status"
        | "steps"
      >
    >,
  ) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  /** Omitted when no lead is selected or the engine can't run (local mode). */
  onRunNow?: (id: string) => Promise<void> | void;
  runNowLabel?: string;
}

export function AutomationBuilder({
  automations,
  canEdit,
  busy,
  onCreate,
  onUpdate,
  onDelete,
  onRunNow,
  runNowLabel,
}: AutomationBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    automations[0]?.id ?? null,
  );
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTrigger, setDraftTrigger] = useState<AutomationTrigger>("lead_created");
  const [draftTriggerStage, setDraftTriggerStage] = useState<LeadStage>("qualified");

  const selected = useMemo(
    () => automations.find((a) => a.id === selectedId) || null,
    [automations, selectedId],
  );

  async function handleCreate() {
    if (!draftName.trim()) return;
    const steps = [
      defaultStep("send_sms"),
      defaultStep("wait"),
      defaultStep("create_task"),
    ];
    await onCreate({
      name: draftName.trim(),
      description: draftDescription.trim() || "Custom automation",
      trigger: draftTrigger,
      triggerStage: draftTrigger === "stage_changed" ? draftTriggerStage : undefined,
      status: "draft",
      steps,
    });
    setCreating(false);
    setDraftName("");
    setDraftDescription("");
  }

  async function toggleStatus(automation: Automation) {
    const next =
      automation.status === "active"
        ? "paused"
        : automation.status === "paused"
          ? "active"
          : "active";
    await onUpdate(automation.id, { status: next });
  }

  async function patchSelected(
    patch: Partial<
      Pick<
        Automation,
        "name" | "description" | "trigger" | "triggerStage" | "status" | "steps"
      >
    >,
  ) {
    if (!selected) return;
    await onUpdate(selected.id, patch);
  }

  async function addStep(type: AutomationActionType) {
    if (!selected) return;
    await patchSelected({ steps: [...selected.steps, defaultStep(type)] });
  }

  async function updateStep(stepId: string, next: AutomationStep) {
    if (!selected) return;
    await patchSelected({
      steps: selected.steps.map((s) => (s.id === stepId ? next : s)),
    });
  }

  async function removeStep(stepId: string) {
    if (!selected) return;
    await patchSelected({
      steps: selected.steps.filter((s) => s.id !== stepId),
    });
    if (editingStepId === stepId) setEditingStepId(null);
  }

  async function moveStep(stepId: string, dir: -1 | 1) {
    if (!selected) return;
    const idx = selected.steps.findIndex((s) => s.id === stepId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= selected.steps.length) return;
    const next = [...selected.steps];
    const [row] = next.splice(idx, 1);
    next.splice(target, 0, row);
    await patchSelected({ steps: next });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[17.5rem_1fr]">
      <aside className="hero-card space-y-3 rounded-[1.75rem] p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Workflows
          </p>
          {canEdit ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCreating(true);
                setSelectedId(null);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {automations.map((automation) => {
            const active = selectedId === automation.id && !creating;
            return (
              <button
                key={automation.id}
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSelectedId(automation.id);
                  setEditingStepId(null);
                }}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"
                    : "border-[var(--border)] bg-transparent hover:bg-[var(--surface)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">
                    {automation.name}
                  </p>
                  <Badge
                    tone={
                      automation.status === "active"
                        ? "success"
                        : automation.status === "paused"
                          ? "warning"
                          : "neutral"
                    }
                    className="capitalize"
                  >
                    {automation.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {TRIGGERS.find((t) => t.value === automation.trigger)?.label} ·{" "}
                  {automation.steps.length} steps
                </p>
              </button>
            );
          })}
          {automations.length === 0 && !creating ? (
            <p className="px-2 py-6 text-center text-xs text-[var(--muted)]">
              No workflows yet.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="hero-card min-h-[28rem] rounded-[1.75rem] p-4 sm:p-5">
        {creating && canEdit ? (
          <div className="mx-auto max-w-xl space-y-4">
            <div>
              <h2 className="font-display text-2xl tracking-tight">New workflow</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Pick a trigger, then customize the action steps.
              </p>
            </div>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Workflow name"
            />
            <Input
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Short description"
            />
            <select
              className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
              value={draftTrigger}
              onChange={(e) => setDraftTrigger(e.target.value as AutomationTrigger)}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {draftTrigger === "stage_changed" ? (
              <select
                className="h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 text-sm"
                value={draftTriggerStage}
                onChange={(e) => setDraftTriggerStage(e.target.value as LeadStage)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    When stage becomes {s}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex gap-2">
              <Button disabled={busy || !draftName.trim()} onClick={() => void handleCreate()}>
                Create workflow
              </Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {canEdit ? (
                  <Input
                    value={selected.name}
                    onChange={(e) => void patchSelected({ name: e.target.value })}
                    className="h-auto border-transparent bg-transparent px-0 font-display text-2xl font-normal tracking-tight shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <h2 className="font-display text-2xl tracking-tight">{selected.name}</h2>
                )}
                {canEdit ? (
                  <Input
                    value={selected.description}
                    onChange={(e) => void patchSelected({ description: e.target.value })}
                    className="mt-1 h-auto border-transparent bg-transparent px-0 text-sm text-[var(--muted)] shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">{selected.description}</p>
                )}
              </div>
              {canEdit ? (
                <div className="flex items-center gap-3">
                  {onRunNow ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || selected.status !== "active"}
                      title={
                        selected.status !== "active"
                          ? "Activate the workflow first"
                          : undefined
                      }
                      onClick={() => void onRunNow(selected.id)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {runNowLabel || "Run now"}
                    </Button>
                  ) : null}
                  <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                    <Switch
                      checked={selected.status === "active"}
                      onCheckedChange={() => void toggleStatus(selected)}
                    />
                    {selected.status === "active" ? "Live" : "Paused"}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                    onClick={() => {
                      if (window.confirm(`Delete “${selected.name}”?`)) {
                        void (async () => {
                          await onDelete(selected.id);
                          setSelectedId(
                            automations.find((a) => a.id !== selected.id)?.id ?? null,
                          );
                        })();
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2">
                <span className="stat-icon-chip h-8 w-8 rounded-lg">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Trigger
                  </p>
                  <p className="text-sm font-medium">
                    {TRIGGERS.find((t) => t.value === selected.trigger)?.label}
                    {selected.trigger === "stage_changed" && selected.triggerStage
                      ? ` → ${selected.triggerStage}`
                      : ""}
                  </p>
                </div>
              </div>
              {canEdit ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                    value={selected.trigger}
                    onChange={(e) => {
                      const trigger = e.target.value as AutomationTrigger;
                      void patchSelected({
                        trigger,
                        triggerStage:
                          trigger === "stage_changed"
                            ? selected.triggerStage || "qualified"
                            : undefined,
                      });
                    }}
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {selected.trigger === "stage_changed" ? (
                    <select
                      className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                      value={selected.triggerStage || "qualified"}
                      onChange={(e) =>
                        void patchSelected({
                          triggerStage: e.target.value as LeadStage,
                        })
                      }
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          Stage: {s}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Action steps</h3>
                {canEdit ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ACTION_TYPES.map((action) => (
                      <Button
                        key={action.value}
                        size="sm"
                        variant="secondary"
                        onClick={() => void addStep(action.value)}
                      >
                        <action.icon className="h-3.5 w-3.5" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>

              {selected.steps.length === 0 ? (
                <EmptyState
                  title="No steps yet"
                  description="Add SMS, waits, tasks, stage changes, tags, or owner alerts."
                />
              ) : (
                <ol className="space-y-3">
                  {selected.steps.map((step, index) => {
                    const Icon =
                      ACTION_TYPES.find((a) => a.value === step.type)?.icon || Zap;
                    const isEditing = editingStepId === step.id;
                    return (
                      <li
                        key={step.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-semibold text-[var(--muted)]">
                            {index + 1}
                          </span>
                          <span className="stat-icon-chip mt-0.5 h-8 w-8 rounded-lg">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{step.label}</p>
                            <p className="mt-0.5 text-sm text-[var(--muted)]">
                              {stepSummary(step)}
                            </p>

                            {isEditing && canEdit ? (
                              <StepEditor
                                step={step}
                                onChange={(next) => void updateStep(step.id, next)}
                                onDone={() => setEditingStepId(null)}
                              />
                            ) : null}
                          </div>
                          {canEdit ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={index === 0}
                                onClick={() => void moveStep(step.id, -1)}
                                aria-label="Move up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={index === selected.steps.length - 1}
                                onClick={() => void moveStep(step.id, 1)}
                                aria-label="Move down"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setEditingStepId(isEditing ? null : step.id)
                                }
                              >
                                {isEditing ? "Done" : "Edit"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[var(--danger)]"
                                onClick={() => void removeStep(step.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Select or create a workflow"
            description="Build trigger-based automations with customizable SMS, waits, tasks, and stage updates."
            action={
              canEdit ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" />
                  New workflow
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function StepEditor({
  step,
  onChange,
  onDone,
}: {
  step: AutomationStep;
  onChange: (step: AutomationStep) => void;
  onDone: () => void;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <Input
        value={step.label}
        onChange={(e) => onChange({ ...step, label: e.target.value })}
        placeholder="Step label"
      />
      {step.type === "send_sms" ? (
        <textarea
          className="min-h-20 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={step.config.body || ""}
          onChange={(e) =>
            onChange({ ...step, config: { ...step.config, body: e.target.value } })
          }
          placeholder="SMS body — use {{first_name}}"
        />
      ) : null}
      {step.type === "send_email" ? (
        <div className="space-y-2">
          <Input
            value={step.config.subject || ""}
            onChange={(e) =>
              onChange({
                ...step,
                config: { ...step.config, subject: e.target.value },
              })
            }
            placeholder="Subject — use {{first_name}}"
          />
          <textarea
            className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={step.config.body || ""}
            onChange={(e) =>
              onChange({ ...step, config: { ...step.config, body: e.target.value } })
            }
            placeholder="Email body — use {{first_name}}, {{email}}, {{stage}}"
          />
        </div>
      ) : null}
      {step.type === "wait" ? (
        <Input
          type="number"
          min={1}
          value={step.config.delayHours ?? 24}
          onChange={(e) => {
            const delayHours = Number(e.target.value) || 1;
            onChange({
              ...step,
              label: `Wait ${delayHours} hours`,
              config: { ...step.config, delayHours },
            });
          }}
          placeholder="Delay in hours"
        />
      ) : null}
      {step.type === "create_task" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={step.config.taskTitle || ""}
            onChange={(e) =>
              onChange({
                ...step,
                config: { ...step.config, taskTitle: e.target.value },
              })
            }
            placeholder="Task title"
          />
          <select
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            value={step.config.channel || "Call"}
            onChange={(e) =>
              onChange({
                ...step,
                config: {
                  ...step.config,
                  channel: e.target.value as "SMS" | "Call" | "Email",
                },
              })
            }
          >
            <option value="Call">Call</option>
            <option value="SMS">SMS</option>
            <option value="Email">Email</option>
          </select>
        </div>
      ) : null}
      {step.type === "update_stage" ? (
        <select
          className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          value={step.config.stage || "contacted"}
          onChange={(e) =>
            onChange({
              ...step,
              config: { ...step.config, stage: e.target.value as LeadStage },
            })
          }
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : null}
      {step.type === "add_tag" ? (
        <Input
          value={step.config.tag || ""}
          onChange={(e) =>
            onChange({ ...step, config: { ...step.config, tag: e.target.value } })
          }
          placeholder="Tag"
        />
      ) : null}
      <Button size="sm" variant="secondary" onClick={onDone}>
        Close editor
      </Button>
    </div>
  );
}

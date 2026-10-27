"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { LockedModule } from "@/components/ui/locked-module";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import {
  DEFAULT_LEAD_ROUTING,
  eligibleAssignees,
  hydrateLeadRouting,
  routeLead,
} from "@/lib/crm/routing";
import type { Lead, LeadRoutingMode, LeadRoutingSettings, OrgMember, PlanId, Role } from "@/types";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

const MODES: { id: LeadRoutingMode; title: string; body: string }[] = [
  {
    id: "creator",
    title: "Whoever adds the lead",
    body: "The person who types it in keeps it. Best for a one-person desk.",
  },
  {
    id: "round_robin",
    title: "Take turns",
    body: "Each new lead goes to the next person in the pool.",
  },
  {
    id: "least_open",
    title: "Fewest open leads",
    body: "The person with the lightest pipeline gets the next one.",
  },
  {
    id: "territory",
    title: "By area",
    body: "Match the enquiry’s area first. If nobody covers it, take turns.",
  },
];
const ROLE_OPTIONS: { id: Role; label: string }[] = [
  { id: "agent", label: "Agents" },
  { id: "team_lead", label: "Team leads" },
  { id: "broker", label: "Brokers" },
];

export function LeadRoutingPanel({
  plan,
  role,
  settings,
  members,
  leads,
  canEdit,
  onSave,
}: {
  plan: PlanId;
  role?: Role;
  settings?: LeadRoutingSettings;
  members: OrgMember[];
  leads: Lead[];
  canEdit: boolean;
  onSave: (next: LeadRoutingSettings) => Promise<void>;
}) {
  const enabled = PLAN_FEATURE_FLAGS[plan].leadRouting;
  const [draft, setDraft] = useState<LeadRoutingSettings>(() =>
    hydrateLeadRouting(settings),
  );
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <LockedModule
        title="Lead routing is on Team and Enterprise"
        reason="Solo workspaces assign every lead to the person who adds it. Upgrade to rotate enquiries across the team."
        role={role}
        plan={plan}
      />
    );
  }

  const activeMembers = members.filter((member) => !member.id.startsWith("invite_"));
  const owners = activeMembers.filter((member) => member.role === "owner").length;
  const eligible = eligibleAssignees(activeMembers, draft);
  const preview = routeLead({
    plan,
    settings: draft,
    members,
    existingLeads: leads,
    fallbackId: members.find((m) => m.role === "owner")?.id || members[0]?.id || "",
  });
  const previewName = members.find((m) => m.id === preview.assignedTo)?.name || "Nobody yet";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Who gets the next lead?</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Website enquiries and leads you add follow this one rule. Pick a rule, then choose who is allowed to receive them.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MODES.map((mode) => {
          const selected = draft.mode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={!canEdit}
              onClick={() => setDraft({ ...draft, mode: mode.id })}
              className={`rounded-[1rem] border px-4 py-4 text-left ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              } ${canEdit ? "" : "cursor-not-allowed opacity-70"}`}
            >
              <p className="font-semibold">{mode.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{mode.body}</p>
            </button>
          );
        })}
      </div>

      <section className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="font-semibold">Who can receive a lead</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Turn a role off to leave those people out of the pool.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const on = draft.includeRoles.includes(option.id);
            const count = activeMembers.filter((member) => member.role === option.id).length;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => {
                  const includeRoles = on
                    ? draft.includeRoles.filter((item) => item !== option.id)
                    : [...draft.includeRoles, option.id];
                  setDraft({
                    ...draft,
                    includeRoles: includeRoles.length ? includeRoles : DEFAULT_LEAD_ROUTING.includeRoles,
                  });
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                  on
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)]",
                )}
              >
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {count === 1 ? "1 person" : `${count} people`}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border-strong)] bg-transparent",
                  )}
                  aria-hidden
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={draft.includeOwner}
            disabled={!canEdit}
            onClick={() => setDraft({ ...draft, includeOwner: !draft.includeOwner })}
            className={cn(
              "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
              draft.includeOwner
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--surface-elevated)]",
            )}
          >
            <span>
              <span className="block text-sm font-medium">Owner</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {owners === 1 ? "1 person" : `${owners} people`}
              </span>
            </span>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                draft.includeOwner
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border-strong)] bg-transparent",
              )}
              aria-hidden
            >
              {draft.includeOwner ? <Check className="h-3 w-3" /> : null}
            </span>
          </button>
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            {eligible.length === 1 ? "1 person in the pool" : `${eligible.length} people in the pool`}
          </p>
          {eligible.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Nobody matches. New leads fall back to the whole team.</p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {eligible.map((person) => {
                const member = members.find((item) => item.id === person.id);
                const name = member?.name || "Team member";
                return (
                  <li key={person.id} className="flex items-center gap-2.5 rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
                    <Avatar name={name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{ROLE_LABELS[person.role]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {draft.mode === "territory" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--muted)]">
            Territories (city, postcode area, or office — comma separated)
          </p>
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 truncate">{member.name}</span>
              <input
                className="h-9 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                disabled={!canEdit}
                value={(draft.territories[member.id] || []).join(", ")}
                placeholder="e.g. SW1, Chelsea, Mayfair"
                onChange={(e) => {
                  const tokens = e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  setDraft({
                    ...draft,
                    territories: { ...draft.territories, [member.id]: tokens },
                  });
                }}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
        Next auto-assigned lead would go to <strong>{previewName}</strong>
        <span className="text-[var(--muted)]"> — {preview.reason}</span>
      </div>

      {canEdit ? (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(draft);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save routing"}
        </Button>
      ) : null}
    </div>
  );
}

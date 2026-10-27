"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LockedModule } from "@/components/ui/locked-module";
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

  const eligible = eligibleAssignees(
    members.filter((m) => !m.id.startsWith("invite_")),
    draft,
  );
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

      <div className="space-y-2">
        <p className="text-sm font-semibold">Who is allowed to receive leads</p>
        <p className="text-sm text-[var(--muted)]">Untick a role to keep those people out of the pool.</p>
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((role) => {
            const checked = draft.includeRoles.includes(role.id);
            return (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={checked}
                  onChange={() => {
                    const includeRoles = checked
                      ? draft.includeRoles.filter((r) => r !== role.id)
                      : [...draft.includeRoles, role.id];
                    setDraft({
                      ...draft,
                      includeRoles: includeRoles.length ? includeRoles : DEFAULT_LEAD_ROUTING.includeRoles,
                    });
                  }}
                />
                {role.label}
              </label>
            );
          })}
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={draft.includeOwner}
              disabled={!canEdit}
              onCheckedChange={(val) => setDraft({ ...draft, includeOwner: val })}
            />
            Include owner
          </label>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Pool of accepted members: {eligible.length ? eligible.map((m) => members.find((x) => m.id === x.id)?.name || m.id).join(", ") : "nobody — falls back to the whole team"}
        </p>
      </div>

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

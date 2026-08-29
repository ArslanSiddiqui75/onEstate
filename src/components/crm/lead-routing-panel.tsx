"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LockedModule } from "@/components/ui/locked-module";
import {
  DEFAULT_LEAD_ROUTING,
  ROUTING_MODE_LABELS,
  eligibleAssignees,
  hydrateLeadRouting,
  routeLead,
} from "@/lib/crm/routing";
import type { Lead, LeadRoutingMode, LeadRoutingSettings, OrgMember, PlanId, Role } from "@/types";
import { PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

const MODES: LeadRoutingMode[] = ["creator", "round_robin", "territory", "least_open"];
const ROLE_OPTIONS: { id: Role; label: string }[] = [
  { id: "agent", label: "Agents" },
  { id: "team_lead", label: "Team leads" },
  { id: "broker", label: "Brokers" },
];

export function LeadRoutingPanel({
  plan,
  settings,
  members,
  leads,
  canEdit,
  onSave,
}: {
  plan: PlanId;
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
        href="/app/billing"
      />
    );
  }

  const eligible = eligibleAssignees(members, draft);
  const preview = routeLead({
    plan,
    settings: draft,
    members,
    existingLeads: leads,
    fallbackId: members.find((m) => m.role === "owner")?.id || members[0]?.id || "",
  });
  const previewName = members.find((m) => m.id === preview.assignedTo)?.name || "Nobody yet";

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--muted)]">
        Website enquiries and new leads are assigned by these rules. Scoring is automatic from
        source, completeness, type, and priority.
      </p>

      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium text-[var(--muted)]">Assignment mode</span>
        <select
          className="h-10 w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
          disabled={!canEdit}
          value={draft.mode}
          onChange={(e) =>
            setDraft({ ...draft, mode: e.target.value as LeadRoutingMode })
          }
        >
          {MODES.map((mode) => (
            <option key={mode} value={mode}>
              {ROUTING_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--muted)]">Who can receive leads</p>
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
          Pool: {eligible.length ? eligible.map((m) => members.find((x) => m.id === x.id)?.name || m.id).join(", ") : "nobody — falls back to the whole team"}
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

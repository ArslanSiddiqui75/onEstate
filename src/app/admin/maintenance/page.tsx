"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "@/lib/admin/session";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  EMPTY_MAINTENANCE,
  WORKSPACE_ROLES,
  loadLocalMaintenance,
  normalizeMaintenanceSettings,
  saveLocalMaintenance,
  type RoleMaintenanceSettings,
} from "@/lib/admin/maintenance";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import type { Role } from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function AdminMaintenancePage() {
  const { admin } = useAdminSession();
  const [settings, setSettings] = useState<RoleMaintenanceSettings>(EMPTY_MAINTENANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"hosted" | "local">("local");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        const local = loadLocalMaintenance();
        setSettings(local);
        setSource("local");
        return;
      }
      const res = await fetch("/api/admin/maintenance");
      const json = (await res.json()) as RoleMaintenanceSettings & {
        source?: "hosted" | "local";
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not load maintenance settings");
      setSettings(normalizeMaintenanceSettings(json));
      setSource(json.source === "hosted" ? "hosted" : "local");
      if (json.source === "local") {
        saveLocalMaintenance(normalizeMaintenanceSettings(json));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load maintenance settings");
      setSettings(loadLocalMaintenance());
      setSource("local");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!admin) return null;
  if (admin.role !== "super_admin") {
    return (
      <Alert tone="danger">
        Only the platform super admin can turn maintenance mode on for workspace roles.
      </Alert>
    );
  }

  function toggleEnabled(enabled: boolean) {
    setSettings((current) =>
      normalizeMaintenanceSettings({
        ...current,
        enabled,
        roles: enabled ? current.roles : current.roles,
      }),
    );
  }

  function toggleRole(role: Role, on: boolean) {
    setSettings((current) => {
      const roles = on
        ? [...new Set([...current.roles, role])]
        : current.roles.filter((item) => item !== role);
      return normalizeMaintenanceSettings({ ...current, roles });
    });
  }

  async function save() {
    if (!admin) return;
    const actorEmail = admin.email;
    setSaving(true);
    setError(null);
    try {
      if (!isSupabaseConfigured()) {
        const next = normalizeMaintenanceSettings({
          ...settings,
          updatedAt: new Date().toISOString(),
          updatedBy: actorEmail,
        });
        saveLocalMaintenance(next);
        setSettings(next);
        setSource("local");
        toast.success("Maintenance settings saved");
        return;
      }

      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          roles: settings.roles,
        }),
      });
      const json = (await res.json()) as RoleMaintenanceSettings & {
        source?: "hosted" | "local";
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not save");
      const next = normalizeMaintenanceSettings(json);
      setSettings(next);
      setSource(json.source === "hosted" ? "hosted" : "local");
      if (json.source === "local") saveLocalMaintenance(next);
      toast.success("Maintenance settings saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Workspace maintenance mode</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              When this is on, chosen user types cannot sign in. They see
              “Maintenance mode is on. Please try again later.”
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <span>{settings.enabled ? "Enabled" : "Disabled"}</span>
            <Switch
              checked={settings.enabled}
              disabled={loading || saving}
              onCheckedChange={toggleEnabled}
            />
          </label>
        </div>

        {settings.enabled ? (
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-medium">User types under maintenance</p>
            <p className="text-sm text-[var(--muted)]">
              Turn on every role that should be locked out while you work.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {WORKSPACE_ROLES.map((role) => {
                const on = settings.roles.includes(role);
                return (
                  <li
                    key={role}
                    className="flex items-center justify-between gap-3 rounded-[1rem] border border-[var(--border)] px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                      <p className="text-xs text-[var(--muted)]">{role}</p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={loading || saving}
                      onCheckedChange={(value) => toggleRole(role, value)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
            Enable maintenance mode to choose which user types are locked out.
          </p>
        )}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={loading || saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <p className="text-xs text-[var(--muted)]">
            {source === "hosted" ? "Saved for every workspace." : "Saved in this browser until hosted settings are available."}
            {settings.updatedBy
              ? ` Last change by ${settings.updatedBy}.`
              : null}
          </p>
        </div>
      </Card>
    </div>
  );
}

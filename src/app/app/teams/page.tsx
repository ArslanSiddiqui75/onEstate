"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

type Team = {
  id: string;
  name: string;
  memberIds: string[];
};

export default function AppTeamsPage() {
  const { members, getAuthToken } = useAppSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getAuthToken();
    const res = await fetch("/api/teams", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = (await res.json()) as { teams?: Team[]; canManage?: boolean };
    setTeams(json.teams || []);
    setCanManage(Boolean(json.canManage));
  }, [getAuthToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: Record<string, string>) {
    const token = await getAuthToken();
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(json?.error || "Update failed");
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Groups for the office roster. CRM stays shared across the workspace.
      </p>
      {canManage ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              setBusy(true);
              try {
                const token = await getAuthToken();
                const res = await fetch("/api/teams", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ name }),
                });
                if (!res.ok) {
                  const json = (await res.json().catch(() => null)) as { error?: string } | null;
                  throw new Error(json?.error || "Could not create team");
                }
                setName("");
                toast.success("Team created");
                await load();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Input
            className="max-w-xs"
            placeholder="Team name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create team"}
          </Button>
        </form>
      ) : null}
      {teams.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No teams yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id} className="space-y-3 p-4">
              <CardHeader title={team.name} description={`${team.memberIds.length} members`} />
              <div className="flex flex-wrap gap-1.5">
                {team.memberIds.map((id) => {
                  const member = members.find((m) => m.id === id);
                  return (
                    <Badge key={id}>
                      {member?.name || id}
                      {canManage ? (
                        <button
                          type="button"
                          className="ml-1"
                          onClick={() =>
                            void patch(team.id, { removeMemberId: id }).catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Failed"),
                            )
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </Badge>
                  );
                })}
              </div>
              {canManage ? (
                <select
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    e.target.value = "";
                    if (!id) return;
                    void patch(team.id, { addMemberId: id })
                      .then(() => toast.success("Member added"))
                      .catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Failed"),
                      );
                  }}
                >
                  <option value="">Add member…</option>
                  {members
                    .filter((m) => !team.memberIds.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

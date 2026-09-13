"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { validateOrgName } from "@/lib/auth/org-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";

export default function AppSettingsPage() {
  const { user, org, market, updateWorkspace, updateProfile } = useAppSession();
  const [profileName, setProfileName] = useState(user?.name || "");
  const [orgName, setOrgName] = useState(org?.name || "");
  const [orgMarket, setOrgMarket] = useState<"uk" | "us">(market || "uk");
  const [busy, setBusy] = useState<"profile" | "org" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || !org) return null;

  const isOwner = user.role === "owner";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          Workspace profile, brokerage details, and team access.
        </p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/app/settings/members">Team members</Link>
        </Button>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Your profile</h2>
          <p className="text-sm text-[var(--muted)]">
            {user.email} · {ROLE_LABELS[user.role]}
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = profileName.trim();
            if (name.length < 2) {
              setError("Name must be at least 2 characters");
              return;
            }
            setBusy("profile");
            setError(null);
            void updateProfile({ name })
              .then(() => toast.success("Profile updated"))
              .catch((err) => {
                const msg = err instanceof Error ? err.message : "Could not update profile";
                setError(msg);
                toast.error(msg);
              })
              .finally(() => setBusy(null));
          }}
        >
          <Input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Your name"
            required
          />
          <Input value={user.email} disabled />
          <Button type="submit" className="sm:col-span-2" disabled={busy === "profile"}>
            {busy === "profile" ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Workspace</h2>
          <p className="text-sm text-[var(--muted)]">
            Workspace ID is used for support and billing. Team objects and a team
            switcher are out of scope.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Workspace ID
          </p>
          <p className="mt-1 break-all font-mono text-sm">{org.id}</p>
        </div>
        {isOwner ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const checked = validateOrgName(orgName);
              if (!checked.ok) {
                setError(checked.error);
                return;
              }
              setBusy("org");
              setError(null);
              void updateWorkspace({ name: checked.name, market: orgMarket })
                .then(() => toast.success("Workspace updated"))
                .catch((err) => {
                  const msg =
                    err instanceof Error ? err.message : "Could not update workspace";
                  setError(msg);
                  toast.error(msg);
                })
                .finally(() => setBusy(null));
            }}
          >
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Brokerage name"
              required
            />
            <select
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={orgMarket}
              onChange={(e) => setOrgMarket(e.target.value as "uk" | "us")}
            >
              <option value="uk">United Kingdom</option>
              <option value="us">United States</option>
            </select>
            <Button type="submit" className="sm:col-span-2" disabled={busy === "org"}>
              {busy === "org" ? "Saving…" : "Save workspace"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Only the Owner can rename the brokerage or change market. Ask your
            Owner if this needs updating.
          </p>
        )}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

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
          Workspace profile, brokerage details, reports, documents, and support.
        </p>
        <Button asChild size="sm" variant="secondary">
          <Link href="/app/settings/team">Team</Link>
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
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">Name</span>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your name"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">Email</span>
            <Input value={user.email} disabled aria-label="Email" />
          </label>
          <Button type="submit" className="w-fit" disabled={busy === "profile"}>
            {busy === "profile" ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Workspace</h2>
          <p className="text-sm text-[var(--muted)]">
            Workspace ID is used for support and billing. People and groups live in{" "}
            <Link href="/app/settings/team" className="text-[var(--accent)] hover:underline">
              Team
            </Link>
            . Lead assignment lives in{" "}
            <Link href="/app/settings/routing" className="text-[var(--accent)] hover:underline">
              Routing
            </Link>
            . Social networks live in{" "}
            <Link href="/app/settings/social" className="text-[var(--accent)] hover:underline">
              Accounts
            </Link>
            . The plan and card live in{" "}
            <Link href="/app/settings/billing" className="text-[var(--accent)] hover:underline">
              Billing
            </Link>
            .
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

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Team</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            See everyone in the workspace. The owner changes roles and removes people.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/team">Manage team</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Lead routing</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Choose who receives the next enquiry. This used to live inside CRM.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/routing">Open routing</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Social accounts</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Connect Instagram, Facebook, LinkedIn, and X. Compose and the queue
            stay on Social.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/social">Manage accounts</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Reports</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            The full book: pipeline, stock, deals, follow-ups, and the diary.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/reports">Open reports</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Documents</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Uploads, e-sign, and listing media.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/documents">Open documents</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Support</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Tickets with platform support, and how urgent each one is.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/support">Open support</Link>
        </Button>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Billing</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Plan, seats, invoices, and the card on file.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings/billing">Open billing</Link>
        </Button>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

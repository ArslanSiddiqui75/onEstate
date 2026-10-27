"use client";

import { MenuSelect } from "@/components/ui/select";

import { useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { validateOrgName } from "@/lib/auth/org-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { PhoneField } from "@/components/crm/phone-field";

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
      <p className="text-sm text-[var(--muted)]">
        Contact information from sign-up, and the brokerage name and market.
      </p>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Contact information</h2>
          <p className="text-sm text-[var(--muted)]">
            {ROLE_LABELS[user.role]}. Your name, work email, phone, and brokerage from sign-up.
          </p>
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = profileName.trim();
            const phone = String(new FormData(e.currentTarget).get("phone") || "").trim();
            if (name.length < 2) {
              setError("Name must be at least 2 characters");
              return;
            }
            if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
              setError("Add a phone number with the country code.");
              return;
            }
            setBusy("profile");
            setError(null);
            void updateProfile({ name, phone })
              .then(() => toast.success("Contact information saved"))
              .catch((err) => {
                const msg = err instanceof Error ? err.message : "Could not update contact information";
                setError(msg);
                toast.error(msg);
              })
              .finally(() => setBusy(null));
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">Your name</span>
            <Input
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium text-[var(--muted)]">Work email</span>
            <Input value={user.email} disabled aria-label="Work email" autoComplete="email" />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-[var(--muted)]">Phone</span>
            <PhoneField key={user.phone || "phone"} name="phone" market={market} defaultValue={user.phone} className="mt-1" />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium text-[var(--muted)]">Brokerage name</span>
            <Input value={org.name} disabled aria-label="Brokerage name" />
          </label>
          <Button type="submit" className="w-fit" disabled={busy === "profile"}>
            {busy === "profile" ? "Saving…" : "Save contact information"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Workspace</h2>
          <p className="text-sm text-[var(--muted)]">
            Workspace ID is used for support and billing. Only the owner can rename
            the brokerage or change market.
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
            <MenuSelect
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              value={orgMarket}
              onChange={(e) => setOrgMarket(e.target.value as "uk" | "us")}
            >
              <option value="uk">United Kingdom</option>
              <option value="us">United States</option>
            </MenuSelect>
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

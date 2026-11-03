"use client";

import Link from "next/link";
import { MenuSelect } from "@/components/ui/select";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { validateOrgName } from "@/lib/auth/org-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { PhoneField } from "@/components/crm/phone-field";
import { businessProfileFilled } from "@/lib/org/business-profile";
import { copyToClipboard } from "@/lib/utils";

export default function AppSettingsPage() {
  const { user, org, market, updateWorkspace, updateProfile } = useAppSession();
  const [profileName, setProfileName] = useState(user?.name || "");
  const [orgName, setOrgName] = useState(org?.name || "");
  const [orgMarket, setOrgMarket] = useState<"uk" | "us">(market || "uk");
  const [busy, setBusy] = useState<"profile" | "org" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);

  if (!user || !org) return null;

  const isOwner = user.role === "owner";
  const hasBusiness = businessProfileFilled(org.business);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Contact information from sign-up and the brokerage workspace. Legal registration and
        compliance live under Business Profile.
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
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--muted)]">Workspace ID</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={org.id}
              aria-label="Workspace ID"
              className="font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={() => {
                void copyToClipboard(org.id).then((ok) => {
                  if (!ok) {
                    toast.info("Select the ID and copy it.");
                    return;
                  }
                  setIdCopied(true);
                  toast.success("Workspace ID copied");
                  window.setTimeout(() => setIdCopied(false), 2000);
                });
              }}
            >
              {idCopied ? <Check /> : <Copy />}
              {idCopied ? "Copied" : "Copy"}
            </Button>
          </div>
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

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">Business profile</h2>
            <p className="text-sm text-[var(--muted)]">
              Trading name, registration, authorised representative, language, and email
              compliance.
            </p>
          </div>
          <Button type="button" variant="secondary" asChild>
            <Link href="/app/settings/business-profile">
              {isOwner ? "Open Business Profile" : "View Business Profile"}
            </Link>
          </Button>
        </div>
        {hasBusiness ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <BusinessFact label="Trading name" value={org.business?.tradingName} />
            <BusinessFact label="Business email" value={org.business?.email} />
            <BusinessFact label="Website" value={org.business?.website} />
            <BusinessFact
              label="Niche"
              value={org.business?.niche ? org.business.niche.replaceAll("_", " ") : undefined}
            />
            <BusinessFact label="Currency" value={org.business?.currency} />
            <BusinessFact
              label="Platform language"
              value={org.business?.platformLanguage}
            />
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {isOwner
              ? "No business profile yet — open Business Profile to fill it in."
              : "The owner has not filled in a business profile yet."}
          </p>
        )}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

function BusinessFact({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

"use client";

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
import { Textarea } from "@/components/ui/textarea";
import {
  businessProfileFilled,
  validateBusinessProfile,
  type BusinessProfile,
} from "@/lib/org/business-profile";
import { copyToClipboard } from "@/lib/utils";

export default function AppSettingsPage() {
  const { user, org, market, updateWorkspace, updateProfile } = useAppSession();
  const [profileName, setProfileName] = useState(user?.name || "");
  const [orgName, setOrgName] = useState(org?.name || "");
  const [orgMarket, setOrgMarket] = useState<"uk" | "us">(market || "uk");
  const [business, setBusiness] = useState<BusinessProfile>({
    tradingName: org?.business?.tradingName || org?.name || "",
    address: org?.business?.address || "",
    city: org?.business?.city || "",
    postcode: org?.business?.postcode || "",
    phone: org?.business?.phone || "",
    email: org?.business?.email || "",
    website: org?.business?.website || "",
    about: org?.business?.about || "",
  });
  const [busy, setBusy] = useState<"profile" | "org" | "business" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idCopied, setIdCopied] = useState(false);

  if (!user || !org) return null;

  const isOwner = user.role === "owner";

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Contact information from sign-up, the brokerage workspace, and the public business profile.
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
        <div>
          <h2 className="font-semibold">Business profile</h2>
          <p className="text-sm text-[var(--muted)]">
            How the brokerage appears to clients. Only the owner can change this.
          </p>
        </div>
        {isOwner ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const phone = String(new FormData(e.currentTarget).get("businessPhone") || "").trim();
              const checked = validateBusinessProfile({ ...business, phone });
              if (!checked.ok) {
                setError(checked.error);
                return;
              }
              setBusiness(checked.value);
              setBusy("business");
              setError(null);
              void updateWorkspace({ business: checked.value })
                .then(() => toast.success("Business profile saved"))
                .catch((err) => {
                  const msg =
                    err instanceof Error ? err.message : "Could not save the business profile";
                  setError(msg);
                  toast.error(msg);
                })
                .finally(() => setBusy(null));
            }}
          >
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-[var(--muted)]">Trading name</span>
              <Input
                value={business.tradingName}
                onChange={(e) => setBusiness((current) => ({ ...current, tradingName: e.target.value }))}
                placeholder={org.name}
                autoComplete="organization"
                required
              />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-[var(--muted)]">Street address</span>
              <Input
                value={business.address}
                onChange={(e) => setBusiness((current) => ({ ...current, address: e.target.value }))}
                placeholder="14 Harbour Lane"
                autoComplete="street-address"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">City</span>
              <Input
                value={business.city}
                onChange={(e) => setBusiness((current) => ({ ...current, city: e.target.value }))}
                placeholder={market === "us" ? "Austin" : "Manchester"}
                autoComplete="address-level2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">
                {market === "us" ? "ZIP code" : "Postcode"}
              </span>
              <Input
                value={business.postcode}
                onChange={(e) => setBusiness((current) => ({ ...current, postcode: e.target.value }))}
                placeholder={market === "us" ? "78701" : "M1 2AB"}
                autoComplete="postal-code"
              />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-[var(--muted)]">Business phone</span>
              <PhoneField
                key={business.phone || "business-phone"}
                name="businessPhone"
                market={market}
                defaultValue={business.phone}
                className="mt-1"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">Business email</span>
              <Input
                type="email"
                value={business.email}
                onChange={(e) => setBusiness((current) => ({ ...current, email: e.target.value }))}
                placeholder="hello@northbridge.co.uk"
                autoComplete="email"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium text-[var(--muted)]">Website</span>
              <Input
                value={business.website}
                onChange={(e) => setBusiness((current) => ({ ...current, website: e.target.value }))}
                placeholder="northbridge.co.uk"
                autoComplete="url"
              />
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-[var(--muted)]">About the business</span>
              <Textarea
                value={business.about}
                onChange={(e) => setBusiness((current) => ({ ...current, about: e.target.value }))}
                placeholder="Independent estate agency covering sales and lettings across the city."
                maxLength={600}
              />
            </label>
            <Button type="submit" className="w-fit" disabled={busy === "business"}>
              {busy === "business" ? "Saving…" : "Save business profile"}
            </Button>
          </form>
        ) : businessProfileFilled(org.business) ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <BusinessFact label="Trading name" value={org.business?.tradingName} />
            <BusinessFact label="Business email" value={org.business?.email} />
            <BusinessFact label="Street address" value={org.business?.address} wide />
            <BusinessFact label="City" value={org.business?.city} />
            <BusinessFact label={market === "us" ? "ZIP code" : "Postcode"} value={org.business?.postcode} />
            <BusinessFact label="Business phone" value={org.business?.phone} />
            <BusinessFact label="Website" value={org.business?.website} />
            <BusinessFact label="About the business" value={org.business?.about} wide />
          </dl>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            The owner has not filled in a business profile yet.
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
  wide,
}: {
  label: string;
  value?: string;
  wide?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

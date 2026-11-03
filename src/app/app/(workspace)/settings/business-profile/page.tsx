"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MenuSelect } from "@/components/ui/select";
import { PhoneField } from "@/components/crm/phone-field";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  BUSINESS_CURRENCIES,
  BUSINESS_INDUSTRIES,
  BUSINESS_NICHES,
  BUSINESS_TYPES,
  DEFAULT_UNSUBSCRIBE_FOOTER,
  EMPTY_BUSINESS,
  JOB_POSITIONS,
  OPERATION_REGIONS,
  PLATFORM_LANGUAGES,
  REGISTRATION_ID_TYPES,
  defaultCurrencyForMarket,
  defaultLanguageForMarket,
  normalizeBusinessProfile,
  resolveUnsubscribeFooter,
  validateBusinessProfile,
  type BusinessProfile,
  type OperationRegion,
} from "@/lib/org/business-profile";

type SectionBusy =
  | "general"
  | "legal"
  | "locale"
  | "rep"
  | "compliance"
  | null;

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
      {children}
      {hint ? (
        <span className="cursor-help text-[var(--muted)]" title={hint}>
          ⓘ
        </span>
      ) : null}
    </span>
  );
}

export default function BusinessProfileSettingsPage() {
  const { user, org, market, updateWorkspace } = useAppSession();
  const seeded = useMemo(() => {
    const base = normalizeBusinessProfile(org?.business || EMPTY_BUSINESS);
    if (!base.tradingName && org?.name) base.tradingName = org.name;
    if (!base.currency) base.currency = defaultCurrencyForMarket(market || "uk");
    if (!base.platformLanguage) {
      base.platformLanguage = defaultLanguageForMarket(market || "uk");
    }
    if (!base.outboundLanguage) {
      base.outboundLanguage = defaultLanguageForMarket(market || "uk");
    }
    return base;
  }, [market, org?.business, org?.name]);

  const [business, setBusiness] = useState<BusinessProfile>(seeded);
  const [busy, setBusy] = useState<SectionBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [customizingFooter, setCustomizingFooter] = useState(false);

  useEffect(() => {
    setBusiness(seeded);
  }, [seeded]);

  if (!user || !org) return null;
  const isOwner = user.role === "owner";

  function patchBusiness(next: Partial<BusinessProfile>) {
    setBusiness((current) => normalizeBusinessProfile({ ...current, ...next }));
  }

  function toggleRegion(region: OperationRegion) {
    setBusiness((current) => {
      const has = current.regionsOfOperation.includes(region);
      return {
        ...current,
        regionsOfOperation: has
          ? current.regionsOfOperation.filter((item) => item !== region)
          : [...current.regionsOfOperation, region],
      };
    });
  }

  async function saveSection(section: Exclude<SectionBusy, null>) {
    if (!isOwner) return;
    const checked = validateBusinessProfile(business);
    if (!checked.ok) {
      setError(checked.error);
      toast.error(checked.error);
      return;
    }
    setBusiness(checked.value);
    setBusy(section);
    setError(null);
    try {
      await updateWorkspace({ business: checked.value });
      toast.success("Business profile updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save the business profile";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const footerPreview = resolveUnsubscribeFooter(business);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Brokerage identity, registration details, authorised representative, and messaging
        compliance. Only the owner can edit these fields.
      </p>

      {!isOwner ? (
        <Alert>
          You can view the business profile. Ask an owner to change registration, language, or
          compliance settings.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">General</h2>
              <p className="text-sm text-[var(--muted)]">
                Trading name, public website, niche, and currency for this brokerage.
              </p>
            </div>
            <fieldset disabled={!isOwner} className="grid gap-3">
              <label className="block space-y-1 text-sm">
                <FieldLabel>Trading name</FieldLabel>
                <Input
                  value={business.tradingName}
                  onChange={(e) => patchBusiness({ tradingName: e.target.value })}
                  placeholder="Brokerage trading name"
                  autoComplete="organization"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel hint="Hostname visitors use for your public site.">
                  Branded domain
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    value={business.brandedDomain}
                    onChange={(e) => patchBusiness({ brandedDomain: e.target.value })}
                    placeholder="agency.example.com"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" asChild>
                    <Link href="/app/settings/social">Add domain</Link>
                  </Button>
                </div>
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business website</FieldLabel>
                <Input
                  value={business.website}
                  onChange={(e) => patchBusiness({ website: e.target.value })}
                  placeholder="example.com"
                  autoComplete="url"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <FieldLabel>Business niche</FieldLabel>
                  <MenuSelect
                    value={business.niche}
                    onChange={(e) =>
                      patchBusiness({ niche: e.target.value as BusinessProfile["niche"] })
                    }
                  >
                    {BUSINESS_NICHES.map((option) => (
                      <option key={option.value || "empty"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </MenuSelect>
                </label>
                <label className="block space-y-1 text-sm">
                  <FieldLabel hint="Used on invoices and listing currency defaults.">
                    Business currency
                  </FieldLabel>
                  <MenuSelect
                    value={business.currency}
                    onChange={(e) =>
                      patchBusiness({
                        currency: e.target.value as BusinessProfile["currency"],
                      })
                    }
                  >
                    {BUSINESS_CURRENCIES.map((option) => (
                      <option key={option.value || "empty"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </MenuSelect>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business email</FieldLabel>
                <Input
                  type="email"
                  value={business.email}
                  onChange={(e) => patchBusiness({ email: e.target.value })}
                  placeholder="hello@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business phone</FieldLabel>
                <PhoneField
                  key={`biz-phone-${business.phone || "empty"}`}
                  name="businessPhone"
                  market={market}
                  defaultValue={business.phone}
                  onChangeValue={(phone) => patchBusiness({ phone })}
                  className="mt-1"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Street address</FieldLabel>
                <Input
                  value={business.address}
                  onChange={(e) => patchBusiness({ address: e.target.value })}
                  autoComplete="street-address"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <FieldLabel>City</FieldLabel>
                  <Input
                    value={business.city}
                    onChange={(e) => patchBusiness({ city: e.target.value })}
                    autoComplete="address-level2"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <FieldLabel>{market === "us" ? "ZIP code" : "Postcode"}</FieldLabel>
                  <Input
                    value={business.postcode}
                    onChange={(e) => patchBusiness({ postcode: e.target.value })}
                    autoComplete="postal-code"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <FieldLabel>About the business</FieldLabel>
                <Textarea
                  value={business.about}
                  onChange={(e) => patchBusiness({ about: e.target.value })}
                  maxLength={600}
                  rows={3}
                />
              </label>
              {isOwner ? (
                <Button
                  type="button"
                  className="w-fit"
                  disabled={busy === "general"}
                  onClick={() => void saveSection("general")}
                >
                  {busy === "general" ? "Saving…" : "Update information"}
                </Button>
              ) : null}
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">Business information</h2>
              <p className="text-sm text-[var(--muted)]">
                Legal entity details used for carrier registration and compliance reviews.
              </p>
            </div>
            <fieldset disabled={!isOwner} className="grid gap-3">
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business type</FieldLabel>
                <MenuSelect
                  value={business.businessType}
                  onChange={(e) =>
                    patchBusiness({
                      businessType: e.target.value as BusinessProfile["businessType"],
                    })
                  }
                >
                  {BUSINESS_TYPES.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business industry</FieldLabel>
                <MenuSelect
                  value={business.industry}
                  onChange={(e) =>
                    patchBusiness({
                      industry: e.target.value as BusinessProfile["industry"],
                    })
                  }
                >
                  {BUSINESS_INDUSTRIES.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business registration ID type</FieldLabel>
                <MenuSelect
                  value={business.registrationIdType}
                  disabled={business.notRegistered}
                  onChange={(e) =>
                    patchBusiness({
                      registrationIdType: e.target
                        .value as BusinessProfile["registrationIdType"],
                    })
                  }
                >
                  {REGISTRATION_ID_TYPES.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Business registration number</FieldLabel>
                <Input
                  value={business.registrationNumber}
                  disabled={business.notRegistered}
                  onChange={(e) => patchBusiness({ registrationNumber: e.target.value })}
                  placeholder="Registration number"
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.notRegistered}
                  onChange={(e) =>
                    patchBusiness({
                      notRegistered: e.target.checked,
                      registrationNumber: e.target.checked
                        ? ""
                        : business.registrationNumber,
                      registrationIdType: e.target.checked
                        ? ""
                        : business.registrationIdType,
                    })
                  }
                />
                <span>My business is not registered</span>
              </label>
              <div className="space-y-2">
                <FieldLabel>Business regions of operations</FieldLabel>
                <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
                  {OPERATION_REGIONS.map((region) => (
                    <label key={region.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                        checked={business.regionsOfOperation.includes(region.value)}
                        onChange={() => toggleRegion(region.value)}
                      />
                      <span>{region.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  className="w-fit"
                  disabled={busy === "legal"}
                  onClick={() => void saveSection("legal")}
                >
                  {busy === "legal" ? "Saving…" : "Update information"}
                </Button>
              ) : null}
            </fieldset>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">Language</h2>
              <p className="text-sm text-[var(--muted)]">
                Workspace language and the language used for outbound custom values.
              </p>
            </div>
            <fieldset disabled={!isOwner} className="grid gap-3">
              <label className="block space-y-1 text-sm">
                <FieldLabel hint="Controls labels and date formatting in the workspace.">
                  Platform language
                </FieldLabel>
                <MenuSelect
                  value={business.platformLanguage}
                  onChange={(e) =>
                    patchBusiness({
                      platformLanguage: e.target
                        .value as BusinessProfile["platformLanguage"],
                    })
                  }
                >
                  {PLATFORM_LANGUAGES.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel hint="Preferred language for SMS and email template values.">
                  Outbound communication language for custom values
                </FieldLabel>
                <MenuSelect
                  value={business.outboundLanguage}
                  onChange={(e) =>
                    patchBusiness({
                      outboundLanguage: e.target
                        .value as BusinessProfile["outboundLanguage"],
                    })
                  }
                >
                  {PLATFORM_LANGUAGES.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              {isOwner ? (
                <Button
                  type="button"
                  className="w-fit"
                  disabled={busy === "locale"}
                  onClick={() => void saveSection("locale")}
                >
                  {busy === "locale" ? "Saving…" : "Update"}
                </Button>
              ) : null}
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">Authorized representative</h2>
              <p className="text-sm text-[var(--muted)]">
                Person authorised to confirm business identity for messaging and billing reviews.
              </p>
            </div>
            <fieldset disabled={!isOwner} className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <FieldLabel>First name</FieldLabel>
                <Input
                  value={business.authorizedRep.firstName}
                  onChange={(e) =>
                    patchBusiness({
                      authorizedRep: {
                        ...business.authorizedRep,
                        firstName: e.target.value,
                      },
                    })
                  }
                  autoComplete="given-name"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <FieldLabel>Last name</FieldLabel>
                <Input
                  value={business.authorizedRep.lastName}
                  onChange={(e) =>
                    patchBusiness({
                      authorizedRep: {
                        ...business.authorizedRep,
                        lastName: e.target.value,
                      },
                    })
                  }
                  autoComplete="family-name"
                />
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <FieldLabel>Representative email</FieldLabel>
                <Input
                  type="email"
                  value={business.authorizedRep.email}
                  onChange={(e) =>
                    patchBusiness({
                      authorizedRep: {
                        ...business.authorizedRep,
                        email: e.target.value,
                      },
                    })
                  }
                  autoComplete="email"
                />
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <FieldLabel>Job position</FieldLabel>
                <MenuSelect
                  value={business.authorizedRep.jobPosition}
                  onChange={(e) =>
                    patchBusiness({
                      authorizedRep: {
                        ...business.authorizedRep,
                        jobPosition: e.target
                          .value as BusinessProfile["authorizedRep"]["jobPosition"],
                      },
                    })
                  }
                >
                  {JOB_POSITIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </MenuSelect>
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <FieldLabel>Phone number (with country code)</FieldLabel>
                <PhoneField
                  key={`rep-phone-${business.authorizedRep.phone || "empty"}`}
                  name="repPhone"
                  market={market}
                  defaultValue={business.authorizedRep.phone}
                  onChangeValue={(phone) =>
                    patchBusiness({
                      authorizedRep: { ...business.authorizedRep, phone },
                    })
                  }
                  className="mt-1"
                />
              </label>
              {isOwner ? (
                <Button
                  type="button"
                  className="w-fit sm:col-span-2"
                  disabled={busy === "rep"}
                  onClick={() => void saveSection("rep")}
                >
                  {busy === "rep" ? "Saving…" : "Update information"}
                </Button>
              ) : null}
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold">General settings</h2>
              <p className="text-sm text-[var(--muted)]">
                Contact merging, timezone, bot protection, and email compliance.
              </p>
            </div>
            <fieldset disabled={!isOwner} className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.mergeMessengerContacts}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        mergeMessengerContacts: e.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Merge Facebook contacts with matching names from Messenger conversations
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.mergeLeadFormContacts}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        mergeLeadFormContacts: e.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Merge Facebook contacts with matching names from Facebook Lead Form
                  submissions
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.disableContactTimezone}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        disableContactTimezone: e.target.checked,
                      },
                    })
                  }
                />
                <span>Disable contact timezone</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.botDetection}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        botDetection: e.target.checked,
                      },
                    })
                  }
                />
                <span>
                  Bot detection preventing statistics increment and automation execution
                </span>
              </label>

              <Alert tone="warning">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">
                    Looking for number intelligence settings? Carrier lookup and risk checks live
                    under Phone System.
                  </p>
                  <Button type="button" size="sm" variant="secondary" asChild>
                    <Link href="/app/settings/phone-system">Go to Phone System</Link>
                  </Button>
                </div>
              </Alert>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.verifyEmailOnFirstSend}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        verifyEmailOnFirstSend: e.target.checked,
                      },
                    })
                  }
                />
                <span>Verify email address when first email is sent to a new contact</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  checked={business.compliance.emailUnsubscribeCompliant}
                  onChange={(e) =>
                    patchBusiness({
                      compliance: {
                        ...business.compliance,
                        emailUnsubscribeCompliant: e.target.checked,
                      },
                    })
                  }
                />
                <span>Make email compliant by adding an unsubscribe link in your email</span>
              </label>
              {business.compliance.emailUnsubscribeCompliant ? (
                <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  {customizingFooter ? (
                    <Textarea
                      rows={3}
                      value={business.compliance.unsubscribeFooter}
                      onChange={(e) =>
                        patchBusiness({
                          compliance: {
                            ...business.compliance,
                            unsubscribeFooter: e.target.value,
                          },
                        })
                      }
                      placeholder={DEFAULT_UNSUBSCRIBE_FOOTER}
                    />
                  ) : (
                    <p className="text-sm text-[var(--muted)]">{footerPreview}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    {customizingFooter ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchBusiness({
                            compliance: {
                              ...business.compliance,
                              unsubscribeFooter: DEFAULT_UNSUBSCRIBE_FOOTER,
                            },
                          })
                        }
                      >
                        Reset
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setCustomizingFooter((v) => !v)}
                    >
                      {customizingFooter ? "Done" : "Customize"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {isOwner ? (
                <Button
                  type="button"
                  className="w-fit"
                  disabled={busy === "compliance"}
                  onClick={() => void saveSection("compliance")}
                >
                  {busy === "compliance" ? "Saving…" : "Update information"}
                </Button>
              ) : null}
            </fieldset>
          </Card>
        </div>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

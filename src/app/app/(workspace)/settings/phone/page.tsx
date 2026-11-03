"use client";

import { useMemo, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { MAX_ORG_PHONE_NUMBERS } from "@/lib/phone/org-numbers";

interface ListedNumber {
  phoneNumber: string;
  locality: string;
  region: string;
}

export default function PhoneNumberSettingsPage() {
  const { user, org, market, updateWorkspace, getAuthToken, persistence } = useAppSession();
  const [contains, setContains] = useState("");
  const [numbers, setNumbers] = useState<ListedNumber[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<"search" | "buy" | "default" | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owned = useMemo(() => {
    if (org?.phoneNumbers && org.phoneNumbers.length > 0) return org.phoneNumbers;
    if (org?.phoneNumber) {
      return [{ id: "legacy", phoneNumber: org.phoneNumber, isDefault: true }];
    }
    return [];
  }, [org?.phoneNumber, org?.phoneNumbers]);

  const isOwner = user?.role === "owner";
  const country = market === "us" ? "US" : "GB";
  const atCap = owned.length >= MAX_ORG_PHONE_NUMBERS;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = persistence === "supabase" ? await getAuthToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function applyOwned(
    payload: {
      phoneNumber?: string;
      defaultPhoneNumber?: string | null;
      numbers?: Array<{ id: string; phoneNumber: string; label?: string; isDefault: boolean }>;
    },
  ) {
    const nextNumbers = payload.numbers;
    const defaultPhone =
      payload.defaultPhoneNumber ||
      nextNumbers?.find((row) => row.isDefault)?.phoneNumber ||
      payload.phoneNumber ||
      org?.phoneNumber;
    await updateWorkspace({
      phoneNumber: defaultPhone || undefined,
      phoneNumbers: nextNumbers,
    });
  }

  if (!user || !org) return null;

  const smsPaused = org.messagingCompliance?.sms?.suspendedAt;
  const emailPaused = org.messagingCompliance?.email?.suspendedAt;

  async function resumeChannel(channel: "sms" | "email") {
    if (!org) return;
    setBusy("default");
    setError(null);
    try {
      if (persistence !== "supabase") {
        const next = { ...(org.messagingCompliance || {}) };
        delete next[channel];
        next.acknowledgedAt = new Date().toISOString();
        await updateWorkspace({ messagingCompliance: next });
        toast.success(channel === "sms" ? "Texting resumed" : "Email resumed");
        return;
      }
      const headers = await authHeaders();
      const res = await fetch("/api/messaging/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ channel, suspended: false }),
      });
      const json = (await res.json()) as {
        compliance?: NonNullable<typeof org>["messagingCompliance"];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not resume messaging.");
      await updateWorkspace({ messagingCompliance: json.compliance });
      toast.success(channel === "sms" ? "Texting resumed" : "Email resumed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not resume messaging.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Buy numbers for this brokerage. Pick which one to send from in Conversations or bulk SMS.
        Automations and sequences always use the default. Marketing sends need opt-in (US TCPA /
        UK PECR); quiet hours apply to bulk and automated texts.
      </p>

      {smsPaused || emailPaused ? (
        <Alert tone="danger">
          <div className="space-y-3">
            <p className="font-medium">Messaging paused after opt-outs</p>
            {smsPaused ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  {org.messagingCompliance?.sms?.reason || "SMS is suspended for this workspace."}
                </p>
                {isOwner ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void resumeChannel("sms")}
                  >
                    Resume SMS
                  </Button>
                ) : null}
              </div>
            ) : null}
            {emailPaused ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  {org.messagingCompliance?.email?.reason ||
                    "Email is suspended for this workspace."}
                </p>
                {isOwner ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void resumeChannel("email")}
                  >
                    Resume email
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <Card className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Owned numbers</h2>
          <p className="text-xs text-[var(--muted)]">
            {owned.length}/{MAX_ORG_PHONE_NUMBERS}
          </p>
        </div>
        {owned.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No number yet</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {owned.map((row) => (
              <li
                key={row.id || row.phoneNumber}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm">{row.phoneNumber}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.isDefault ? "Default for automations and new texts" : "Available to send from"}
                  </p>
                </div>
                {isOwner && !row.isDefault ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === "default"}
                    onClick={() => {
                      setBusy("default");
                      setError(null);
                      void (async () => {
                        try {
                          if (persistence !== "supabase") {
                            const next = owned.map((item) => ({
                              ...item,
                              isDefault: item.phoneNumber === row.phoneNumber,
                            }));
                            await applyOwned({
                              phoneNumber: row.phoneNumber,
                              defaultPhoneNumber: row.phoneNumber,
                              numbers: next,
                            });
                          } else {
                            const headers = await authHeaders();
                            const res = await fetch("/api/phone/numbers", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...headers },
                              body: JSON.stringify({
                                phoneNumber: row.phoneNumber,
                                isDefault: true,
                              }),
                            });
                            const json = (await res.json()) as {
                              phoneNumber?: string;
                              defaultPhoneNumber?: string;
                              numbers?: Array<{
                                id: string;
                                phoneNumber: string;
                                label?: string;
                                isDefault: boolean;
                              }>;
                              error?: string;
                            };
                            if (!res.ok) throw new Error(json.error || "Could not set default.");
                            await applyOwned(json);
                          }
                          toast.success("Default number updated");
                        } catch (err) {
                          const msg =
                            err instanceof Error ? err.message : "Could not set default.";
                          setError(msg);
                          toast.error(msg);
                        } finally {
                          setBusy(null);
                        }
                      })();
                    }}
                  >
                    Make default
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isOwner ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Buy a number</h2>
            <p className="text-sm text-[var(--muted)]">
              {country === "GB" ? "United Kingdom mobile numbers." : "United States local numbers."}
              {atCap
                ? ` You’ve reached the ${MAX_ORG_PHONE_NUMBERS}-number limit for this workspace.`
                : ""}
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (atCap) return;
              setBusy("search");
              setError(null);
              const params = new URLSearchParams({ country, contains });
              void authHeaders()
                .then((headers) => fetch(`/api/phone/numbers?${params.toString()}`, { headers }))
                .then(async (res) => {
                  const json = (await res.json()) as {
                    numbers?: ListedNumber[];
                    error?: string;
                    configured?: boolean;
                  };
                  if (!res.ok) throw new Error(json.error || "Could not search numbers.");
                  setNumbers(json.numbers || []);
                  setSearched(true);
                  if (json.configured === false && json.error) setError(json.error);
                })
                .catch((err) => {
                  const msg = err instanceof Error ? err.message : "Could not search numbers.";
                  setError(msg);
                })
                .finally(() => setBusy(null));
            }}
          >
            <Input
              value={contains}
              onChange={(e) => setContains(e.target.value)}
              inputMode="numeric"
              placeholder={country === "GB" ? "Contains, such as 161" : "Area code, such as 512"}
              aria-label="Digits to search for"
              disabled={atCap}
            />
            <Button type="submit" className="shrink-0" disabled={busy === "search" || atCap}>
              {busy === "search" ? "Searching…" : "Search numbers"}
            </Button>
          </form>
          {searched && numbers.length === 0 && !error ? (
            <p className="text-sm text-[var(--muted)]">No numbers matched that search.</p>
          ) : null}
          {numbers.length > 0 ? (
            <ul className="divide-y divide-[var(--border)]">
              {numbers.map((row) => (
                <li key={row.phoneNumber} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{row.phoneNumber}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {[row.locality, row.region].filter(Boolean).join(", ") || "Available"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === "buy" || atCap}
                    onClick={() => {
                      setBusy("buy");
                      setBuying(row.phoneNumber);
                      setError(null);
                      void authHeaders()
                        .then((headers) =>
                          fetch("/api/phone/numbers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...headers },
                            body: JSON.stringify({ phoneNumber: row.phoneNumber }),
                          }),
                        )
                        .then(async (res) => {
                          const json = (await res.json()) as {
                            phoneNumber?: string;
                            defaultPhoneNumber?: string;
                            numbers?: Array<{
                              id: string;
                              phoneNumber: string;
                              label?: string;
                              isDefault: boolean;
                            }>;
                            error?: string;
                          };
                          if (!res.ok || !json.phoneNumber) {
                            throw new Error(json.error || "Could not buy that number.");
                          }
                          if (persistence !== "supabase") {
                            const makeDefault = owned.length === 0;
                            const next = [
                              ...owned.map((item) => ({
                                ...item,
                                isDefault: makeDefault ? false : item.isDefault,
                              })),
                              {
                                id: json.phoneNumber,
                                phoneNumber: json.phoneNumber,
                                isDefault: makeDefault,
                              },
                            ];
                            await applyOwned({
                              phoneNumber: makeDefault
                                ? json.phoneNumber
                                : org.phoneNumber || json.phoneNumber,
                              defaultPhoneNumber: makeDefault
                                ? json.phoneNumber
                                : org.phoneNumber || json.phoneNumber,
                              numbers: next,
                            });
                          } else {
                            await applyOwned(json);
                          }
                          toast.success("Number added to this brokerage");
                          setNumbers((current) =>
                            current.filter((item) => item.phoneNumber !== row.phoneNumber),
                          );
                        })
                        .catch((err) => {
                          const msg =
                            err instanceof Error ? err.message : "Could not buy that number.";
                          setError(msg);
                          toast.error(msg);
                        })
                        .finally(() => {
                          setBusy(null);
                          setBuying(null);
                        });
                    }}
                  >
                    {buying === row.phoneNumber ? "Buying…" : "Buy"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : (
        <p className="text-sm text-[var(--muted)]">Only the owner can buy a number.</p>
      )}

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

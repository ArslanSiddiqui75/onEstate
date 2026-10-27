"use client";

import { useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";

interface ListedNumber {
  phoneNumber: string;
  locality: string;
  region: string;
}

export default function PhoneNumberSettingsPage() {
  const { user, org, market, updateWorkspace } = useAppSession();
  const [contains, setContains] = useState("");
  const [numbers, setNumbers] = useState<ListedNumber[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<"search" | "buy" | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || !org) return null;
  const isOwner = user.role === "owner";
  const country = market === "us" ? "US" : "GB";

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Buy a Twilio number for this brokerage. Texts from Conversations send from it.
      </p>

      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Current number</h2>
        <p className="font-mono text-sm">{org.phoneNumber || "No number yet"}</p>
      </Card>

      {isOwner ? (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Buy a number</h2>
            <p className="text-sm text-[var(--muted)]">
              {country === "GB" ? "United Kingdom mobile numbers." : "United States local numbers."}
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy("search");
              setError(null);
              const params = new URLSearchParams({ country, contains });
              void fetch(`/api/phone/numbers?${params.toString()}`)
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
            />
            <Button type="submit" className="shrink-0" disabled={busy === "search"}>
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
                    disabled={busy === "buy"}
                    onClick={() => {
                      setBusy("buy");
                      setBuying(row.phoneNumber);
                      setError(null);
                      void fetch("/api/phone/numbers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phoneNumber: row.phoneNumber }),
                      })
                        .then(async (res) => {
                          const json = (await res.json()) as { phoneNumber?: string; error?: string };
                          if (!res.ok || !json.phoneNumber) {
                            throw new Error(json.error || "Could not buy that number.");
                          }
                          await updateWorkspace({ phoneNumber: json.phoneNumber });
                          toast.success("Number added to this brokerage");
                        })
                        .catch((err) => {
                          const msg = err instanceof Error ? err.message : "Could not buy that number.";
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

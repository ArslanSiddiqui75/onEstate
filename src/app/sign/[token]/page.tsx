"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SignPayload {
  name: string;
  status: string;
  signerName?: string;
  listingTitle?: string;
  summary?: string;
  signedAt?: string;
}

export default function PublicSignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const [doc, setDoc] = useState<SignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(`/api/esign/complete?token=${encodeURIComponent(token)}`);
        const json = (await res.json()) as SignPayload & { error?: string; ok?: boolean };
        if (!res.ok) {
          setError(json.error || "Signature request not found");
          return;
        }
        setDoc(json);
      } catch {
        setError("Could not load signature request");
      }
    })();
  }, [token]);

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/esign/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        status?: string;
        signedAt?: string;
      };
      if (!res.ok) {
        setError(json.error || "Could not complete signature");
        return;
      }
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              status: json.status || "signed",
              signedAt: json.signedAt || new Date().toISOString(),
            }
          : prev,
      );
    } catch {
      setError("Could not complete signature");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-16 text-[var(--foreground)]">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          0nEstate e-sign
        </p>
        <h1 className="mt-2 font-display text-3xl">Review &amp; sign</h1>
        {error ? (
          <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
        ) : !doc ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  doc.status === "signed"
                    ? "success"
                    : doc.status === "voided"
                      ? "danger"
                      : "warning"
                }
              >
                {doc.status}
              </Badge>
              <span className="text-sm text-[var(--muted)]">{doc.listingTitle}</span>
            </div>
            <div>
              <p className="text-sm font-medium">{doc.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Signer: {doc.signerName || "—"}
              </p>
            </div>
            <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm whitespace-pre-wrap">
              {doc.summary || "Please review and sign this transaction document."}
            </p>
            {doc.status === "signed" ? (
              <p className="text-sm text-[var(--success)]">
                Signed{doc.signedAt ? ` · ${new Date(doc.signedAt).toLocaleString()}` : ""}.
                You can close this page.
              </p>
            ) : doc.status === "voided" ? (
              <p className="text-sm text-[var(--danger)]">This request was voided.</p>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void sign()} className="w-full">
                {busy ? "Signing…" : "I agree — sign document"}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

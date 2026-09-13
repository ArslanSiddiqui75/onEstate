"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function ImpersonateButton({
  userId,
  label = "Open as",
}: {
  userId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/admin/impersonate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
            });
            const json = (await res.json().catch(() => null)) as {
              tokenHash?: string;
              error?: string;
            } | null;
            if (!res.ok || !json?.tokenHash) {
              throw new Error(json?.error || "Could not start impersonation");
            }
            const supabase = createBrowserSupabaseClient();
            if (!supabase) throw new Error("Supabase is not configured");
            const { error } = await supabase.auth.verifyOtp({
              token_hash: json.tokenHash,
              type: "email",
            });
            if (error) throw error;
            router.push("/app");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Impersonation failed");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      {busy ? "Opening…" : label}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface Session {
  targetName: string;
  orgName: string;
  adminEmail: string;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/impersonate")
      .then((res) => res.json())
      .then((json: { active?: boolean; session?: Session }) => {
        if (json.active && json.session) setSession(json.session);
      })
      .catch(() => {
        // Banner is best-effort.
      });
  }, []);

  if (!session) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
    >
      <p>
        Viewing as <strong>{session.targetName}</strong> / {session.orgName}.
        Operator {session.adminEmail}.
      </p>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              await fetch("/api/admin/impersonate", { method: "DELETE" });
              const supabase = createBrowserSupabaseClient();
              if (supabase) await supabase.auth.signOut();
              router.push("/admin");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Ending…" : "End session"}
      </Button>
    </div>
  );
}

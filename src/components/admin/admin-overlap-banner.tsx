"use client";

import { useEffect, useState } from "react";

export function AdminOverlapBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [impersonate, admin] = await Promise.all([
          fetch("/api/admin/impersonate"),
          fetch("/api/admin/session"),
        ]);
        if (impersonate.ok) {
          const json = (await impersonate.json()) as { active?: boolean };
          if (json.active) return;
        }
        if (!cancelled) setShow(admin.ok);
      } catch {
        if (!cancelled) setShow(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <p
      role="status"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--muted)]"
    >
      Platform admin is also signed in in this browser. Signing out of this
      workspace ends the admin session too.
    </p>
  );
}

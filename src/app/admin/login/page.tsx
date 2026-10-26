"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/lib/admin/session";
import {
  PLATFORM_ADMIN_ACCOUNTS,
  DEV_ADMIN_PASSWORD_HINT,
  isPlatformAdminDevHintsEnabled,
} from "@/lib/admin/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { AuthFrame } from "@/components/auth/auth-frame";

export default function AdminLoginPage() {
  const { signIn } = useAdminSession();
  const router = useRouter();
  const hints = isPlatformAdminDevHintsEnabled();
  const [email, setEmail] = useState(hints ? "admin@certified.local" : "");
  const [password, setPassword] = useState(hints ? DEV_ADMIN_PASSWORD_HINT : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <AuthFrame
      screen="admin"
      kicker="Operator"
      title="Platform sign in"
      lede="Subscriptions, tenants, and the audit trail. UK and US stay on separate books."
      asideTitle="Both markets, kept apart."
      asideBody="Each region bills on its own Stripe account. An operator change is written to the audit log."
      points={[
        "Organizations, seats, and lifecycle",
        "Pause, change, or cancel a subscription",
        "Who resolved a ticket, and how long it took",
      ]}
      footer={
        <Link href="/app/login" className="font-semibold text-[var(--accent)]">
          Workspace sign in
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setLoading(true);
            setError("");
            try {
              await signIn(email, password);
              router.push("/admin");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sign in failed");
            } finally {
              setLoading(false);
            }
          })();
        }}
      >
        <FormField label="Email" required>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@0nestreet.com"
            autoComplete="username"
          />
        </FormField>
        <FormField label="Password" required>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
          />
        </FormField>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Enter the console"}
        </Button>
      </form>

      {hints ? (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Local operators
          </p>
          <ul className="mt-3 grid gap-2">
            {PLATFORM_ADMIN_ACCOUNTS.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--accent)]"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEV_ADMIN_PASSWORD_HINT);
                    setError("");
                  }}
                >
                  <Avatar name={account.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{account.name}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{account.email}</span>
                  </span>
                  <span className="shrink-0 text-xs capitalize text-[var(--muted)]">
                    {account.role.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AuthFrame>
  );
}

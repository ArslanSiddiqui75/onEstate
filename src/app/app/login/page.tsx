"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { AuthFrame } from "@/components/auth/auth-frame";
import { loginSchema, validateForm } from "@/lib/auth/validation";
import {
  DEV_SEED_ACCOUNTS,
  DEV_SEED_PASSWORD,
  isDevSeedEnabled,
} from "@/lib/dev/seed-accounts";
import { ROLE_LABELS } from "@/lib/rbac/matrix";

export default function AppLoginPage() {
  const { signIn, authMode, brand } = useAppSession();
  const uk = brand.market === "uk";

  const [email, setEmail] = useState(authMode === "local" ? "owner@certified.local" : "");
  const [password, setPassword] = useState(authMode === "local" ? DEV_SEED_PASSWORD : "");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [formInfo, setFormInfo] = useState("");

  const showSeedAccounts = authMode === "local" && isDevSeedEnabled();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setFormInfo("");

    const result = validateForm(loginSchema, { email, password });
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, undefined, password);
      if (authMode === "supabase" && !password) {
        setFormInfo("Check your email for a magic link.");
        toast.success("Magic link sent. Check your inbox.");
      } else {
        toast.success("Signed in.");
      }
    } catch (err) {
      console.error("[login] Full error:", err);
      const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      screen="login"
      kicker={brand.domain}
      title={`Sign in to ${brand.name}`}
      lede={
        authMode === "supabase"
          ? "Use the email for this workspace. A new brokerage starts as its own account."
          : "Sign in to the workspace saved in this browser."
      }
      asideTitle={uk ? "Enquiries through to exchange." : "Enquiries through to close."}
      asideBody={
        uk
          ? "Viewings, lettings, and payments in pounds, on one workspace."
          : "Showings, progression, and payments in dollars, on one workspace."
      }
      points={
        uk
          ? [
              "Rightmove, Zoopla, and OnTheMarket drafts",
              "Diary for viewings and valuations",
              "Vendor, buyer, landlord, and tenant links",
            ]
          : [
              "Website and office leads on one list",
              "Diary for showings and valuations",
              "Seller, buyer, and landlord links",
            ]
      }
      footer={
        <>
          New brokerage?{" "}
          <Link href="/app/signup" className="font-semibold text-[var(--accent)]">
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Email" error={fieldErrors.email} required>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
            }}
            placeholder="you@brokerage.com"
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password" error={fieldErrors.password} required>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
            }}
            placeholder="Password"
            autoComplete="current-password"
          />
        </FormField>

        {authMode === "supabase" ? (
          <p className="text-right text-sm">
            <Link href="/app/reset-password" className="font-medium text-[var(--accent)]">
              Forgot password?
            </Link>
          </p>
        ) : null}

        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {formInfo ? <Alert tone="success">{formInfo}</Alert> : null}

        <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Continue"}
        </Button>
      </form>

      {showSeedAccounts ? (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Local accounts
          </p>
          <ul className="mt-3 grid gap-2">
            {DEV_SEED_ACCOUNTS.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--accent)]"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setFieldErrors({});
                    setFormError("");
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{account.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                      {account.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {ROLE_LABELS[account.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Shared local password: <code className="font-semibold">{DEV_SEED_PASSWORD}</code>
          </p>
        </div>
      ) : null}
    </AuthFrame>
  );
}

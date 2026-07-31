"use client";

/**
 * Login Page
 *
 * HOW THIS WORKS (for learning):
 *
 * This page lets users sign in to their workspace. It supports two modes:
 *
 * 1. "local" mode (default): Uses dev seed accounts stored in the browser.
 *    Good for development — no external services needed.
 *
 * 2. "supabase" mode: Uses Supabase Auth (email magic links or password).
 *    Used in production with a real database.
 *
 * WHAT'S `useState`?
 * A React "hook" that lets a component remember values between renders.
 * `const [email, setEmail] = useState("")` creates:
 *   - `email`: the current value (starts as "")
 *   - `setEmail`: a function to update it (triggers a re-render)
 *
 * WHAT'S `async/await`?
 * When we call `signIn()`, it might take time (network request). `async/await`
 * lets us write this asynchronous code in a readable, top-to-bottom way:
 *   await signIn(...)  ← waits for this to finish before continuing
 *
 * FORM VALIDATION FLOW:
 * 1. User clicks "Continue"
 * 2. We validate the form data with Zod (our validation library)
 * 3. If validation fails → show field-level errors, DON'T submit
 * 4. If validation passes → call signIn() and handle success/failure
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { loginSchema, validateForm } from "@/lib/auth/validation";
import {
  DEV_SEED_ACCOUNTS,
  DEV_SEED_PASSWORD,
  isDevSeedEnabled,
} from "@/lib/dev/seed-accounts";
import { ROLE_LABELS } from "@/lib/rbac/matrix";

export default function AppLoginPage() {
  const { signIn, authMode, brand } = useAppSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/app";

  // ── Form state ──
  // Each `useState` hook tracks one piece of state.
  const [email, setEmail] = useState("owner@certified.local");
  const [password, setPassword] = useState(DEV_SEED_PASSWORD);
  const [loading, setLoading] = useState(false);

  // ── Validation state ──
  // `fieldErrors` stores per-field error messages like { email: "Invalid email" }
  // `formError` stores a general form-level error (e.g., "Invalid credentials")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [formInfo, setFormInfo] = useState("");

  const showSeedAccounts = authMode === "local" && isDevSeedEnabled();

  async function onSubmit(e: React.FormEvent) {
    // Prevent the browser's default form submission (which would reload the page)
    e.preventDefault();

    // Clear previous errors
    setFieldErrors({});
    setFormError("");
    setFormInfo("");

    // Step 1: Validate the form data with our Zod schema
    const result = validateForm(loginSchema, { email, password });

    if (!result.success) {
      // Validation failed — show field-level errors and stop
      setFieldErrors(result.errors);
      return;
    }

    // Step 2: Validation passed — try to sign in
    setLoading(true);
    try {
      await signIn(email, undefined, password);

      if (authMode === "supabase") {
        setFormInfo("Check your email for a magic link.");
        toast.success("Magic link sent! Check your inbox.");
      } else {
        toast.success("Signed in successfully!");
        router.push(redirectTo);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="surface-panel relative w-full max-w-lg p-8 sm:p-10">
        <BrandMark
          className="text-3xl"
          accentClassName="text-[var(--accent)]"
        />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Sign in to {brand.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {authMode === "supabase"
            ? "We'll email you a magic link."
            : "Use a seed account below, or any email to create a workspace."}
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-3">
          {/* Email field with validation error display */}
          <FormField label="Email" error={fieldErrors.email} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear the error for this field as the user types
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              placeholder="you@brokerage.com"
              autoComplete="email"
            />
          </FormField>

          {/* Password field — shown for local auth mode */}
          {showSeedAccounts ? (
            <FormField label="Password" error={fieldErrors.password} required>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }
                }}
                placeholder="Password"
                autoComplete="current-password"
              />
            </FormField>
          ) : null}

          {/* Form-level error alert */}
          {formError && <Alert tone="danger">{formError}</Alert>}

          {/* Success info alert */}
          {formInfo && <Alert tone="success">{formInfo}</Alert>}

          <Button
            type="submit"
            className="w-full rounded-full"
            size="lg"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Continue"}
          </Button>
        </form>

        {/* Dev seed accounts — quick login buttons for testing different roles */}
        {showSeedAccounts ? (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Dev seed accounts — remove before deploy
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Shared password: <code className="font-semibold">{DEV_SEED_PASSWORD}</code>
            </p>
            <ul className="mt-3 space-y-2">
              {DEV_SEED_ACCOUNTS.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm transition hover:border-[var(--accent)]"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      // Clear any validation errors when selecting a seed account
                      setFieldErrors({});
                      setFormError("");
                    }}
                  >
                    <span>
                      <span className="font-medium">{account.name}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {account.email}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {ROLE_LABELS[account.role]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-sm text-[var(--muted)]">
          New brokerage?{" "}
          <Link href="/app/signup" className="font-semibold text-[var(--accent)]">
            Create workspace
          </Link>
        </p>
      </div>
    </div>
  );
}

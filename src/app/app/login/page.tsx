"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { loginSchema, validateForm } from "@/lib/auth/validation";
import {
  DEV_SEED_ACCOUNTS,
  isDevSeedEnabled,
} from "@/lib/dev/seed-accounts";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { cn } from "@/lib/utils";

export default function AppLoginPage() {
  const { signIn, authMode, brand } = useAppSession();
  const uk = brand.market === "uk";
  const home = uk ? "/UK" : "/US";
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const message = err instanceof Error ? err.message : "Sign in failed. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-auth-screen="login" className="flex min-h-dvh flex-col bg-[#e7edf1] dark:bg-[#10161c]">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href={home} className="inline-flex lg:hidden" aria-label="OneStreet">
          <BrandMark className="text-[15px]" />
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link
            href={home}
            className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Back to site
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      <main className="flex flex-1 items-center pb-8">
        <div className="grid w-full overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-float)] ring-1 ring-black/5 dark:ring-white/10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <aside className="relative hidden min-h-[40rem] flex-col justify-between overflow-hidden border-white/10 bg-[#071015] p-10 text-white lg:flex lg:border-r xl:p-12">
            <div className="pointer-events-none absolute inset-0 bg-[image:var(--ink-mesh)]" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#17baa8]/20 blur-3xl" />
            <Link href={home} className="relative inline-flex" aria-label="OneStreet">
              <BrandMark tone="dark" className="text-[1.65rem]" />
            </Link>
            <div className="relative max-w-sm">
              <h2 className="font-sans text-[3.25rem] font-semibold leading-[0.92] tracking-[-0.045em]">
                One login.
              </h2>
              <p className="mt-5 text-[15px] leading-relaxed text-white/70">
                Everything you need, just a login away.
              </p>
            </div>
            <div className="relative h-6" aria-hidden />
          </aside>

          <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
            <div className="mb-8 rounded-2xl bg-[#071015] px-4 py-4 text-white lg:hidden">
              <p className="text-base font-semibold tracking-[-0.03em]">One login.</p>
            </div>

            <h1 className="font-sans text-[2.6rem] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--foreground)]">
              Sign in
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              Use the email on your workspace.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor={emailId} className="text-sm font-medium text-[var(--foreground)]">
                  Email
                </label>
                <Input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="you@brokerage.com"
                  autoComplete="email"
                  autoFocus
                  className="h-12 rounded-xl px-4 text-[15px]"
                  aria-invalid={fieldErrors.email ? true : undefined}
                />
                {fieldErrors.email ? (
                  <p className="text-xs font-medium text-[var(--danger)]" role="alert">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={passwordId} className="text-sm font-medium text-[var(--foreground)]">
                    Password
                  </label>
                  <Link href="/app/reset-password" className="text-sm font-medium text-[var(--accent)]">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl px-4 pr-12 text-[15px]"
                    aria-invalid={fieldErrors.password ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-xs font-medium text-[var(--danger)]" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              {formError ? <Alert tone="danger">{formError}</Alert> : null}
              {formInfo ? <Alert tone="success">{formInfo}</Alert> : null}

              <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-sm text-[var(--muted)]">
              Still not on 0neStreet?{" "}
              <Link href="/app/signup" className="font-semibold text-[var(--accent)]">
                Sign Up Now
              </Link>
            </p>

            {showSeedAccounts ? (
              <details className="group mt-8 rounded-2xl border border-[var(--border)] bg-[var(--canvas)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    Try a role
                    <ChevronDown className="h-4 w-4 text-[var(--muted)] transition group-open:rotate-180" />
                  </span>
                  <span className="text-xs font-normal text-[var(--muted)] group-open:hidden">Local only</span>
                  <span className="hidden text-xs font-normal text-[var(--muted)] group-open:inline">
                    Fills the form
                  </span>
                </summary>
                <ul className="grid grid-cols-2 gap-1 px-2 pb-2">
                  {DEV_SEED_ACCOUNTS.map((account) => {
                    const selected = email === account.email;
                    return (
                      <li key={account.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                            selected
                              ? "bg-[var(--accent-soft)]"
                              : "hover:bg-[var(--surface-muted)]",
                          )}
                          onClick={() => {
                            setEmail(account.email);
                            setPassword(account.password);
                            setFieldErrors({});
                            setFormError("");
                          }}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-[11px] font-semibold text-[var(--foreground)]">
                            {account.avatarInitials}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{account.name}</span>
                            <span className="block truncate text-xs text-[var(--muted)]">
                              {ROLE_LABELS[account.role]}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

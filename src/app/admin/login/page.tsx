"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import {
  PLATFORM_ADMIN_ACCOUNTS,
  DEV_ADMIN_PASSWORD_HINT,
  isPlatformAdminDevHintsEnabled,
} from "@/lib/admin/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "@/components/ui/toast";

export default function AdminLoginPage() {
  const { signIn } = useAdminSession();
  const router = useRouter();
  const hints = isPlatformAdminDevHintsEnabled();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState(hints ? "admin@certified.local" : "");
  const [password, setPassword] = useState(hints ? DEV_ADMIN_PASSWORD_HINT : "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      toast.success("Signed in to the console.");
      router.push("/admin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-auth-screen="admin"
      className="login-screen relative flex min-h-dvh flex-col overflow-x-hidden"
    >
      <div className="login-field" aria-hidden>
        <img
          src="/brand/loader-mark-dark.webp"
          alt=""
          width={524}
          height={706}
          draggable={false}
          className="login-bg"
        />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/UK" className="inline-flex min-w-0 lg:hidden" aria-label="OneStreet">
          <img
            src="/brand/mark.png"
            alt=""
            width={291}
            height={322}
            draggable={false}
            className="h-8 w-auto dark:hidden"
          />
          <img
            src="/brand/mark-dark.png"
            alt=""
            width={304}
            height={345}
            draggable={false}
            className="hidden h-8 w-auto dark:block"
          />
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/app/login"
            className="text-[13px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] sm:text-sm"
          >
            Workspace sign in
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="login-body relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        <main className="flex flex-1 flex-col justify-start pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 lg:justify-center lg:py-8">
          <div className="my-0 grid w-full overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-float)] ring-1 ring-black/5 sm:rounded-[1.75rem] lg:my-auto dark:ring-white/10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <aside className="relative hidden min-h-[40rem] flex-col justify-between overflow-hidden border-white/10 bg-[#071015] p-10 text-white lg:flex lg:border-r xl:p-12">
              <div className="pointer-events-none absolute inset-0 bg-[image:var(--ink-mesh)]" />
              <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[#17baa8]/20 blur-3xl" />
              <Link href="/UK" className="relative inline-flex" aria-label="OneStreet">
                <img
                  src="/brand/mark-dark.png"
                  alt=""
                  width={304}
                  height={345}
                  draggable={false}
                  className="h-12 w-auto"
                />
              </Link>
              <div className="relative max-w-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7dccc2]">
                  Platform console
                </p>
                <h2 className="mt-4 font-sans text-[3.25rem] font-semibold leading-[0.92] tracking-[-0.045em]">
                  Both markets, kept apart.
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-white/70">
                  Subscriptions, tenants, and the audit trail. Each region bills on its own
                  Stripe account.
                </p>
                <ul className="mt-8 space-y-3">
                  {[
                    "Organizations, seats, and lifecycle",
                    "Pause, change, or cancel a subscription",
                    "Who resolved a ticket, and how long it took",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-white/85">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#17baa8]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative h-6" aria-hidden />
            </aside>

            <div className="flex flex-col justify-center px-5 py-7 sm:px-10 sm:py-12 lg:px-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Operator
              </p>
              <h1 className="mt-2 font-sans text-[2.05rem] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--foreground)] sm:text-[2.6rem]">
                Platform sign in
              </h1>
              <p className="mt-2.5 text-balance text-[15px] leading-snug text-[var(--muted)]">
                Enter the console for tenants, billing, and support across UK and US.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor={emailId} className="text-sm font-medium text-[var(--foreground)]">
                    Email
                  </label>
                  <Input
                    id={emailId}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@0nestreet.com"
                    autoComplete="username"
                    autoFocus={!hints}
                    className="h-12 rounded-[1rem] px-4 text-[15px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={passwordId}
                    className="text-sm font-medium text-[var(--foreground)]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id={passwordId}
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="h-12 rounded-[1rem] px-4 pr-12 text-[15px]"
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
                </div>

                {error ? <Alert tone="danger">{error}</Alert> : null}

                <Button
                  type="submit"
                  className="w-full rounded-[1rem]"
                  size="lg"
                  disabled={loading}
                >
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
                          className="flex w-full items-center gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
                          onClick={() => {
                            setEmail(account.email);
                            setPassword(DEV_ADMIN_PASSWORD_HINT);
                            setError("");
                          }}
                        >
                          <Avatar name={account.name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{account.name}</span>
                            <span className="block truncate text-xs text-[var(--muted)]">
                              {account.email}
                            </span>
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

              <p className="mt-6 text-sm text-[var(--muted)]">
                Looking for your workspace?{" "}
                <Link href="/app/login" className="font-semibold text-[var(--accent)]">
                  Workspace sign in here
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

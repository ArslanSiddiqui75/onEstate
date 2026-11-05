"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { toast } from "@/components/ui/toast";
import { LoginBrandPanel } from "@/components/auth/login-brand-panel";

/**
 * Operator lock screen. Password then TOTP 2FA — the console session is only
 * issued after MFA. Email/SMS channels are stubbed for later domain wiring.
 */
export function AdminGateLogin({
  headline,
  support,
}: {
  headline: string;
  support: string;
}) {
  const { signIn, verifyMfa } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();
  const gate = pathname.split("/").filter(Boolean)[0] || "";
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();

  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gate) {
      setError("Invalid credentials");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signIn(email, password, gate);
      setDevCode(result.devCode);
      setStep("mfa");
      setCode("");
      toast.success("Enter your authenticator code.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await verifyMfa(code.trim());
      toast.success("Signed in to the console.");
      router.push("/admin");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
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
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.85rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/UK" className="inline-flex min-w-0" aria-label="OneStreet">
          <img
            src="/brand/logo-light.png"
            alt="OneStreet"
            width={1292}
            height={331}
            draggable={false}
            className="h-7 w-auto dark:hidden"
          />
          <img
            src="/brand/logo-dark.png"
            alt=""
            width={1359}
            height={354}
            draggable={false}
            className="hidden h-7 w-auto dark:block"
          />
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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
        <main className="flex flex-1 flex-col justify-start pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:pt-4 lg:justify-center lg:py-8">
          <div className="my-0 flex w-full flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-float)] ring-1 ring-black/5 sm:rounded-[1.75rem] dark:ring-white/10 lg:my-auto lg:grid lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
            <LoginBrandPanel
              headline={headline}
              support={support}
              markClassName="h-auto w-[min(10.5rem,44%)] sm:w-[min(13rem,54%)] lg:w-[min(15.5rem,68%)]"
            />

            <div className="flex flex-col justify-center bg-[var(--surface-elevated)] px-5 py-7 sm:px-10 sm:py-12 lg:px-12">
              {step === "password" ? (
                <>
                  <h1 className="font-sans text-[2.05rem] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--foreground)] sm:text-[2.6rem]">
                    Sign in
                  </h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Password first. Authenticator code next.
                  </p>

                  <form
                    onSubmit={onPasswordSubmit}
                    className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor={emailId}
                        className="text-sm font-medium text-[var(--foreground)]"
                      >
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
                        autoFocus
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
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
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
                      {loading ? "Checking…" : "Continue"}
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[var(--accent)]">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                      Two-factor
                    </span>
                  </div>
                  <h1 className="mt-2 font-sans text-[2.05rem] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--foreground)] sm:text-[2.6rem]">
                    Enter code
                  </h1>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Open your authenticator app for {email || "this account"}.
                  </p>

                  <form
                    onSubmit={onMfaSubmit}
                    className="mt-6 space-y-4 sm:mt-8 sm:space-y-5"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor={codeId}
                        className="text-sm font-medium text-[var(--foreground)]"
                      >
                        6-digit code
                      </label>
                      <Input
                        id={codeId}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        required
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="000000"
                        autoFocus
                        className="h-12 rounded-[1rem] px-4 text-center font-mono text-[1.35rem] tracking-[0.35em]"
                      />
                    </div>

                    {devCode ? (
                      <Alert tone="success">
                        Local/dev hint — current code:{" "}
                        <span className="font-mono font-semibold">{devCode}</span>
                      </Alert>
                    ) : null}

                    {error ? <Alert tone="danger">{error}</Alert> : null}

                    <Button
                      type="submit"
                      className="w-full rounded-[1rem]"
                      size="lg"
                      disabled={loading || code.length !== 6}
                    >
                      {loading ? "Verifying…" : "Verify and sign in"}
                    </Button>

                    <button
                      type="button"
                      className="w-full text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
                      onClick={() => {
                        setStep("password");
                        setCode("");
                        setDevCode(undefined);
                        setError("");
                        setPassword("");
                      }}
                    >
                      Back to password
                    </button>
                  </form>
                </>
              )}

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

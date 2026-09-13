"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Mode = "request" | "reset";

export default function ResetPasswordPage() {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [mode, setMode] = useState<Mode>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabaseClient();
    // Supabase recovery links land back here with a recovery session; when
    // that happens we switch to the "choose a new password" form.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    void supabase.auth.getSession().then(({ data }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (data.session && (hash.includes("type=recovery") || mode === "reset")) {
        setMode("reset");
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter the email you sign in with.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo: `${window.location.origin}/app/reset-password` },
      );
      if (resetError) throw resetError;
      setInfo(
        "If an account exists for that email, a password reset link is on its way.",
      );
      toast.success("Reset link sent — check your inbox.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not send the reset email.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password updated — sign in with your new password.");
      await supabase.auth.signOut();
      router.replace("/app/login");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not update the password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="surface-panel relative w-full max-w-lg p-8 sm:p-10">
        <BrandMark className="text-3xl" accentClassName="text-[var(--accent)]" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {mode === "reset" ? "Choose a new password" : "Reset your password"}
        </h1>

        {!configured ? (
          <Alert tone="warning" className="mt-4">
            Password reset requires a hosted workspace. In local dev mode, use a
            seed account from the login page.
          </Alert>
        ) : mode === "reset" ? (
          <form onSubmit={onReset} className="mt-7 space-y-3">
            <FormField label="New password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Confirm new password" required>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat the password"
                autoComplete="new-password"
              />
            </FormField>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onRequest} className="mt-7 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Enter the email you sign in with and we&apos;ll send you a link to
              choose a new password.
            </p>
            <FormField label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@brokerage.com"
                autoComplete="email"
              />
            </FormField>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {info ? <Alert tone="success">{info}</Alert> : null}
            <Button type="submit" className="w-full rounded-full" size="lg" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm text-[var(--muted)]">
          Remembered it?{" "}
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

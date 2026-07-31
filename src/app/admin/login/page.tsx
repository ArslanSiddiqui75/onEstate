"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { PLATFORM_ADMIN_ACCOUNTS, PLATFORM_ADMIN_PASSWORD } from "@/lib/admin/accounts";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { fadeUp } from "@/lib/motion";

export default function AdminLoginPage() {
  const { signIn } = useAdminSession();
  const router = useRouter();
  const [email, setEmail] = useState("admin@certified.local");
  const [password, setPassword] = useState(PLATFORM_ADMIN_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0b121a_0%,#152031_60%,var(--canvas)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--ink-mesh)]" />
      <ThemeToggle className="absolute right-4 top-4 z-10 border-white/12 bg-white/5 text-white/70 hover:border-white/25 hover:bg-white/10 hover:text-white" />
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[var(--surface-elevated)]/95 p-8 shadow-[var(--shadow-float)] backdrop-blur-xl sm:p-10"
      >
        <div className="flex items-center gap-2">
          <BrandMark className="text-3xl" accentClassName="text-[var(--accent)]" />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Operator access
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Platform admin sign in</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Operator access for subscriptions, tenants, and platform audit.
        </p>
        <form
          className="mt-6 space-y-3"
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
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
          />
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Enter admin console"}
          </Button>
        </form>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}

        <div className="mt-6 rounded-[1.1rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Dev admin accounts — rotate before production
          </p>
          <p className="mt-2 text-sm">
            Password: <code className="font-semibold">{PLATFORM_ADMIN_PASSWORD}</code>
          </p>
          <ul className="mt-3 space-y-2">
            {PLATFORM_ADMIN_ACCOUNTS.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--accent)] hover:shadow-[var(--shadow-card)]"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
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
      </motion.div>
    </div>
  );
}

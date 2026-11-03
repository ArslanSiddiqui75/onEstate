"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordStrengthBar } from "@/components/ui/password-strength";
import { LogoLoader } from "@/components/brand/logo-loader";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import type { Role } from "@/types";

type InviteInfo = {
  email: string;
  name: string;
  role: string;
  orgName: string;
};

const ASIDE = {
  asideTitle: "Join your office.",
  asideBody: "Invites never open Checkout. Your brokerage already pays for the seat.",
  points: ["No card required", "Password + terms only", "Opens the shared workspace"],
};

export default function InviteAcceptPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
    if (!value) {
      setLoadError("This invite link is missing its token.");
      return;
    }
    fetch(`/api/team/invite/lookup?token=${encodeURIComponent(value)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Invite not found");
        setInfo({
          email: String(data.email),
          name: String(data.name || ""),
          role: String(data.role),
          orgName: String(data.orgName || "your team"),
        });
        setName(String(data.name || ""));
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Invite not found");
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");
    if (!acceptTerms) {
      setFieldError("Accept the Terms of Service to continue");
      return;
    }
    if (password.length < 6) {
      setFieldError("Password must be at least 6 characters");
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/team/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          name: name.trim() || undefined,
          acceptTerms: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not accept invite");
      setDone(true);
      window.setTimeout(() => router.replace("/app/login"), 1200);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Could not accept invite");
      setWorking(false);
    }
  }

  if (loadError) {
    return (
      <AuthFrame
        screen="signup"
        kicker="Team invite"
        title="Invite not valid"
        lede={loadError}
        {...ASIDE}
        footer={
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            Sign in
          </Link>
        }
      >
        <p className="text-sm text-[var(--muted)]">Ask your office for a fresh invite link.</p>
      </AuthFrame>
    );
  }

  if (!info) {
    return (
      <AuthFrame
        screen="signup"
        kicker="Team invite"
        title="Opening invite"
        lede="Checking your invite…"
        {...ASIDE}
      >
        <LogoLoader label="Loading invite" />
      </AuthFrame>
    );
  }

  if (done) {
    return (
      <AuthFrame
        screen="signup"
        kicker="Team invite"
        title="You’re in"
        lede={`Account created for ${info.orgName}. Sign in to open the workspace.`}
        {...ASIDE}
      >
        <Button className="w-full rounded-[1rem]" size="lg" onClick={() => router.replace("/app/login")}>
          Continue to sign in
        </Button>
      </AuthFrame>
    );
  }

  const roleLabel = ROLE_LABELS[info.role as Role] || info.role.replace("_", " ");

  return (
    <AuthFrame
      screen="signup"
      kicker="Team invite"
      title={`Join ${info.orgName}`}
      lede={`You’ve been invited as ${roleLabel}. Create a password — no payment required.`}
      {...ASIDE}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Work email">
          <Input value={info.email} disabled className="h-12 rounded-[1rem] px-4 text-[15px]" />
        </FormField>
        <FormField label="Your name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-[1rem] px-4 text-[15px]"
            autoComplete="name"
          />
        </FormField>
        <FormField label="Password" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-[1rem] px-4 text-[15px]"
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </FormField>
        <PasswordStrengthBar password={password} className="-mt-2" />
        <FormField error={fieldError}>
          <label className="flex items-start gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" target="_blank" className="font-semibold text-[var(--accent)]">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" target="_blank" className="font-semibold text-[var(--accent)]">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </FormField>
        <Button type="submit" className="w-full rounded-[1rem]" size="lg" disabled={working}>
          {working ? "Creating account…" : "Join workspace"}
        </Button>
        <p className="text-center text-xs text-[var(--muted)]">
          This does not open Checkout. Your office already pays for the seat.
        </p>
      </form>
    </AuthFrame>
  );
}

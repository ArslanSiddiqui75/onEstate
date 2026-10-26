"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PlanPicker } from "@/components/auth/plan-picker";
import { signupSchema, validateForm } from "@/lib/auth/validation";
import { isPlanId, loadPendingSignup, savePendingSignup } from "@/lib/auth/pending-signup";
import { PasswordStrengthBar } from "@/components/ui/password-strength";
import type { PlanId } from "@/types";

export default function AppSignupPage() {
  const { brand, market } = useAppSession();
  const router = useRouter();
  const uk = brand.market === "uk";
  const [plan, setPlan] = useState<PlanId>("team");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const pending = loadPendingSignup();
    if (pending) {
      setName(pending.name);
      setEmail(pending.email);
      setPassword(pending.password);
      setOrgName(pending.orgName);
      setPlan(pending.plan);
    }
    const requested = new URLSearchParams(window.location.search).get("plan");
    if (isPlanId(requested)) setPlan(requested);
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});

    const result = validateForm(signupSchema, { name, email, password, orgName, plan });
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    savePendingSignup(result.data);
    router.push(`/app/checkout?plan=${result.data.plan}`);
  }

  const money = brand.currency === "GBP" ? "pounds" : "dollars";

  return (
    <AuthFrame
      screen="signup"
      kicker={`${brand.regionShort} workspace`}
      title="Create your workspace"
      lede={`This is the ${brand.regionShort} book at ${brand.domain}. Next you'll review the plan in ${money}. The workspace opens after that step.`}
      asideTitle={uk ? "A separate book for the UK." : "A separate book for the US."}
      asideBody={
        uk
          ? "Your workspace bills in pounds and speaks viewings, vendors, and lettings."
          : "Your workspace bills in dollars and speaks showings, sellers, and close."
      }
      points={
        uk
          ? ["Solo £49, Team £199, Enterprise on request", "Lettings desk on Team and Enterprise", "One login on 0nestreet.co.uk"]
          : ["Solo $59, Team $249, Enterprise on request", "MLS-ready stock on Team and Enterprise", "One login on 0nestreet.com"]
      }
      footer={
        <>
          Already have a workspace?{" "}
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Your name" error={fieldErrors.name} required>
          <Input
            name="name"
            placeholder="Jane Smith"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Work email" error={fieldErrors.email} required>
          <Input
            name="email"
            type="email"
            placeholder="jane@brokerage.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Password" error={fieldErrors.password} required>
          <Input
            name="password"
            type="password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <PasswordStrengthBar password={password} className="-mt-2" />
        <FormField label="Brokerage name" error={fieldErrors.orgName} required>
          <Input
            name="orgName"
            placeholder={uk ? "Smith & Co" : "Smith Realty"}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        </FormField>

        <PlanPicker plan={plan} market={market} onChange={setPlan} error={fieldErrors.plan} />

        <Button type="submit" className="w-full rounded-full" size="lg">
          Continue to checkout
        </Button>
        <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
          Nothing is created on this step. You'll confirm {plan === "enterprise" ? "Enterprise" : "the price"} next.
        </p>
      </form>
    </AuthFrame>
  );
}

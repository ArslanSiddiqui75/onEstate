"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { formatPlanPrice } from "@/lib/brand/offer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { AuthFrame } from "@/components/auth/auth-frame";
import { signupSchema, validateForm } from "@/lib/auth/validation";
import { PasswordStrengthBar } from "@/components/ui/password-strength";
import { PLANS } from "@/lib/plans/catalog";
import { cn } from "@/lib/utils";
import type { PlanId } from "@/types";

const PLAN_ORDER: PlanId[] = ["solo", "team", "enterprise"];

export default function AppSignupPage() {
  const { signUp, authMode, brand, market } = useAppSession();
  const router = useRouter();
  const uk = brand.market === "uk";
  const [plan, setPlan] = useState<PlanId>("team");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [formInfo, setFormInfo] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("plan");
    if (requested === "solo" || requested === "team" || requested === "enterprise") {
      setPlan(requested);
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setFormInfo("");

    const form = new FormData(e.currentTarget);
    const formData = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      orgName: String(form.get("orgName")),
      plan: String(form.get("plan")),
    };

    const result = validateForm(signupSchema, formData);
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    setLoading(true);
    try {
      await signUp({
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
        orgName: result.data.orgName,
        plan: result.data.plan as PlanId,
      });

      if (authMode === "supabase" && !result.data.password) {
        setFormInfo("Check your email to verify and finish setup.");
        toast.success("Account created. Check your inbox.");
      } else {
        toast.success("Workspace created.");
        router.push("/app/onboarding");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signup failed. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const money = brand.currency === "GBP" ? "pounds" : "dollars";

  return (
    <AuthFrame
      screen="signup"
      kicker={`${brand.regionShort} workspace`}
      title="Create your workspace"
      lede={`This is the ${brand.regionShort} book at ${brand.domain}. Payments are in ${money}. Social accounts already connected stay on the workspace they belong to.`}
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
          <Input name="name" placeholder="Jane Smith" autoComplete="name" />
        </FormField>
        <FormField label="Work email" error={fieldErrors.email} required>
          <Input name="email" type="email" placeholder="jane@brokerage.com" autoComplete="email" />
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
          <Input name="orgName" placeholder={uk ? "Smith & Co" : "Smith Realty"} />
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--foreground)]">
            Plan
            <span className="ml-0.5 text-[var(--danger)]" aria-hidden>
              *
            </span>
          </legend>
          <div className="grid gap-2">
            {PLAN_ORDER.map((id) => {
              const item = PLANS[id];
              const price = formatPlanPrice(market, id);
              const selected = plan === id;
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 transition",
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={id}
                    checked={selected}
                    onChange={() => setPlan(id)}
                    className="sr-only"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{item.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{item.seats}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">
                    {id === "enterprise" ? price : `${price}/mo`}
                  </span>
                </label>
              );
            })}
          </div>
          {fieldErrors.plan ? (
            <p className="text-xs font-medium text-[var(--danger)]" role="alert">
              {fieldErrors.plan}
            </p>
          ) : null}
        </fieldset>

        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        {formInfo ? <Alert tone="success">{formInfo}</Alert> : null}

        <Button type="submit" className="w-full rounded-full" size="lg" disabled={loading}>
          {loading ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </AuthFrame>
  );
}

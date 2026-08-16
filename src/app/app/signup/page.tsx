"use client";

/**
 * Signup Page
 *
 * HOW THIS WORKS (for learning):
 *
 * This page lets new brokerages create a workspace. The flow is:
 * 1. User fills in: name, email, brokerage name, plan
 * 2. We validate all fields with Zod
 * 3. If valid, call `signUp()` to create the workspace
 * 4. In local mode: instantly redirects to /app
 *    In Supabase mode: shows "check your email" message
 *
 * WHAT'S `FormData`?
 * The browser has a built-in API called `FormData` that reads all the values
 * from a <form> element at once. Instead of tracking each field with useState,
 * we let the browser handle it and read the values on submit.
 *
 * WHY USE `FormData` HERE but `useState` on login?
 * Both approaches work! Login uses useState because we pre-fill the email
 * from seed accounts (easier with controlled inputs). Signup uses FormData
 * because it has more fields and we only need the values on submit.
 */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { signupSchema, validateForm } from "@/lib/auth/validation";
import type { PlanId } from "@/types";

export default function AppSignupPage() {
  const { signUp, authMode, brand } = useAppSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [formInfo, setFormInfo] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setFormError("");
    setFormInfo("");

    // Read all form values at once using the browser's FormData API
    const form = new FormData(e.currentTarget);
    const formData = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      orgName: String(form.get("orgName")),
      plan: String(form.get("plan")),
    };

    // Validate with Zod
    const result = validateForm(signupSchema, formData);

    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    // Validation passed — create the workspace
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
        toast.success("Account created! Check your inbox.");
      } else {
        toast.success("Workspace created!");
        // Guard in layout.tsx will auto-redirect to /app once user state is set
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Signup failed. Please try again.";
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
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          You&apos;re joining {brand.name} for {brand.localeLabel}. Market rules
          are applied automatically. Already connected social accounts live on
          an existing workspace —{" "}
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            sign in
          </Link>{" "}
          instead of creating another one.
        </p>

        <form onSubmit={onSubmit} className="mt-7 grid gap-3 sm:grid-cols-2">
          <FormField label="Your name" error={fieldErrors.name} required>
            <Input name="name" placeholder="Jane Smith" autoComplete="name" />
          </FormField>

          <FormField label="Work email" error={fieldErrors.email} required>
            <Input
              name="email"
              type="email"
              placeholder="jane@brokerage.com"
              autoComplete="email"
            />
          </FormField>

          <FormField label="Password" error={fieldErrors.password} required>
            <Input
              name="password"
              type="password"
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
          </FormField>

          <FormField
            label="Brokerage name"
            error={fieldErrors.orgName}
            required
            className="sm:col-span-2"
          >
            <Input name="orgName" placeholder="Smith & Co Realty" />
          </FormField>

          <FormField
            label="Plan"
            error={fieldErrors.plan}
            required
            className="sm:col-span-2"
          >
            <select
              name="plan"
              defaultValue="team"
              className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
              aria-label="Plan"
            >
              <option value="solo">Solo Agent — 1 user</option>
              <option value="team">Team / Brokerage — up to 25 users</option>
              <option value="enterprise">Enterprise — unlimited</option>
            </select>
          </FormField>

          {/* Form-level errors */}
          {formError && (
            <div className="sm:col-span-2">
              <Alert tone="danger">{formError}</Alert>
            </div>
          )}
          {formInfo && (
            <div className="sm:col-span-2">
              <Alert tone="success">{formInfo}</Alert>
            </div>
          )}

          <Button
            type="submit"
            className="rounded-full sm:col-span-2"
            size="lg"
            disabled={loading}
          >
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/app/login" className="font-semibold text-[var(--accent)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

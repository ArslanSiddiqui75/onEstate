"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { formatPlanPrice, planLines } from "@/lib/brand/offer";
import { PLANS } from "@/lib/plans/catalog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PlanPicker } from "@/components/auth/plan-picker";
import {
  clearPendingSignup,
  isPlanId,
  loadPendingSignup,
  updatePendingPlan,
  type PendingSignup,
} from "@/lib/auth/pending-signup";
import {
  signupCheckoutActionLabel,
  signupCheckoutNote,
  type SignupCheckoutPreviewReason,
} from "@/lib/stripe/signup-checkout";
import type { PlanId } from "@/types";

type CheckoutMode = "sales" | "preview" | "live";

export default function CheckoutPage() {
  const { signUp, brand, market } = useAppSession();
  const router = useRouter();
  const opening = useRef(false);
  const [booted, setBooted] = useState(false);
  const [plan, setPlan] = useState<PlanId>("team");
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [mode, setMode] = useState<CheckoutMode | null>(null);
  const [reason, setReason] = useState<SignupCheckoutPreviewReason | undefined>();
  const [statusError, setStatusError] = useState("");
  const [formError, setFormError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const stored = loadPendingSignup();
    const requested = new URLSearchParams(window.location.search).get("plan");
    const nextPlan = isPlanId(requested) ? requested : stored?.plan || "team";
    if (stored && stored.plan !== nextPlan) {
      setPending(updatePendingPlan(nextPlan));
    } else {
      setPending(stored);
    }
    setPlan(nextPlan);
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    const controller = new AbortController();
    setMode(null);
    setReason(undefined);
    setStatusError("");
    fetch(`/api/stripe/signup-checkout?plan=${plan}&market=${market}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Checkout status failed");
        if (data?.mode !== "live" && data?.mode !== "preview" && data?.mode !== "sales") {
          throw new Error("Checkout status failed");
        }
        if (controller.signal.aborted) return;
        setMode(data.mode);
        setReason(data.reason === "account" || data.reason === "price" ? data.reason : undefined);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setStatusError(err instanceof Error ? err.message : "Checkout status failed");
      });
    return () => controller.abort();
  }, [booted, plan, market]);

  function selectPlan(next: PlanId) {
    setPlan(next);
    setFormError("");
    const updated = updatePendingPlan(next);
    if (updated) setPending(updated);
    const url = new URL(window.location.href);
    url.searchParams.set("plan", next);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
  }

  async function openWorkspace() {
    if (opening.current) return;
    const current = loadPendingSignup();
    if (!current) {
      setPending(null);
      return;
    }
    opening.current = true;
    setWorking(true);
    setFormError("");
    try {
      await signUp({ ...current, plan });
      clearPendingSignup();
      toast.success("Workspace created.");
      router.push("/app/onboarding");
    } catch (err) {
      opening.current = false;
      setWorking(false);
      const message = err instanceof Error ? err.message : "Could not open the workspace.";
      setFormError(message);
      toast.error(message);
    }
  }

  async function confirm() {
    if (!pending || !mode || working) return;
    setFormError("");
    if (mode !== "live") {
      await openWorkspace();
      return;
    }
    setWorking(true);
    try {
      const res = await fetch("/api/stripe/signup-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          market,
          email: pending.email,
          orgName: pending.orgName,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (data?.mode === "live" && typeof data.url === "string") {
        window.location.assign(data.url);
        return;
      }
      if (data?.mode === "preview" || data?.mode === "sales") {
        setMode(data.mode);
        setReason(data.reason === "account" || data.reason === "price" ? data.reason : undefined);
        setWorking(false);
        await openWorkspace();
        return;
      }
      throw new Error(data?.error || "Checkout failed");
    } catch (err) {
      setWorking(false);
      const message = err instanceof Error ? err.message : "Checkout failed";
      setFormError(message);
      toast.error(message);
    }
  }

  const item = PLANS[plan];
  const price = formatPlanPrice(market, plan);
  const priceLabel = plan === "enterprise" ? price : `${price}/mo`;
  const note = mode
    ? signupCheckoutNote({
        mode,
        reason,
        region: brand.regionShort,
        planName: item.name,
        priceLabel,
      })
    : "";

  return (
    <AuthFrame
      screen="checkout"
      kicker={`${brand.regionShort} checkout`}
      title="Review your plan"
      lede={
        pending
          ? `Confirm ${item.name} for ${pending.orgName}. The workspace stays closed until this step finishes.`
          : "Checkout needs the workspace details from the previous step."
      }
      asideTitle={plan === "enterprise" ? "Custom, with the team." : `${item.name}, ${priceLabel}.`}
      asideBody={
        mode === "live"
          ? brand.market === "uk"
            ? "You'll enter the card on the UK Stripe account. The workspace opens when you return."
            : "You'll enter the card on the US Stripe account. The workspace opens when you return."
          : brand.market === "uk"
            ? "Pounds, on the UK Stripe account, once that account is connected."
            : "Dollars, on the US Stripe account, once that account is connected."
      }
      points={planLines(market, plan)}
      footer={
        pending ? (
          <>
            Wrong details?{" "}
            <Link href={`/app/signup?plan=${plan}`} className="font-semibold text-[var(--accent)]">
              Edit workspace
            </Link>
          </>
        ) : (
          <>
            Already have a workspace?{" "}
            <Link href="/app/login" className="font-semibold text-[var(--accent)]">
              Sign in
            </Link>
          </>
        )
      }
    >
      {!booted ? (
        <p className="text-sm text-[var(--muted)]">Loading checkout…</p>
      ) : (
        <div className="space-y-4" data-checkout-plan={plan} data-checkout-mode={mode || "pending"}>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {mode === "live" ? "Billed monthly on Stripe" : "Selected plan"}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{item.name}</p>
                <p className="text-xs text-[var(--muted)]">{item.seats}</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)]" data-checkout-price={priceLabel}>
                {plan === "enterprise" ? (
                  price
                ) : (
                  <>
                    {price}
                    <span className="text-sm font-medium text-[var(--muted)]">/mo</span>
                  </>
                )}
              </p>
            </div>
            {pending ? (
              <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Email</dt>
                  <dd className="truncate font-medium">{pending.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--muted)]">Brokerage</dt>
                  <dd className="truncate font-medium">{pending.orgName}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          <ul className="space-y-2 lg:hidden">
            {planLines(market, plan).map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {pending ? (
            <PlanPicker plan={plan} market={market} onChange={selectPlan} />
          ) : (
            <Alert tone="warning">
              Enter your name, email, and brokerage first. This page only confirms the plan.
            </Alert>
          )}

          {statusError ? <Alert tone="danger">{statusError}</Alert> : null}
          {note ? <Alert tone={mode === "live" ? "neutral" : "warning"}>{note}</Alert> : null}
          {formError ? <Alert tone="danger">{formError}</Alert> : null}

          {pending ? (
            <Button
              type="button"
              className="w-full rounded-full"
              size="lg"
              disabled={!mode || working}
              onClick={confirm}
            >
              {working ? "Continuing…" : mode ? signupCheckoutActionLabel(mode) : "Checking checkout…"}
            </Button>
          ) : (
            <Button asChild className="w-full rounded-full" size="lg">
              <Link href={`/app/signup?plan=${plan}`}>Continue setup</Link>
            </Button>
          )}
        </div>
      )}
    </AuthFrame>
  );
}

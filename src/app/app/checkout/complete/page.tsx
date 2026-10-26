"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/lib/app/session";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LogoLoader } from "@/components/brand/logo-loader";
import { completePendingSignup, isPlanId, loadPendingSignup } from "@/lib/auth/pending-signup";
import type { Market, PlanId } from "@/types";

type Phase = "working" | "missing" | "already" | "error";

export default function CheckoutCompletePage() {
  const { user, loading, signUp, brand, authMode, getAuthToken } = useAppSession();
  const router = useRouter();
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<PlanId>("team");

  useEffect(() => {
    if (loading || started.current) return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("plan");
    const nextPlan: PlanId = isPlanId(requested) ? requested : "team";
    setPlan(nextPlan);
    const market: Market = params.get("market") === "us" ? "us" : "uk";
    const sessionId = params.get("session_id") || "";

    if (user) {
      setPhase("already");
      return;
    }
    if (!sessionId || sessionId.includes("{")) {
      setPhase("missing");
      return;
    }

    started.current = true;
    const pending = loadPendingSignup();
    if (!pending) {
      setPhase("missing");
      return;
    }

    fetch("/api/stripe/signup-checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, plan: nextPlan, market }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Could not confirm checkout");
        const paidEmail = typeof data?.email === "string" ? data.email.toLowerCase() : "";
        if (paidEmail && paidEmail !== pending.email.toLowerCase()) {
          throw new Error("Checkout was completed for a different email than this browser saved.");
        }
        const customerId = typeof data?.customerId === "string" ? data.customerId : "";
        const subscriptionId = typeof data?.subscriptionId === "string" ? data.subscriptionId : "";
        if (!customerId || !subscriptionId) {
          throw new Error("Stripe hasn't created the subscription yet.");
        }
        const result = await completePendingSignup((input) =>
          signUp({
            ...input,
            plan: nextPlan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: typeof data?.subscriptionStatus === "string" ? data.subscriptionStatus : "active",
            currentPeriodEnd: typeof data?.currentPeriodEnd === "string" ? data.currentPeriodEnd : undefined,
            lastPaymentStatus: "paid",
            lastPaymentAt: new Date().toISOString(),
          }),
        );
        if (result === "missing") {
          setPhase("missing");
          return;
        }
        if (authMode === "supabase") {
          const token = await getAuthToken();
          const linked = await fetch("/api/stripe/signup-checkout/attach", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ sessionId, plan: nextPlan, market }),
          });
          const linkedBody = await linked.json().catch(() => null);
          if (!linked.ok) {
            throw new Error(linkedBody?.error || "The subscription exists on Stripe, but it could not be linked yet.");
          }
        }
        router.replace("/app/onboarding");
      })
      .catch((err: unknown) => {
        started.current = false;
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Could not open the workspace.");
      });
  }, [loading, user, signUp, router, authMode, getAuthToken]);

  const signupHref = `/app/signup?plan=${plan}`;

  return (
    <AuthFrame
      screen="checkout"
      kicker={`${brand.regionShort} checkout`}
      title={phase === "working" ? "Finishing checkout" : "Checkout return"}
      lede={
        phase === "working"
          ? "Checking the Stripe payment, then opening the workspace from the details in this browser."
          : "The workspace opens after Stripe confirms the payment for the details saved here."
      }
      asideTitle="Same browser, same plan."
      asideBody="Stripe sends you back here. The workspace opens only after that payment checks out."
      points={["Plan stays the one you reviewed", "Password never went to Stripe", "Setup continues in onboarding"]}
      footer={
        <Link href={signupHref} className="font-semibold text-[var(--accent)]">
          Back to workspace details
        </Link>
      }
    >
      {phase === "working" ? <LogoLoader layout="compact" label="Checking payment…" /> : null}
      {phase === "missing" ? (
        <div className="space-y-4">
          <Alert tone="warning">
            This return doesn't have a finished Stripe payment and the workspace details together. Go back to checkout, or start again. The plan you picked stays on the form.
          </Alert>
          <Button asChild className="w-full rounded-full" size="lg">
            <Link href={`/app/checkout?plan=${plan}`}>Back to checkout</Link>
          </Button>
        </div>
      ) : null}
      {phase === "already" ? (
        <div className="space-y-4">
          <Alert tone="neutral">You're already in a workspace. Continue there, or sign out before opening another one.</Alert>
          <Button asChild className="w-full rounded-full" size="lg">
            <Link href="/app">Go to workspace</Link>
          </Button>
        </div>
      ) : null}
      {phase === "error" ? (
        <div className="space-y-4">
          <Alert tone="danger">{message}</Alert>
          <Button asChild className="w-full rounded-full" size="lg">
            <Link href={`/app/checkout?plan=${plan}`}>Back to checkout</Link>
          </Button>
        </div>
      ) : null}
    </AuthFrame>
  );
}

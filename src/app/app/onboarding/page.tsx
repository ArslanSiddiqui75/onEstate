"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Globe2, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { PLANS } from "@/lib/plans/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import type { PlanId } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, org, setPlan, market } = useAppSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState(org?.name || "");
  const [selectedMarket, setSelectedMarket] = useState<"uk" | "us">(market || "uk");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("team");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function handleComplete() {
    setBusy(true);
    try {
      if (selectedPlan !== org?.plan) {
        await setPlan(selectedPlan);
      }
      toast.success("Workspace setup complete!");
      router.push("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to setup workspace");
    } finally {
      setBusy(false);
    }
  }

  const currency = selectedMarket === "uk" ? "£" : "$";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--background)]">
      <div className="w-full max-w-2xl space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white text-sm font-semibold">
              {step}
            </span>
            <div>
              <h1 className="font-display text-xl tracking-tight">
                {step === 1 ? "Workspace Details" : "Choose Your Plan"}
              </h1>
              <p className="text-xs text-[var(--muted)]">Step {step} of 2</p>
            </div>
          </div>
          <Badge tone="accent">Tenant Onboarding</Badge>
        </div>

        {step === 1 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Card className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Organization / Brokerage Name
                </label>
                <div className="relative mt-1.5">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Apex Realty Group"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Primary Market Region
                </label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {[
                    { id: "uk", title: "United Kingdom", desc: "Rightmove, Zoopla, OTM feeds & GBP" },
                    { id: "us", title: "United States", desc: "MLS board feeds, disclosures & USD" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMarket(m.id as "uk" | "us")}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                        selectedMarket === m.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-glow-accent)]"
                          : "border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <Globe2 className="h-5 w-5 shrink-0 text-[var(--accent)] mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">{m.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  disabled={!orgName.trim()}
                  onClick={() => setStep(2)}
                  className="gap-2"
                >
                  Continue to Plan Selection <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const planDef = PLANS[id];
                const price =
                  id === "enterprise"
                    ? "Custom"
                    : `${currency}${selectedMarket === "uk" ? planDef.monthlyPriceGbp : planDef.monthlyPriceUsd}/mo`;
                const isSelected = selectedPlan === id;

                return (
                  <Card
                    key={id}
                    hover
                    onClick={() => setSelectedPlan(id)}
                    className={`cursor-pointer relative transition-all ${
                      isSelected
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)] bg-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)]"
                    }`}
                  >
                    {planDef.popular ? (
                      <Badge tone="accent" className="absolute top-3 right-3 text-[10px]">
                        Popular
                      </Badge>
                    ) : null}

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                      ) : null}
                      <h3 className="font-semibold">{planDef.name}</h3>
                    </div>

                    <p className="mt-1 text-xs text-[var(--muted)]">{planDef.seats}</p>
                    <p className="mt-3 font-display text-2xl tracking-tight">{price}</p>

                    <ul className="mt-3 space-y-1 text-[11px] text-[var(--muted)]">
                      <li>• CRM: {planDef.modules.crm}</li>
                      <li>• Portals: {planDef.modules.listings}</li>
                    </ul>
                  </Card>
                );
              })}
            </div>

            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <span>
                  Selected Plan: <strong>{PLANS[selectedPlan].name}</strong>
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={busy} onClick={() => void handleComplete()}>
                  {busy ? "Setting up…" : "Launch Workspace"}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

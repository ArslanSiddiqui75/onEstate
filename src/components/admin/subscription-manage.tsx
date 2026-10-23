"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { subscriptionActions, type SubscriptionActionOption } from "@/lib/admin/subscription-actions";
import { PLANS } from "@/lib/plans/catalog";
import { planAmount } from "@/lib/admin/registry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/utils";
import type { TenantRecord } from "@/lib/admin/types";

function planPrice(option: SubscriptionActionOption, tenant: TenantRecord) {
  if (!option.plan) return null;
  if (option.plan === "enterprise") return "Custom";
  return formatMoney(planAmount(option.plan, tenant.market), tenant.market);
}

export function SubscriptionManageMenu({ tenant }: { tenant: TenantRecord }) {
  const { canManageBilling, manageSubscription } = useAdminSession();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<SubscriptionActionOption | null>(null);
  const options = subscriptionActions(tenant);
  const plans = options.filter((option) => option.action === "change_plan");
  const routine = options.filter((option) => option.action !== "change_plan" && !option.destructive);
  const destructive = options.filter((option) => option.destructive);
  const region = tenant.market === "uk" ? "UK · GBP" : "US · USD";

  async function run(option: SubscriptionActionOption) {
    setPending(true);
    try {
      const message = await manageSubscription(tenant.id, option.action, option.plan);
      toast.success(message);
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the subscription");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            disabled={!canManageBilling || pending}
            data-subscription-manage={tenant.id}
            aria-label={`Manage subscription for ${tenant.name}`}
          >
            {pending ? "Working…" : "Manage"}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" data-subscription-menu="">
          <DropdownMenuLabel>
            <p className="font-semibold">{tenant.name}</p>
            <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
              {PLANS[tenant.subscription.plan].name} · {region}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <DropdownMenuItem disabled>
              This subscription is canceled. A new checkout starts the next one.
            </DropdownMenuItem>
          ) : null}
          {routine.map((option) => (
            <DropdownMenuItem
              key={option.action}
              disabled={pending}
              data-subscription-action={option.action}
              onSelect={() => void run(option)}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{option.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {plans.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-subscription-action="change_plan">Change plan</DropdownMenuSubTrigger>
              <DropdownMenuSubContent data-subscription-plans="">
                {plans.map((option) => (
                  <DropdownMenuItem
                    key={option.plan}
                    disabled={pending}
                    data-subscription-action="change_plan"
                    data-plan={option.plan}
                    onSelect={() => void run(option)}
                  >
                    <span className="flex w-full items-baseline justify-between gap-4">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-[var(--muted)]">{planPrice(option, tenant)}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {destructive.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructive.map((option) => (
            <DropdownMenuItem
              key={option.action}
              destructive
              disabled={pending}
              data-subscription-action={option.action}
              onSelect={() => setConfirm(option)}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs opacity-80">{option.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.label}</DialogTitle>
            <DialogDescription>
              {confirm?.description} This applies to {tenant.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !confirm}
              data-subscription-confirm=""
              onClick={() => confirm && void run(confirm)}
            >
              {pending ? "Working…" : confirm?.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

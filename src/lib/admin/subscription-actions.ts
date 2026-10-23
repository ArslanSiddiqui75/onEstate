import { PLAN_FEATURE_FLAGS, PLANS } from "@/lib/plans/catalog";
import type { Market, PlanId } from "@/types";
import type {
  SubscriptionStatus,
  TenantLifecycleStatus,
  TenantRecord,
  TenantSubscription,
} from "@/lib/admin/types";

export const SUBSCRIPTION_ACTIONS = [
  "continue",
  "pause",
  "retry_payment",
  "extend_trial",
  "charge_automatically",
  "send_invoice",
  "change_plan",
  "cancel_at_period_end",
  "cancel_now",
] as const;

export type SubscriptionAction = (typeof SUBSCRIPTION_ACTIONS)[number];

export interface SubscriptionActionOption {
  action: SubscriptionAction;
  label: string;
  description: string;
  destructive?: boolean;
  plan?: PlanId;
}

export interface SubscriptionProjection {
  summary: string;
  lifecycleStatus: TenantLifecycleStatus;
  subscription: Pick<
    TenantSubscription,
    | "status"
    | "plan"
    | "unitAmount"
    | "mrr"
    | "seatsIncluded"
    | "cancelAtPeriodEnd"
    | "collectionMethod"
    | "lastPaymentStatus"
  > & {
    canceledAt?: string | null;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
    lastPaymentAt?: string | null;
    stripePriceId?: string | null;
  };
}

type Account = Pick<TenantRecord, "name" | "market" | "lifecycleStatus" | "subscription">;

const TRIAL_EXTENSION_MS = 14 * 24 * 60 * 60 * 1000;

function unitAmount(plan: PlanId, market: Market) {
  if (plan === "enterprise") return 0;
  return market === "uk" ? PLANS[plan].monthlyPriceGbp : PLANS[plan].monthlyPriceUsd;
}

function seatsIncluded(plan: PlanId) {
  return PLAN_FEATURE_FLAGS[plan]?.maxSeats ?? 999;
}

function billedMrr(status: SubscriptionStatus, amount: number) {
  if (status === "active" || status === "past_due" || status === "unpaid") return amount;
  return 0;
}

function trialStillOpen(trialEndsAt: string | undefined, now: Date) {
  if (!trialEndsAt) return false;
  const ends = new Date(trialEndsAt).getTime();
  return Number.isFinite(ends) && ends > now.getTime();
}

function lifecycleFor(status: SubscriptionStatus): TenantLifecycleStatus {
  if (status === "trialing" || status === "incomplete") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "paused") return "suspended";
  return "canceled";
}

export function subscriptionActions(account: Pick<Account, "subscription">): SubscriptionActionOption[] {
  const sub = account.subscription;
  const ended = sub.status === "canceled";
  const paused = sub.status === "paused";
  const options: SubscriptionActionOption[] = [];

  if (paused || sub.cancelAtPeriodEnd) {
    options.push({
      action: "continue",
      label: "Continue",
      description: paused
        ? sub.cancelAtPeriodEnd
          ? "Resume collection and keep this subscription renewing."
          : "Resume collection on this subscription."
        : "Keep this subscription renewing after the current period.",
    });
  }

  if (!ended && !paused) {
    options.push({
      action: "pause",
      label: "Pause",
      description: "Stop collecting payment until you continue.",
    });
  }

  if (sub.status === "past_due" || sub.status === "unpaid" || sub.lastPaymentStatus === "failed") {
    options.push({
      action: "retry_payment",
      label: "Retry payment",
      description: "Charge the open invoice again.",
    });
  }

  if (sub.status === "trialing") {
    options.push({
      action: "extend_trial",
      label: "Extend trial",
      description: "Add 14 days to the trial.",
    });
  }

  if (!ended) {
    if (sub.collectionMethod !== "charge_automatically") {
      options.push({
        action: "charge_automatically",
        label: "Charge automatically",
        description: "Bill the card on file each period.",
      });
    }
    if (sub.collectionMethod !== "send_invoice") {
      options.push({
        action: "send_invoice",
        label: "Send invoice",
        description: "Email an invoice that is due in 7 days.",
      });
    }
    for (const plan of ["solo", "team", "enterprise"] as const) {
      if (plan === sub.plan) continue;
      options.push({
        action: "change_plan",
        plan,
        label: PLANS[plan].name,
        description:
          plan === "enterprise"
            ? "Record a custom, sales-assisted plan."
            : "Prorate the difference on the next invoice.",
      });
    }
    if (!sub.cancelAtPeriodEnd) {
      options.push({
        action: "cancel_at_period_end",
        label: "Cancel at period end",
        description: "Access stays until the current period ends.",
        destructive: true,
      });
    }
    options.push({
      action: "cancel_now",
      label: "Cancel now",
      description: "End the subscription today and drop its recurring revenue.",
      destructive: true,
    });
  }

  return options;
}

export function projectSubscriptionAction(
  account: Account,
  action: SubscriptionAction,
  options?: { plan?: PlanId; now?: Date },
): SubscriptionProjection {
  const now = options?.now ?? new Date();
  const sub = account.subscription;
  const allowed = subscriptionActions(account).some(
    (option) => option.action === action && (action !== "change_plan" || option.plan === options?.plan),
  );
  if (!allowed) {
    throw new Error("That action is not available for this subscription.");
  }

  const next = {
    status: sub.status,
    plan: sub.plan,
    unitAmount: sub.unitAmount,
    mrr: sub.mrr,
    seatsIncluded: sub.seatsIncluded,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    collectionMethod: sub.collectionMethod,
    lastPaymentStatus: sub.lastPaymentStatus,
    canceledAt: sub.canceledAt ?? null,
    trialEndsAt: sub.trialEndsAt ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ?? null,
    lastPaymentAt: sub.lastPaymentAt ?? null,
    stripePriceId: sub.stripePriceId ?? null,
  };

  let summary = `${account.name} subscription updated.`;

  if (action === "pause") {
    next.status = "paused";
    next.mrr = 0;
    summary = `Paused ${account.name}. Collection stays off until you continue.`;
  }

  if (action === "continue") {
    next.cancelAtPeriodEnd = false;
    if (sub.status === "paused") {
      const stillTrialing = trialStillOpen(sub.trialEndsAt, now);
      next.status = stillTrialing ? "trialing" : "active";
      next.mrr = billedMrr(next.status, sub.unitAmount);
      if (next.status === "active") next.lastPaymentStatus = sub.lastPaymentStatus === "failed" ? "pending" : sub.lastPaymentStatus;
      summary = `Continued ${account.name}. Collection resumes on this subscription.`;
    } else {
      summary = `Continued ${account.name}. It will renew after this period.`;
    }
  }

  if (action === "cancel_at_period_end") {
    next.cancelAtPeriodEnd = true;
    summary = `Scheduled ${account.name} to cancel at the end of the current period.`;
  }

  if (action === "cancel_now") {
    next.status = "canceled";
    next.mrr = 0;
    next.cancelAtPeriodEnd = false;
    next.canceledAt = now.toISOString();
    summary = `Canceled ${account.name}. Recurring revenue for this account is now zero.`;
  }

  if (action === "retry_payment") {
    next.status = "active";
    next.mrr = billedMrr("active", sub.unitAmount);
    next.lastPaymentStatus = "paid";
    next.lastPaymentAt = now.toISOString();
    summary = `Retried payment for ${account.name}. The account is active again.`;
  }

  if (action === "extend_trial") {
    const base = trialStillOpen(sub.trialEndsAt, now) ? new Date(sub.trialEndsAt as string) : now;
    const extended = new Date(base.getTime() + TRIAL_EXTENSION_MS).toISOString();
    next.status = "trialing";
    next.mrr = 0;
    next.trialEndsAt = extended;
    next.currentPeriodEnd = extended;
    summary = `Extended the trial for ${account.name} by 14 days.`;
  }

  if (action === "charge_automatically") {
    next.collectionMethod = "charge_automatically";
    summary = `${account.name} will be charged automatically.`;
  }

  if (action === "send_invoice") {
    next.collectionMethod = "send_invoice";
    summary = `${account.name} will be sent an invoice due in 7 days.`;
  }

  if (action === "change_plan") {
    const plan = options?.plan;
    if (!plan) throw new Error("Choose a plan.");
    const amount = unitAmount(plan, account.market);
    next.plan = plan;
    next.unitAmount = amount;
    next.seatsIncluded = seatsIncluded(plan);
    next.mrr = billedMrr(next.status, amount);
    summary = `Changed ${account.name} to ${PLANS[plan].name}.`;
  }

  return {
    summary,
    lifecycleStatus: lifecycleFor(next.status),
    subscription: next,
  };
}

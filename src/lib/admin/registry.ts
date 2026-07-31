import { PLANS } from "@/lib/plans/catalog";
import { getActiveBrand } from "@/lib/brand/config";
import type { Market, PlanId, Role } from "@/types";
import type {
  PlatformAuditEvent,
  PlatformRegistry,
  SubscriptionStatus,
  TenantLifecycleStatus,
  TenantRecord,
  TenantUsageSnapshot,
} from "@/lib/admin/types";
import { newId } from "@/lib/data/workspace-store";

const REGISTRY_KEY = "certified_platform_registry_v1";
const ADMIN_AUTH_KEY = "certified_platform_admin_auth_v1";

function nowIso() {
  return new Date().toISOString();
}

function emptyUsage(): TenantUsageSnapshot {
  return {
    leads: 0,
    contacts: 0,
    listings: 0,
    deals: 0,
    messages: 0,
    callLogs: 0,
    socialPosts: 0,
    openTasks: 0,
  };
}

function planAmount(plan: PlanId, market: Market) {
  const def = PLANS[plan];
  if (plan === "enterprise") return 0;
  return market === "uk" ? def.monthlyPriceGbp : def.monthlyPriceUsd;
}

function seatLimit(plan: PlanId) {
  if (plan === "solo") return 1;
  if (plan === "team") return 25;
  return 999;
}

function healthFrom(tenant: Pick<TenantRecord, "lifecycleStatus" | "usage" | "subscription" | "lastActiveAt">) {
  let score = 70;
  if (tenant.lifecycleStatus === "active") score += 15;
  if (tenant.lifecycleStatus === "trialing") score += 5;
  if (tenant.lifecycleStatus === "past_due") score -= 25;
  if (tenant.lifecycleStatus === "suspended") score -= 40;
  if (tenant.lifecycleStatus === "canceled" || tenant.lifecycleStatus === "churned") {
    score -= 50;
  }
  if (tenant.subscription.lastPaymentStatus === "failed") score -= 20;
  if (tenant.usage.leads + tenant.usage.listings > 0) score += 10;
  const days =
    (Date.now() - new Date(tenant.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days > 14) score -= 15;
  if (days > 30) score -= 15;
  return Math.max(0, Math.min(100, score));
}

export function loadPlatformRegistry(): PlatformRegistry {
  if (typeof window === "undefined") {
    return { version: 1, tenants: [], audit: [], updatedAt: nowIso() };
  }
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) {
      const empty: PlatformRegistry = {
        version: 1,
        tenants: [],
        audit: [],
        updatedAt: nowIso(),
      };
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(empty));
      return empty;
    }
    return JSON.parse(raw) as PlatformRegistry;
  } catch {
    return { version: 1, tenants: [], audit: [], updatedAt: nowIso() };
  }
}

export function savePlatformRegistry(registry: PlatformRegistry) {
  if (typeof window === "undefined") return;
  registry.updatedAt = nowIso();
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function readPlatformAdminAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY);
    return raw
      ? (JSON.parse(raw) as {
          id: string;
          name: string;
          email: string;
          role: "super_admin" | "billing_admin" | "support_admin";
        })
      : null;
  } catch {
    return null;
  }
}

export function writePlatformAdminAuth(admin: {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "billing_admin" | "support_admin";
}) {
  localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(admin));
}

export function clearPlatformAdminAuth() {
  localStorage.removeItem(ADMIN_AUTH_KEY);
}

function pushAudit(
  registry: PlatformRegistry,
  event: Omit<PlatformAuditEvent, "id" | "at"> & { at?: string },
) {
  registry.audit = [
    {
      id: newId("audit"),
      at: event.at || nowIso(),
      actorEmail: event.actorEmail,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      summary: event.summary,
      metadata: event.metadata,
    },
    ...registry.audit,
  ].slice(0, 500);
}

export function upsertTenantRecord(
  input: {
    id: string;
    name: string;
    market: Market;
    plan: PlanId;
    ownerName: string;
    ownerEmail: string;
    billingEmail?: string;
    members?: TenantRecord["members"];
    usage?: Partial<TenantUsageSnapshot>;
    source?: TenantRecord["source"];
    stripeCustomerId?: string;
    actorEmail?: string;
  },
) {
  const registry = loadPlatformRegistry();
  const brand = getActiveBrand();
  const existing = registry.tenants.find((t) => t.id === input.id);
  const amount = planAmount(input.plan, input.market);
  const currency = input.market === "uk" ? "GBP" : "USD";
  const seatsUsed = input.members?.length || existing?.members.length || 1;

  if (existing) {
    existing.name = input.name;
    existing.market = input.market;
    existing.brand = brand.id;
    existing.ownerName = input.ownerName;
    existing.ownerEmail = input.ownerEmail;
    existing.billingEmail = input.billingEmail || input.ownerEmail;
    existing.updatedAt = nowIso();
    existing.lastActiveAt = nowIso();
    if (input.members) existing.members = input.members;
    if (input.usage) existing.usage = { ...existing.usage, ...input.usage };
    existing.subscription.plan = input.plan;
    existing.subscription.unitAmount = amount;
    existing.subscription.mrr =
      existing.subscription.status === "canceled" ||
      existing.subscription.status === "unpaid"
        ? 0
        : amount;
    existing.subscription.currency = currency;
    existing.subscription.seatsIncluded = seatLimit(input.plan);
    existing.subscription.seatsUsed = seatsUsed;
    if (input.stripeCustomerId) {
      existing.subscription.stripeCustomerId = input.stripeCustomerId;
    }
    existing.healthScore = healthFrom(existing);
    pushAudit(registry, {
      actorEmail: input.actorEmail || input.ownerEmail,
      action: "tenant.updated",
      entityType: "tenant",
      entityId: existing.id,
      summary: `Updated tenant ${existing.name}`,
    });
    savePlatformRegistry(registry);
    return existing;
  }

  const createdAt = nowIso();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const tenant: TenantRecord = {
    id: input.id,
    name: input.name,
    market: input.market,
    brand: brand.id,
    lifecycleStatus: "trialing",
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    billingEmail: input.billingEmail || input.ownerEmail,
    createdAt,
    updatedAt: createdAt,
    lastActiveAt: createdAt,
    healthScore: 75,
    tags: ["new"],
    internalNotes: "",
    members: input.members || [
      {
        id: newId("member"),
        name: input.ownerName,
        email: input.ownerEmail,
        role: "owner" as Role,
        status: "active",
        lastSeenAt: createdAt,
      },
    ],
    usage: { ...emptyUsage(), ...input.usage },
    subscription: {
      id: newId("sub"),
      plan: input.plan,
      status: "trialing",
      interval: "month",
      currency,
      unitAmount: amount,
      mrr: 0,
      seatsIncluded: seatLimit(input.plan),
      seatsUsed,
      stripeCustomerId: input.stripeCustomerId,
      trialEndsAt: periodEnd,
      currentPeriodStart: createdAt,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      collectionMethod: "charge_automatically",
      lastPaymentStatus: "none",
      nextInvoiceAt: periodEnd,
    },
    websitePublished: false,
    source: input.source || "signup",
  };
  tenant.healthScore = healthFrom(tenant);
  registry.tenants = [tenant, ...registry.tenants];
  pushAudit(registry, {
    actorEmail: input.actorEmail || input.ownerEmail,
    action: "tenant.created",
    entityType: "tenant",
    entityId: tenant.id,
    summary: `Created tenant ${tenant.name} on ${tenant.subscription.plan}`,
  });
  savePlatformRegistry(registry);
  return tenant;
}

export function syncTenantUsage(
  orgId: string,
  usage: Partial<TenantUsageSnapshot>,
  extras?: { websitePublished?: boolean; lastActiveAt?: string },
) {
  const registry = loadPlatformRegistry();
  const tenant = registry.tenants.find((t) => t.id === orgId);
  if (!tenant) return null;
  tenant.usage = { ...tenant.usage, ...usage };
  if (extras?.websitePublished != null) {
    tenant.websitePublished = extras.websitePublished;
  }
  tenant.lastActiveAt = extras?.lastActiveAt || nowIso();
  tenant.updatedAt = nowIso();
  tenant.healthScore = healthFrom(tenant);
  savePlatformRegistry(registry);
  return tenant;
}

export function setTenantPlan(
  orgId: string,
  plan: PlanId,
  actorEmail: string,
) {
  const registry = loadPlatformRegistry();
  const tenant = registry.tenants.find((t) => t.id === orgId);
  if (!tenant) return null;
  const amount = planAmount(plan, tenant.market);
  tenant.subscription.plan = plan;
  tenant.subscription.unitAmount = amount;
  tenant.subscription.mrr =
    tenant.subscription.status === "active" ||
    tenant.subscription.status === "past_due"
      ? amount
      : tenant.subscription.status === "trialing"
        ? 0
        : amount;
  tenant.subscription.seatsIncluded = seatLimit(plan);
  tenant.updatedAt = nowIso();
  tenant.healthScore = healthFrom(tenant);
  pushAudit(registry, {
    actorEmail,
    action: "subscription.plan_changed",
    entityType: "subscription",
    entityId: tenant.subscription.id,
    summary: `Changed ${tenant.name} plan to ${plan}`,
    metadata: { plan },
  });
  savePlatformRegistry(registry);

  // Keep local product workspace plan aligned when present
  if (typeof window !== "undefined") {
    try {
      const key = `certified_workspace_v1:${orgId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const snap = JSON.parse(raw) as { org?: { plan?: PlanId } };
        if (snap.org) {
          snap.org.plan = plan;
          localStorage.setItem(key, JSON.stringify(snap));
        }
      }
    } catch {
      // ignore workspace alignment errors
    }
  }

  return tenant;
}

export function setTenantSubscriptionStatus(
  orgId: string,
  status: SubscriptionStatus,
  actorEmail: string,
  reason?: string,
) {
  const registry = loadPlatformRegistry();
  const tenant = registry.tenants.find((t) => t.id === orgId);
  if (!tenant) throw new Error("Tenant not found");

  const previous = tenant.subscription.status;
  tenant.subscription.status = status;
  tenant.updatedAt = nowIso();

  const lifecycleMap: Record<SubscriptionStatus, TenantLifecycleStatus> = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "trialing",
    unpaid: "past_due",
    paused: "suspended",
  };
  tenant.lifecycleStatus = lifecycleMap[status];

  if (status === "canceled") {
    tenant.subscription.canceledAt = nowIso();
    tenant.subscription.mrr = 0;
    tenant.lifecycleStatus = "canceled";
  }
  if (status === "active") {
    tenant.subscription.mrr = tenant.subscription.unitAmount;
    tenant.subscription.lastPaymentStatus = "paid";
    tenant.subscription.lastPaymentAt = nowIso();
    tenant.tags = Array.from(new Set([...tenant.tags.filter((t) => t !== "new"), "paying"]));
  }
  if (status === "past_due" || status === "unpaid") {
    tenant.subscription.lastPaymentStatus = "failed";
    tenant.subscription.mrr = tenant.subscription.unitAmount;
  }

  tenant.healthScore = healthFrom(tenant);
  pushAudit(registry, {
    actorEmail,
    action: "subscription.status_changed",
    entityType: "subscription",
    entityId: tenant.subscription.id,
    summary: `Subscription ${previous} → ${status} for ${tenant.name}`,
    metadata: { previous, status, reason: reason || null },
  });
  savePlatformRegistry(registry);
  return tenant;
}

export function setTenantLifecycle(
  orgId: string,
  lifecycleStatus: TenantLifecycleStatus,
  actorEmail: string,
  notes?: string,
) {
  const registry = loadPlatformRegistry();
  const tenant = registry.tenants.find((t) => t.id === orgId);
  if (!tenant) throw new Error("Tenant not found");
  const previous = tenant.lifecycleStatus;
  tenant.lifecycleStatus = lifecycleStatus;
  tenant.updatedAt = nowIso();
  if (notes) {
    tenant.internalNotes = `${tenant.internalNotes}\n[${nowIso()}] ${notes}`.trim();
  }
  if (lifecycleStatus === "suspended") {
    tenant.subscription.status = "paused";
  }
  if (lifecycleStatus === "churned") {
    tenant.subscription.status = "canceled";
    tenant.subscription.mrr = 0;
    tenant.subscription.canceledAt = nowIso();
  }
  tenant.healthScore = healthFrom(tenant);
  pushAudit(registry, {
    actorEmail,
    action: "tenant.lifecycle_changed",
    entityType: "tenant",
    entityId: tenant.id,
    summary: `Lifecycle ${previous} → ${lifecycleStatus} for ${tenant.name}`,
  });
  savePlatformRegistry(registry);
  return tenant;
}

export function updateTenantNotes(
  orgId: string,
  notes: string,
  actorEmail: string,
) {
  const registry = loadPlatformRegistry();
  const tenant = registry.tenants.find((t) => t.id === orgId);
  if (!tenant) throw new Error("Tenant not found");
  tenant.internalNotes = notes;
  tenant.updatedAt = nowIso();
  pushAudit(registry, {
    actorEmail,
    action: "tenant.notes_updated",
    entityType: "tenant",
    entityId: tenant.id,
    summary: `Updated internal notes for ${tenant.name}`,
  });
  savePlatformRegistry(registry);
  return tenant;
}

export function ensureSeedTenantsVisible() {
  // Northbridge shared seed org appears in admin once any seed user has signed in.
  const registry = loadPlatformRegistry();
  return registry;
}

export function getPlatformMetrics(registry: PlatformRegistry) {
  const active = registry.tenants.filter((t) => t.lifecycleStatus === "active");
  const trialing = registry.tenants.filter((t) => t.lifecycleStatus === "trialing");
  const pastDue = registry.tenants.filter((t) => t.lifecycleStatus === "past_due");
  const suspended = registry.tenants.filter((t) => t.lifecycleStatus === "suspended");
  const canceled = registry.tenants.filter(
    (t) => t.lifecycleStatus === "canceled" || t.lifecycleStatus === "churned",
  );
  const mrr = registry.tenants.reduce((sum, t) => sum + (t.subscription.mrr || 0), 0);
  const seats = registry.tenants.reduce(
    (sum, t) => sum + t.subscription.seatsUsed,
    0,
  );
  return {
    tenantCount: registry.tenants.length,
    activeCount: active.length,
    trialingCount: trialing.length,
    pastDueCount: pastDue.length,
    suspendedCount: suspended.length,
    canceledCount: canceled.length,
    mrr,
    arr: mrr * 12,
    seats,
    avgHealth:
      registry.tenants.length === 0
        ? 0
        : Math.round(
            registry.tenants.reduce((s, t) => s + t.healthScore, 0) /
              registry.tenants.length,
          ),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrandByMarket } from "@/lib/brand/config";
import {
  emptyUsage,
  healthFrom,
  planAmount,
  seatLimit,
} from "@/lib/admin/registry";
import type {
  PlatformAuditEvent,
  PlatformRegistry,
  SubscriptionStatus,
  TenantLifecycleStatus,
  TenantRecord,
  TenantUsageSnapshot,
} from "@/lib/admin/types";
import type { Market, PlanId, Role } from "@/types";

type ServiceClient = SupabaseClient;

const LIFECYCLE_FROM_SUB: Record<string, TenantLifecycleStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  paused: "suspended",
  incomplete: "trialing",
};

async function countByOrg(
  supabase: ServiceClient,
  table: string,
): Promise<Map<string, number>> {
  const { data } = await supabase.from(table).select("org_id");
  const map = new Map<string, number>();
  for (const row of data || []) {
    const id = String((row as { org_id?: string }).org_id || "");
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

async function writeAudit(
  supabase: ServiceClient,
  event: {
    actorEmail: string;
    action: string;
    entityType: PlatformAuditEvent["entityType"];
    entityId: string;
    summary: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  await supabase.from("platform_audit_events").insert({
    actor_email: event.actorEmail,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId,
    summary: event.summary,
    metadata: event.metadata || {},
  });
}

export async function upsertPlatformSubscriptionFromOrg(
  supabase: ServiceClient,
  orgId: string,
) {
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, market, plan, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, current_period_end, cancel_at_period_end, trial_ends_at, last_payment_status, last_payment_at",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return;

  const market = (org.market === "us" ? "us" : "uk") as Market;
  const plan = (org.plan || "solo") as PlanId;
  const amount = planAmount(plan, market);
  const status = String(org.subscription_status || "trialing") as SubscriptionStatus;
  const mrr =
    status === "active" || status === "past_due" ? amount : 0;

  const { count: seatsUsed } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  await supabase.from("platform_subscriptions").upsert(
    {
      org_id: orgId,
      plan,
      status,
      interval: "month",
      currency: market === "uk" ? "GBP" : "USD",
      unit_amount: amount,
      mrr,
      seats_included: seatLimit(plan),
      seats_used: seatsUsed || 1,
      stripe_customer_id: org.stripe_customer_id,
      stripe_subscription_id: org.stripe_subscription_id,
      stripe_price_id: org.stripe_price_id,
      trial_ends_at: org.trial_ends_at,
      current_period_end: org.current_period_end,
      cancel_at_period_end: Boolean(org.cancel_at_period_end),
      collection_method: "charge_automatically",
      last_payment_status: org.last_payment_status || "none",
      last_payment_at: org.last_payment_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
}

export async function loadPlatformRegistryFromDb(
  supabase: ServiceClient,
): Promise<PlatformRegistry> {
  const [
    orgsRes,
    tenantsRes,
    subsRes,
    profilesRes,
    auditRes,
    leads,
    contacts,
    listings,
    deals,
    messages,
    calls,
    posts,
    tasks,
    sites,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, market, plan, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, current_period_end, cancel_at_period_end, trial_ends_at, last_payment_status, last_payment_at, created_at, updated_at",
      ),
    supabase.from("platform_tenants").select("*"),
    supabase.from("platform_subscriptions").select("*"),
    supabase.from("profiles").select("id, org_id, full_name, role"),
    supabase
      .from("platform_audit_events")
      .select("*")
      .order("at", { ascending: false })
      .limit(200),
    countByOrg(supabase, "leads"),
    countByOrg(supabase, "contacts"),
    countByOrg(supabase, "listings"),
    countByOrg(supabase, "transactions"),
    countByOrg(supabase, "messages"),
    countByOrg(supabase, "call_logs"),
    countByOrg(supabase, "social_posts"),
    supabase.from("lead_tasks").select("org_id, status"),
    supabase.from("websites").select("org_id, published"),
  ]);

  const usersRes = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (usersRes.data?.users || []).map((u) => [u.id, u.email || ""]),
  );

  const tenantsById = new Map(
    (tenantsRes.data || []).map((row) => [String(row.id), row]),
  );
  const subsByOrg = new Map(
    (subsRes.data || []).map((row) => [String(row.org_id), row]),
  );
  const membersByOrg = new Map<string, TenantRecord["members"]>();
  for (const profile of profilesRes.data || []) {
    const orgId = String(profile.org_id);
    const list = membersByOrg.get(orgId) || [];
    list.push({
      id: String(profile.id),
      name: String(profile.full_name || "Member"),
      email: emailById.get(String(profile.id)) || "",
      role: (profile.role || "agent") as Role,
      status: "active",
    });
    membersByOrg.set(orgId, list);
  }

  const openTasks = new Map<string, number>();
  for (const row of tasks.data || []) {
    if (String(row.status) !== "open") continue;
    const id = String(row.org_id);
    openTasks.set(id, (openTasks.get(id) || 0) + 1);
  }
  const publishedSites = new Set(
    (sites.data || [])
      .filter((row) => row.published)
      .map((row) => String(row.org_id)),
  );

  const tenants: TenantRecord[] = [];
  for (const org of orgsRes.data || []) {
    const orgId = String(org.id);
    const market = (org.market === "us" ? "us" : "uk") as Market;
    const plan = (org.plan || "solo") as PlanId;
    const members = membersByOrg.get(orgId) || [];
    const owner =
      members.find((m) => m.role === "owner") || members[0];
    let meta = tenantsById.get(orgId);
    if (!meta) {
      await supabase.from("platform_tenants").upsert({
        id: orgId,
        lifecycle_status:
          LIFECYCLE_FROM_SUB[String(org.subscription_status || "trialing")] ||
          "trialing",
        owner_name: owner?.name || org.name,
        owner_email: owner?.email || "",
        billing_email: owner?.email || "",
        source: "signup",
        website_published: publishedSites.has(orgId),
        last_active_at: new Date().toISOString(),
      });
      meta = {
        id: orgId,
        lifecycle_status:
          LIFECYCLE_FROM_SUB[String(org.subscription_status || "trialing")] ||
          "trialing",
        owner_name: owner?.name || org.name,
        owner_email: owner?.email || "",
        billing_email: owner?.email || "",
        health_score: 70,
        tags: ["new"],
        internal_notes: "",
        source: "signup",
        website_published: publishedSites.has(orgId),
        last_active_at: new Date().toISOString(),
        created_at: org.created_at,
        updated_at: org.updated_at,
      };
    }

    const subRow = subsByOrg.get(orgId);
    const amount = planAmount(plan, market);
    const subStatus = String(
      subRow?.status || org.subscription_status || "trialing",
    ) as SubscriptionStatus;
    const usage: TenantUsageSnapshot = {
      ...emptyUsage(),
      leads: leads.get(orgId) || 0,
      contacts: contacts.get(orgId) || 0,
      listings: listings.get(orgId) || 0,
      deals: deals.get(orgId) || 0,
      messages: messages.get(orgId) || 0,
      callLogs: calls.get(orgId) || 0,
      socialPosts: posts.get(orgId) || 0,
      openTasks: openTasks.get(orgId) || 0,
    };

    const tenant: TenantRecord = {
      id: orgId,
      name: String(org.name),
      market,
      brand: getBrandByMarket(market).id,
      lifecycleStatus: (meta.lifecycle_status ||
        LIFECYCLE_FROM_SUB[subStatus] ||
        "trialing") as TenantLifecycleStatus,
      ownerName: String(meta.owner_name || owner?.name || org.name),
      ownerEmail: String(meta.owner_email || owner?.email || ""),
      billingEmail: String(meta.billing_email || meta.owner_email || owner?.email || ""),
      createdAt: String(org.created_at || meta.created_at),
      updatedAt: String(org.updated_at || meta.updated_at),
      lastActiveAt: String(meta.last_active_at || org.updated_at),
      healthScore: Number(meta.health_score || 70),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      internalNotes: String(meta.internal_notes || ""),
      members,
      usage,
      subscription: {
        id: String(subRow?.id || `sub_${orgId}`),
        plan,
        status: subStatus,
        interval: (subRow?.interval === "year" ? "year" : "month"),
        currency: market === "uk" ? "GBP" : "USD",
        unitAmount: Number(subRow?.unit_amount ?? amount),
        mrr: Number(subRow?.mrr ?? (subStatus === "active" ? amount : 0)),
        seatsIncluded: Number(subRow?.seats_included ?? seatLimit(plan)),
        seatsUsed: members.length || Number(subRow?.seats_used || 1),
        stripeCustomerId: org.stripe_customer_id || subRow?.stripe_customer_id || undefined,
        stripeSubscriptionId:
          org.stripe_subscription_id || subRow?.stripe_subscription_id || undefined,
        stripePriceId: org.stripe_price_id || subRow?.stripe_price_id || undefined,
        trialEndsAt: org.trial_ends_at || subRow?.trial_ends_at || undefined,
        currentPeriodEnd: org.current_period_end || subRow?.current_period_end || undefined,
        cancelAtPeriodEnd: Boolean(
          org.cancel_at_period_end ?? subRow?.cancel_at_period_end,
        ),
        collectionMethod: "charge_automatically",
        lastPaymentStatus: (org.last_payment_status ||
          subRow?.last_payment_status ||
          "none") as TenantRecord["subscription"]["lastPaymentStatus"],
        lastPaymentAt: org.last_payment_at || subRow?.last_payment_at || undefined,
      },
      websitePublished: Boolean(meta.website_published) || publishedSites.has(orgId),
      source: (meta.source || "signup") as TenantRecord["source"],
    };
    tenant.healthScore = healthFrom(tenant);
    tenants.push(tenant);
  }

  const audit: PlatformAuditEvent[] = (auditRes.data || []).map((row) => ({
    id: String(row.id),
    at: String(row.at),
    actorEmail: String(row.actor_email),
    action: String(row.action),
    entityType: row.entity_type as PlatformAuditEvent["entityType"],
    entityId: String(row.entity_id),
    summary: String(row.summary),
    metadata: (row.metadata || undefined) as PlatformAuditEvent["metadata"],
  }));

  return {
    version: 1,
    tenants,
    audit,
    updatedAt: new Date().toISOString(),
  };
}

export async function patchPlatformTenant(
  supabase: ServiceClient,
  orgId: string,
  actorEmail: string,
  patch: {
    lifecycleStatus?: TenantLifecycleStatus;
    notes?: string;
    plan?: PlanId;
    subscriptionStatus?: SubscriptionStatus;
  },
) {
  const { data: tenant } = await supabase
    .from("platform_tenants")
    .select("id, internal_notes, lifecycle_status")
    .eq("id", orgId)
    .maybeSingle();

  if (patch.notes != null) {
    await supabase
      .from("platform_tenants")
      .update({
        internal_notes: patch.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);
    await writeAudit(supabase, {
      actorEmail,
      action: "tenant.notes_updated",
      entityType: "tenant",
      entityId: orgId,
      summary: `Updated internal notes`,
    });
  }

  if (patch.lifecycleStatus) {
    const previous = String(tenant?.lifecycle_status || "");
    const subPatch: Record<string, unknown> = {
      lifecycle_status: patch.lifecycleStatus,
      updated_at: new Date().toISOString(),
    };
    if (patch.notes && patch.notes !== tenant?.internal_notes) {
      subPatch.internal_notes = patch.notes;
    }
    await supabase.from("platform_tenants").update(subPatch).eq("id", orgId);
    if (patch.lifecycleStatus === "suspended") {
      await supabase
        .from("platform_subscriptions")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("org_id", orgId);
    }
    if (patch.lifecycleStatus === "churned" || patch.lifecycleStatus === "canceled") {
      await supabase
        .from("platform_subscriptions")
        .update({
          status: "canceled",
          mrr: 0,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);
    }
    await writeAudit(supabase, {
      actorEmail,
      action: "tenant.lifecycle_changed",
      entityType: "tenant",
      entityId: orgId,
      summary: `Lifecycle ${previous} → ${patch.lifecycleStatus}`,
    });
  }

  if (patch.plan) {
    await supabase
      .from("organizations")
      .update({ plan: patch.plan, updated_at: new Date().toISOString() })
      .eq("id", orgId);
    const { data: org } = await supabase
      .from("organizations")
      .select("market")
      .eq("id", orgId)
      .maybeSingle();
    const market = (org?.market === "us" ? "us" : "uk") as Market;
    const amount = planAmount(patch.plan, market);
    await supabase
      .from("platform_subscriptions")
      .update({
        plan: patch.plan,
        unit_amount: amount,
        seats_included: seatLimit(patch.plan),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
    await writeAudit(supabase, {
      actorEmail,
      action: "subscription.plan_changed",
      entityType: "subscription",
      entityId: orgId,
      summary: `Changed plan to ${patch.plan}`,
      metadata: { plan: patch.plan },
    });
  }

  if (patch.subscriptionStatus) {
    await supabase
      .from("organizations")
      .update({
        subscription_status: patch.subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);
    await supabase
      .from("platform_subscriptions")
      .update({
        status: patch.subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
    await writeAudit(supabase, {
      actorEmail,
      action: "subscription.status_changed",
      entityType: "subscription",
      entityId: orgId,
      summary: `Subscription → ${patch.subscriptionStatus}`,
      metadata: { status: patch.subscriptionStatus },
    });
  }
}

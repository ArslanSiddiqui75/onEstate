import { upsertTenantRecord, syncTenantUsage } from "@/lib/admin/registry";
import type { WorkspaceSnapshot } from "@/lib/data/workspace-store";

/** Keep SaaS admin registry in sync with live brokerage workspaces. */
export function syncWorkspaceToPlatformRegistry(
  snap: WorkspaceSnapshot,
  source: "signup" | "seed" | "import" | "manual" = "signup",
) {
  upsertTenantRecord({
    id: snap.org.id,
    name: snap.org.name,
    market: snap.org.market,
    plan: snap.org.plan,
    ownerName:
      snap.members.find((m) => m.role === "owner")?.name || snap.user.name,
    ownerEmail:
      snap.members.find((m) => m.role === "owner")?.email || snap.user.email,
    billingEmail:
      snap.members.find((m) => m.role === "owner")?.email || snap.user.email,
    members: snap.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      status: "active" as const,
      lastSeenAt: new Date().toISOString(),
    })),
    usage: {
      leads: snap.leads.length,
      contacts: snap.contacts?.length || 0,
      listings: snap.listings.length,
      deals: snap.deals.length,
      messages: snap.messages.length,
      callLogs: snap.callLogs.length,
      socialPosts: snap.socialPosts?.length || 0,
      openTasks: snap.tasks.filter((t) => t.status === "open").length,
    },
    source,
    stripeCustomerId: snap.org.stripeCustomerId,
    actorEmail: snap.user.email,
  });

  syncTenantUsage(
    snap.org.id,
    {
      leads: snap.leads.length,
      contacts: snap.contacts?.length || 0,
      listings: snap.listings.length,
      deals: snap.deals.length,
      messages: snap.messages.length,
      callLogs: snap.callLogs.length,
      socialPosts: snap.socialPosts?.length || 0,
      openTasks: snap.tasks.filter((t) => t.status === "open").length,
    },
    {
      websitePublished: Boolean(snap.website?.published),
      lastActiveAt: new Date().toISOString(),
    },
  );
}

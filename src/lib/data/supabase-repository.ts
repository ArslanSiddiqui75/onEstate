import type {
  AutomationRun,
  AutomationRunStep,
  CallLog,
  Contact,
  ConversationMessage,
  Lead,
  LeadActivity,
  LeadStage,
  Listing,
  ListingStatus,
  MessageSequence,
  OrgMember,
  PlanId,
  SequenceEnrollment,
  SocialAccount,
  SocialMediaItem,
  SocialPost,
  TransactionDeal,
  WebsiteSite,
} from "@/types";
import type { WorkspaceRepository } from "@/lib/data/repository";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { WorkspaceOrg, WorkspaceSnapshot, WorkspaceUser } from "@/lib/data/workspace-store";
import { newId } from "@/lib/data/workspace-store";
import { toast } from "@/components/ui/toast";
import { fallbackSlug, normalizeHost } from "@/lib/website/slug";

function mapLead(row: Record<string, unknown>, phones: Lead["phones"] = []): Lead {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email || ""),
    phone: String(row.phone || phones[0]?.number || ""),
    phones,
    type: row.lead_type as Lead["type"],
    stage: row.stage as LeadStage,
    score: Number(row.score || 0),
    assignedTo: String(row.assigned_to || ""),
    market: row.market as Lead["market"],
    source: String(row.source || ""),
    budget: row.budget != null ? Number(row.budget) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    nextAction: row.next_action ? String(row.next_action) : undefined,
    nextActionDueAt: row.next_action_due_at
      ? String(row.next_action_due_at)
      : undefined,
    territory: row.territory ? String(row.territory) : undefined,
    priority: (row.priority as Lead["priority"]) || "medium",
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapContact(row: Record<string, unknown>, phones: Contact["phones"] = []): Contact {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : undefined,
    phone: String(row.phone || phones[0]?.number || ""),
    phones,
    company: row.company ? String(row.company) : undefined,
    category: row.category as Contact["category"],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    notes: row.notes ? String(row.notes) : undefined,
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    market: row.market as Contact["market"],
    lastContactedAt: row.last_contacted_at ? String(row.last_contacted_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSocialAccount(row: Record<string, unknown>): SocialAccount {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    platform: row.platform as SocialAccount["platform"],
    displayName: String(row.display_name || ""),
    handle: row.handle ? String(row.handle) : undefined,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    externalAccountId: row.external_account_id ? String(row.external_account_id) : undefined,
    status: row.status as SocialAccount["status"],
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : undefined,
    connectedAt: row.connected_at ? String(row.connected_at) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
  };
}

function mapSocialPost(row: Record<string, unknown>): SocialPost {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    accountIds: Array.isArray(row.account_ids) ? row.account_ids.map(String) : [],
    caption: String(row.caption || ""),
    media: Array.isArray(row.media) ? (row.media as SocialMediaItem[]) : [],
    linkUrl: row.link_url ? String(row.link_url) : undefined,
    listingId: row.listing_id ? String(row.listing_id) : undefined,
    status: row.status as SocialPost["status"],
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : undefined,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    lastError: row.last_error ? String(row.last_error) : undefined,
    createdAt: String(row.created_at),
  };
}

function mapListing(
  row: Record<string, unknown>,
  portals: Listing["portals"] = [],
  issues: string[] = [],
): Listing {
  return {
    id: String(row.id),
    title: String(row.title),
    address: String(row.address),
    city: String(row.city),
    market: row.market as Listing["market"],
    status: row.status as ListingStatus,
    price: Number(row.price),
    currency: row.currency as Listing["currency"],
    beds: Number(row.beds || 0),
    baths: Number(row.baths || 0),
    sqft: Number(row.sqft || 0),
    tenure: row.tenure as Listing["tenure"],
    mlsDisclosureComplete: Boolean(row.mls_disclosure_complete),
    agentId: String(row.agent_id || ""),
    portals,
    imageUrl: String(row.image_url || ""),
    description: String(row.description || ""),
    complianceIssues: issues,
    syncReadiness: Number(row.sync_readiness || 0),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : undefined,
    nextMilestone: row.next_milestone ? String(row.next_milestone) : undefined,
    createdAt: String(row.created_at),
  };
}

export function createSupabaseRepository(
  ctx: { user: WorkspaceUser; org: WorkspaceOrg },
): WorkspaceRepository {
  const supabase = createBrowserSupabaseClient();

  return {
    mode: "supabase",

    async getSnapshot() {
      const [leads, contacts, listings, deals, members, messages, threads, callLogs, sequences, automations, enrollments, tasks] =
        await Promise.all([
          this.listLeads().catch((e) => { console.warn("listLeads error", e); return []; }),
          this.listContacts().catch((e) => { console.warn("listContacts error", e); return []; }),
          this.listListings().catch((e) => { console.warn("listListings error", e); return []; }),
          this.listDeals().catch((e) => { console.warn("listDeals error", e); return []; }),
          this.listMembers().catch((e) => { console.warn("listMembers error", e); return []; }),
          supabase.from("messages").select("*").eq("org_id", ctx.org.id).then(r => r.data || [], () => []),
          supabase.from("conversation_threads").select("*").eq("org_id", ctx.org.id).then(r => r.data || [], () => []),
          this.listCallLogs().catch((e) => { console.warn("listCallLogs error", e); return []; }),
          this.listSequences().catch((e) => { console.warn("listSequences error", e); return []; }),
          this.listAutomations().catch((e) => { console.warn("listAutomations error", e); return []; }),
          this.listEnrollments().catch((e) => { console.warn("listEnrollments error", e); return []; }),
          this.listOpenTasks().catch((e) => { console.warn("listOpenTasks error", e); return []; }),
        ]);

      const snapshot: WorkspaceSnapshot = {
        version: 1,
        user: ctx.user,
        org: ctx.org,
        members,
        leads,
        contacts,
        listings,
        deals,
        messages: (messages || []).map((m: any) => ({
          id: String(m.id),
          orgId: String(m.org_id),
          threadId: String(m.thread_id),
          leadId: String(m.lead_id),
          direction: m.direction,
          body: String(m.body),
          status: m.status,
          providerSid: m.provider_sid || undefined,
          sentAt: String(m.sent_at),
        })),
        threads: (threads || []).map((t: any) => ({
          id: String(t.id),
          orgId: String(t.org_id),
          leadId: String(t.lead_id),
          phoneNumber: String(t.phone_number),
          lastMessageAt: t.last_message_at || undefined,
        })),
        callLogs,
        sequences,
        automations,
        enrollments,
        tasks,
        website: await this.getWebsite().catch(() => null),
        socialAccounts: await this.listSocialAccounts().catch((e) => {
          console.warn("listSocialAccounts error", e);
          const message =
            e instanceof Error ? e.message : "Could not load connected social accounts.";
          toast.error(`Social accounts: ${message}`);
          return [];
        }),
        socialPosts: await this.listSocialPosts().catch((e) => {
          console.warn("listSocialPosts error", e);
          return [];
        }),
      };
      return snapshot;
    },

    async saveAuth() {
      // Auth is owned by Supabase session cookies / client
    },

    async clearAuth() {
      await supabase.auth.signOut();
    },

    async setPlan(plan: PlanId) {
      const { error } = await supabase
        .from("organizations")
        .update({ plan })
        .eq("id", ctx.org.id);
      if (error) throw error;
      ctx.org.plan = plan;
      return ctx.org;
    },

    async listMembers() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("org_id", ctx.org.id);
      if (error) throw error;
      return (data || []).map(
        (p): OrgMember => ({
          id: String(p.id),
          name: String(p.full_name),
          email: "",
          role: p.role as OrgMember["role"],
          avatarInitials: String(p.full_name)
            .split(" ")
            .map((x: string) => x[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        }),
      );
    },

    async listLeads() {
      const { data, error } = await supabase
        .from("leads")
        .select("*, lead_phone_numbers(*)")
        .eq("org_id", ctx.org.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) =>
        mapLead(
          row,
          (row.lead_phone_numbers || []).map((p: Record<string, unknown>) => ({
            id: String(p.id),
            label: String(p.label),
            number: String(p.number),
            source: p.source as NonNullable<Lead["phones"]>[number]["source"],
            consent: p.consent as NonNullable<Lead["phones"]>[number]["consent"],
            verification: p.verification as NonNullable<Lead["phones"]>[number]["verification"],
            preferred: Boolean(p.preferred),
            lastContactedAt: p.last_contacted_at
              ? String(p.last_contacted_at)
              : undefined,
          })),
        ),
      );
    },

    async createLead(lead) {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          org_id: ctx.org.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          lead_type: lead.type,
          stage: lead.stage,
          score: lead.score,
          assigned_to: lead.assignedTo || ctx.user.id,
          market: lead.market,
          source: lead.source,
          budget: lead.budget,
          notes: lead.notes,
          next_action: lead.nextAction,
          next_action_due_at: lead.nextActionDueAt,
          territory: lead.territory,
          priority: lead.priority,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (lead.phones?.length) {
        await supabase.from("lead_phone_numbers").insert(
          lead.phones.map((p) => ({
            lead_id: data.id,
            org_id: ctx.org.id,
            label: p.label,
            number: p.number,
            source: p.source,
            consent: p.consent,
            verification: p.verification,
            preferred: Boolean(p.preferred),
          })),
        );
      } else if (lead.phone?.trim()) {
        await supabase.from("lead_phone_numbers").insert({
          lead_id: data.id,
          org_id: ctx.org.id,
          label: "Primary",
          number: lead.phone.trim(),
          source: lead.source || "manual",
          consent: "unknown",
          verification: "unverified",
          preferred: true,
        });
      }

      return mapLead(data, lead.phones);
    },

    async updateLeadStage(id, stage) {
      const { data, error } = await supabase
        .from("leads")
        .update({ stage, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return mapLead(data);
    },

    async updateLead(id, patch) {
      const { data, error } = await supabase
        .from("leads")
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          ...(patch.nextAction !== undefined ? { next_action: patch.nextAction } : {}),
          ...(patch.nextActionDueAt !== undefined ? { next_action_due_at: patch.nextActionDueAt } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*, lead_phone_numbers(*)")
        .single();
      if (error) throw error;
      
      if (patch.phones) {
        // Simple wipe and replace for phones to sync changes easily
        await supabase.from("lead_phone_numbers").delete().eq("lead_id", id);
        if (patch.phones.length > 0) {
          await supabase.from("lead_phone_numbers").insert(
            patch.phones.map((p) => ({
              lead_id: id,
              org_id: ctx.org.id,
              label: p.label,
              number: p.number,
              source: p.source,
              consent: p.consent,
              verification: p.verification,
              preferred: Boolean(p.preferred),
            }))
          );
        }
        data.lead_phone_numbers = patch.phones;
      }
      
      return mapLead(
        data,
        (data.lead_phone_numbers || []).map((p: Record<string, unknown>) => ({
          id: String(p.id || newId("phone")),
          label: String(p.label),
          number: String(p.number),
          source: p.source as NonNullable<Lead["phones"]>[number]["source"],
          consent: p.consent as NonNullable<Lead["phones"]>[number]["consent"],
          verification: p.verification as NonNullable<Lead["phones"]>[number]["verification"],
          preferred: Boolean(p.preferred),
          lastContactedAt: p.last_contacted_at ? String(p.last_contacted_at) : undefined,
        }))
      );
    },

    async listContacts() {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, contact_phone_numbers(*)")
        .eq("org_id", ctx.org.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) =>
        mapContact(
          row,
          (row.contact_phone_numbers || []).map((p: Record<string, unknown>) => ({
            id: String(p.id),
            label: String(p.label),
            number: String(p.number),
            source: p.source as NonNullable<Contact["phones"]>[number]["source"],
            consent: p.consent as NonNullable<Contact["phones"]>[number]["consent"],
            verification: p.verification as NonNullable<Contact["phones"]>[number]["verification"],
            preferred: Boolean(p.preferred),
            lastContactedAt: p.last_contacted_at ? String(p.last_contacted_at) : undefined,
          })),
        ),
      );
    },

    async createContact(contact) {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          org_id: ctx.org.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          category: contact.category,
          tags: contact.tags,
          notes: contact.notes,
          lead_id: contact.leadId,
          assigned_to: contact.assignedTo || ctx.user.id,
          market: contact.market,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (contact.phones?.length) {
        await supabase.from("contact_phone_numbers").insert(
          contact.phones.map((p) => ({
            contact_id: data.id,
            org_id: ctx.org.id,
            label: p.label,
            number: p.number,
            source: p.source,
            consent: p.consent,
            verification: p.verification,
            preferred: Boolean(p.preferred),
          })),
        );
      }

      return mapContact(data, contact.phones);
    },

    async updateContact(id, patch) {
      const { data, error } = await supabase
        .from("contacts")
        .update({
          name: patch.name,
          email: patch.email,
          phone: patch.phone,
          company: patch.company,
          category: patch.category,
          tags: patch.tags,
          notes: patch.notes,
          lead_id: patch.leadId,
          assigned_to: patch.assignedTo,
          last_contacted_at: patch.lastContactedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return mapContact(data, patch.phones);
    },

    async deleteContact(id) {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },

    async listListings() {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_portal_syncs(*), listing_compliance_issues(*)")
        .eq("org_id", ctx.org.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) =>
        mapListing(
          row,
          (row.listing_portal_syncs || []).map((p: Record<string, unknown>) => ({
            portal: p.portal as Listing["portals"][number]["portal"],
            status: p.status as Listing["portals"][number]["status"],
            lastError: p.last_error ? String(p.last_error) : undefined,
            lastMessage: p.last_message ? String(p.last_message) : undefined,
            lastSyncedAt: p.last_synced_at ? String(p.last_synced_at) : undefined,
          })),
          (row.listing_compliance_issues || [])
            .filter((i: Record<string, unknown>) => !i.resolved)
            .map((i: Record<string, unknown>) => String(i.issue)),
        ),
      );
    },

    async createListing(listing) {
      const { data, error } = await supabase
        .from("listings")
        .insert({
          org_id: ctx.org.id,
          title: listing.title,
          address: listing.address,
          city: listing.city,
          market: listing.market,
          status: listing.status,
          price: listing.price,
          currency: listing.currency,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          tenure: listing.tenure,
          mls_disclosure_complete: listing.mlsDisclosureComplete,
          agent_id: listing.agentId || ctx.user.id,
          image_url: listing.imageUrl,
          description: listing.description,
          sync_readiness: listing.syncReadiness || 0,
          next_milestone: listing.nextMilestone,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (listing.portals?.length) {
        await supabase.from("listing_portal_syncs").insert(
          listing.portals.map((p) => ({
            listing_id: data.id,
            org_id: ctx.org.id,
            portal: p.portal,
            status: p.status,
          })),
        );
      }

      return mapListing(data, listing.portals, listing.complianceIssues || []);
    },

    async updateListingStatus(id, status) {
      const { data, error } = await supabase
        .from("listings")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return mapListing(data);
    },

    async updateListing(id, patch) {
      const { data, error } = await supabase
        .from("listings")
        .update({
          status: patch.status,
          sync_readiness: patch.syncReadiness,
          last_sync_at: patch.lastSyncAt,
          next_milestone: patch.nextMilestone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;

      if (patch.portals) {
        for (const portal of patch.portals) {
          await supabase.from("listing_portal_syncs").upsert(
            {
              listing_id: id,
              org_id: ctx.org.id,
              portal: portal.portal,
              status: portal.status,
              last_error: portal.lastError || null,
              last_message: portal.lastMessage || null,
              last_synced_at:
                portal.lastSyncedAt ||
                (portal.status === "synced" ? new Date().toISOString() : null),
            },
            { onConflict: "listing_id,portal" },
          );
        }
      }

      if (patch.complianceIssues) {
        await supabase
          .from("listing_compliance_issues")
          .delete()
          .eq("listing_id", id);
        if (patch.complianceIssues.length) {
          await supabase.from("listing_compliance_issues").insert(
            patch.complianceIssues.map((issue) => ({
              listing_id: id,
              org_id: ctx.org.id,
              issue,
            })),
          );
        }
      }

      return mapListing(data, patch.portals, patch.complianceIssues);
    },

    async listDeals() {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, transaction_parties(*), transaction_checklist_items(*)")
        .eq("org_id", ctx.org.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(
        (row): TransactionDeal => ({
          id: String(row.id),
          listingId: String(row.listing_id || ""),
          listingTitle: String(row.listing_title),
          parties: (row.transaction_parties || [])
            .sort(
              (a: { sort_order: number }, b: { sort_order: number }) =>
                a.sort_order - b.sort_order,
            )
            .map((p: { name: string }) => p.name),
          stage: String(row.stage),
          checklist: (row.transaction_checklist_items || [])
            .sort(
              (a: { sort_order: number }, b: { sort_order: number }) =>
                a.sort_order - b.sort_order,
            )
            .map((c: { id: string; label: string; done: boolean }) => ({
              id: String(c.id),
              label: c.label,
              done: Boolean(c.done),
            })),
          eSignStatus: row.e_sign_status,
          market: row.market,
          value: Number(row.value),
          currency: row.currency,
          coordinator: row.coordinator || undefined,
          targetCloseDate: row.target_close_date || undefined,
          riskLevel: row.risk_level || undefined,
          ledgerStatus: row.ledger_status || undefined,
          complianceStatus: row.compliance_status || undefined,
          notes: row.notes || undefined,
          updatedAt: String(row.updated_at),
        }),
      );
    },

    async createDeal(deal) {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          org_id: ctx.org.id,
          listing_id: deal.listingId || null,
          listing_title: deal.listingTitle,
          stage: deal.stage,
          e_sign_status: deal.eSignStatus,
          market: deal.market,
          value: deal.value,
          currency: deal.currency,
          coordinator: deal.coordinator,
          target_close_date: deal.targetCloseDate,
          risk_level: deal.riskLevel,
          ledger_status: deal.ledgerStatus,
          compliance_status: deal.complianceStatus,
          notes: deal.notes,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (deal.parties?.length) {
        await supabase.from("transaction_parties").insert(
          deal.parties.map((name, i) => ({
            transaction_id: data.id,
            org_id: ctx.org.id,
            name,
            sort_order: i,
          })),
        );
      }
      if (deal.checklist?.length) {
        await supabase.from("transaction_checklist_items").insert(
          deal.checklist.map((item, i) => ({
            id: item.id.match(/^[0-9a-f-]{36}$/i) ? item.id : undefined,
            transaction_id: data.id,
            org_id: ctx.org.id,
            label: item.label,
            done: item.done,
            sort_order: i,
          })),
        );
      }

      return { ...deal, id: String(data.id), updatedAt: String(data.updated_at) };
    },

    async updateDealChecklistItem(dealId, checklistId, done) {
      const { error } = await supabase
        .from("transaction_checklist_items")
        .update({ done })
        .eq("id", checklistId)
        .eq("transaction_id", dealId);
      if (error) throw error;
      const deals = await this.listDeals();
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) throw new Error("Deal not found");
      return deal;
    },

    async updateDealMeta(dealId, patch) {
      const { error } = await supabase
        .from("transactions")
        .update({
          stage: patch.stage,
          e_sign_status: patch.eSignStatus,
          ledger_status: patch.ledgerStatus,
          compliance_status: patch.complianceStatus,
          notes: patch.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);
      if (error) throw error;
      const deals = await this.listDeals();
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) throw new Error("Deal not found");
      return deal;
    },

    async listMessages(leadId) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("org_id", ctx.org.id)
        .eq("lead_id", leadId)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(
        (m): ConversationMessage => ({
          id: String(m.id),
          orgId: String(m.org_id),
          threadId: String(m.thread_id),
          leadId: String(m.lead_id),
          direction: m.direction,
          body: String(m.body),
          status: m.status,
          providerSid: m.provider_sid || undefined,
          sentAt: String(m.sent_at),
        }),
      );
    },

    async appendMessage(message) {
      let threadId = message.threadId;
      if (!threadId) {
        const { data: existing } = await supabase
          .from("conversation_threads")
          .select("id")
          .eq("org_id", ctx.org.id)
          .eq("lead_id", message.leadId)
          .maybeSingle();
        if (existing) threadId = String(existing.id);
        else {
          const { data: created, error } = await supabase
            .from("conversation_threads")
            .insert({
              org_id: ctx.org.id,
              lead_id: message.leadId,
              phone_number: "",
              last_message_at: message.sentAt,
            })
            .select("id")
            .single();
          if (error) throw error;
          threadId = String(created.id);
        }
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          org_id: ctx.org.id,
          thread_id: threadId,
          lead_id: message.leadId,
          direction: message.direction,
          body: message.body,
          status: message.status,
          provider_sid: message.providerSid,
          sent_at: message.sentAt,
        })
        .select("*")
        .single();
      if (error) throw error;

      await supabase
        .from("conversation_threads")
        .update({ last_message_at: message.sentAt })
        .eq("id", threadId);

      return {
        id: String(data.id),
        orgId: ctx.org.id,
        threadId,
        leadId: message.leadId,
        direction: message.direction,
        body: message.body,
        status: message.status,
        providerSid: message.providerSid,
        sentAt: message.sentAt,
      };
    },

    async listCallLogs(leadId) {
      let q = supabase
        .from("call_logs")
        .select("*")
        .eq("org_id", ctx.org.id)
        .order("created_at", { ascending: false });
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(
        (c): CallLog => ({
          id: String(c.id),
          orgId: String(c.org_id),
          leadId: c.lead_id || undefined,
          direction: c.direction,
          phoneNumber: String(c.phone_number),
          outcome: c.outcome,
          notes: c.notes || undefined,
          durationSeconds: c.duration_seconds || 0,
          createdAt: String(c.created_at),
        }),
      );
    },

    async logCall(input) {
      const { data, error } = await supabase
        .from("call_logs")
        .insert({
          org_id: ctx.org.id,
          lead_id: input.leadId,
          direction: input.direction,
          phone_number: input.phoneNumber,
          outcome: input.outcome,
          notes: input.notes,
          duration_seconds: input.durationSeconds || 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: String(data.id),
        orgId: ctx.org.id,
        leadId: input.leadId,
        direction: input.direction,
        phoneNumber: input.phoneNumber,
        outcome: input.outcome,
        notes: input.notes,
        durationSeconds: input.durationSeconds,
        createdAt: String(data.created_at),
      };
    },

    async listSequences() {
      const { data, error } = await supabase
        .from("message_sequences")
        .select("*")
        .eq("org_id", ctx.org.id);
      if (error) throw error;
      return (data || []).map(
        (s): MessageSequence => ({
          id: String(s.id),
          orgId: String(s.org_id),
          title: String(s.title),
          description: String(s.description || ""),
          status: s.status,
          steps: Array.isArray(s.steps) ? s.steps.map(String) : [],
          createdAt: String(s.created_at),
        }),
      );
    },

    async listAutomations() {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("org_id", ctx.org.id)
        .order("updated_at", { ascending: false });
      if (error) {
        // Table may not exist yet in older projects — fail soft.
        return [];
      }
      return (data || []).map((row) => ({
        id: String(row.id),
        orgId: String(row.org_id),
        name: String(row.name),
        description: String(row.description || ""),
        trigger: row.trigger,
        triggerStage: row.trigger_stage || undefined,
        status: row.status,
        steps: Array.isArray(row.steps) ? row.steps : [],
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));
    },

    async createAutomation(automation) {
      const { data, error } = await supabase
        .from("automations")
        .insert({
          org_id: ctx.org.id,
          name: automation.name,
          description: automation.description,
          trigger: automation.trigger,
          trigger_stage: automation.triggerStage,
          status: automation.status,
          steps: automation.steps,
        })
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: String(data.id),
        orgId: ctx.org.id,
        name: automation.name,
        description: automation.description,
        trigger: automation.trigger,
        triggerStage: automation.triggerStage,
        status: automation.status,
        steps: automation.steps,
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      };
    },

    async updateAutomation(id, patch) {
      const { data, error } = await supabase
        .from("automations")
        .update({
          name: patch.name,
          description: patch.description,
          trigger: patch.trigger,
          trigger_stage: patch.triggerStage,
          status: patch.status,
          steps: patch.steps,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: String(data.id),
        orgId: ctx.org.id,
        name: String(data.name),
        description: String(data.description || ""),
        trigger: data.trigger,
        triggerStage: data.trigger_stage || undefined,
        status: data.status,
        steps: Array.isArray(data.steps) ? data.steps : [],
        createdAt: String(data.created_at),
        updatedAt: String(data.updated_at),
      };
    },

    async deleteAutomation(id) {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },

    async listAutomationRuns(leadId) {
      let q = supabase
        .from("automation_runs")
        .select("*, automation_run_steps(*)")
        .eq("org_id", ctx.org.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(
        (row: Record<string, any>): AutomationRun => ({
          id: String(row.id),
          orgId: String(row.org_id),
          automationId: String(row.automation_id),
          leadId: String(row.lead_id),
          trigger: row.trigger,
          status: row.status,
          stepIndex: Number(row.step_index || 0),
          runAfter: String(row.run_after),
          lastError: row.last_error ? String(row.last_error) : undefined,
          startedAt: row.started_at ? String(row.started_at) : undefined,
          completedAt: row.completed_at ? String(row.completed_at) : undefined,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
          steps: (row.automation_run_steps || [])
            .map((s: Record<string, any>) => ({
              id: String(s.id),
              stepIndex: Number(s.step_index || 0),
              stepType: String(s.step_type),
              label: s.label ? String(s.label) : undefined,
              status: s.status,
              detail: s.detail ? String(s.detail) : undefined,
              executedAt: String(s.executed_at),
            }))
            .sort(
              (a: AutomationRunStep, b: AutomationRunStep) =>
                a.stepIndex - b.stepIndex,
            ),
        }),
      );
    },

    async listLeadActivities(leadId) {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("org_id", ctx.org.id)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(
        (row: Record<string, any>): LeadActivity => ({
          id: String(row.id),
          orgId: String(row.org_id),
          leadId: String(row.lead_id),
          actorId: row.actor_id ? String(row.actor_id) : undefined,
          activityType: String(row.activity_type),
          body: row.body ? String(row.body) : undefined,
          metadata: (row.metadata || {}) as Record<string, unknown>,
          createdAt: String(row.created_at),
        }),
      );
    },

    async listEnrollments(leadId) {
      let q = supabase
        .from("sequence_enrollments")
        .select("*")
        .eq("org_id", ctx.org.id);
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(
        (e): SequenceEnrollment => ({
          id: String(e.id),
          orgId: String(e.org_id),
          sequenceId: String(e.sequence_id),
          leadId: String(e.lead_id),
          status: e.status,
          followUp: Boolean(e.follow_up),
          nurture: Boolean(e.nurture),
        }),
      );
    },

    async upsertEnrollment(input) {
      const { data, error } = await supabase
        .from("sequence_enrollments")
        .upsert(
          {
            id: input.id,
            org_id: ctx.org.id,
            sequence_id: input.sequenceId,
            lead_id: input.leadId,
            status: input.status,
            follow_up: input.followUp,
            nurture: input.nurture,
          },
          { onConflict: "sequence_id,lead_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: String(data.id),
        orgId: ctx.org.id,
        sequenceId: input.sequenceId,
        leadId: input.leadId,
        status: input.status,
        followUp: input.followUp,
        nurture: input.nurture,
      };
    },

    async resolveTask(taskId) {
      const { error } = await supabase
        .from("lead_tasks")
        .update({ status: "done" })
        .eq("id", taskId);
      if (error) throw error;
    },

    async listOpenTasks() {
      const { data, error } = await supabase
        .from("lead_tasks")
        .select("*")
        .eq("org_id", ctx.org.id)
        .eq("status", "open");
      if (error) throw error;
      return (data || []).map((t) => ({
        id: String(t.id),
        leadId: String(t.lead_id),
        orgId: String(t.org_id),
        title: String(t.title),
        dueAt: t.due_at || undefined,
        channel: t.channel,
        status: t.status,
      }));
    },

    async getWebsite() {
      const fallback: WebsiteSite = {
        id: ctx.org.id,
        orgId: ctx.org.id,
        headline: ctx.org.name,
        tagline: "Find your next home with a team that actually follows through.",
        primaryCta: "Book a valuation",
        phone: "",
        email: ctx.user.email,
        published: false,
        updatedAt: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("websites")
        .select("payload, slug, updated_at")
        .eq("org_id", ctx.org.id)
        .maybeSingle();
      if (error || !data?.payload) return fallback;

      const payload = data.payload as Partial<WebsiteSite>;
      return {
        ...fallback,
        ...payload,
        id: ctx.org.id,
        orgId: ctx.org.id,
        slug: data.slug ? String(data.slug) : payload.slug,
        updatedAt: String(data.updated_at || fallback.updatedAt),
      };
    },

    async saveWebsite(site) {
      // `slug`, `custom_domain` and `published` are also written as columns
      // because the public renderer resolves a host without reading payloads.
      const slug = site.slug?.trim() || fallbackSlug(ctx.org.id, ctx.org.name);
      const payload = { ...site, slug, orgId: ctx.org.id, id: ctx.org.id };
      const { error } = await supabase.from("websites").upsert(
        {
          org_id: ctx.org.id,
          payload,
          slug,
          custom_domain: site.customDomain?.trim()
            ? normalizeHost(site.customDomain)
            : null,
          published: Boolean(site.published),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" },
      );
      if (error) throw error;
      return { ...payload, updatedAt: new Date().toISOString() };
    },

    async listSocialAccounts() {
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("org_id", ctx.org.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapSocialAccount);
    },

    async upsertSocialAccount(account) {
      // Real accounts are only ever created by the server-side OAuth callback
      // (which has the platform's client secret). The browser client can only
      // ask a connected account to disconnect — anything else is rejected by
      // RLS anyway since `social_accounts` has no insert/update policy here.
      if (account.id && account.status === "disconnected") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(`/api/social/accounts/${account.id}/disconnect`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token || ""}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as Record<string, unknown>);
          throw new Error(String(body.error || "Failed to disconnect account"));
        }
        return { ...account, id: account.id, status: "disconnected" };
      }
      throw new Error(
        "Real social accounts connect via OAuth — use the Connect button instead of manual entry.",
      );
    },

    async deleteSocialAccount(id) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/social/accounts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as Record<string, unknown>);
        throw new Error(String(body.error || "Failed to remove account"));
      }
    },

    async listSocialPosts() {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("org_id", ctx.org.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapSocialPost);
    },

    async createSocialPost(post) {
      const { data, error } = await supabase
        .from("social_posts")
        .insert({
          org_id: ctx.org.id,
          account_ids: post.accountIds || [],
          caption: post.caption,
          media: post.media || [],
          link_url: post.linkUrl,
          listing_id: post.listingId || null,
          status: post.status,
          scheduled_for: post.scheduledFor || null,
          published_at: post.publishedAt || null,
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return mapSocialPost(data);
    },

    async updateSocialPost(id, patch) {
      const { data, error } = await supabase
        .from("social_posts")
        .update({
          caption: patch.caption,
          status: patch.status,
          scheduled_for: patch.scheduledFor,
          published_at: patch.publishedAt,
          account_ids: patch.accountIds,
          media: patch.media,
          link_url: patch.linkUrl,
          listing_id: patch.listingId,
          last_error: patch.lastError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return mapSocialPost(data);
    },

    async deleteSocialPost(id) {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
  };
}

export async function hydrateSupabaseSession(): Promise<{
  user: WorkspaceUser;
  org: WorkspaceOrg;
} | null> {
  const supabase = createBrowserSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return null;

  const org = profile.organizations as Record<string, unknown>;
  return {
    user: {
      id: auth.user.id,
      name: String(profile.full_name),
      email: auth.user.email || "",
      role: profile.role,
      orgId: String(profile.org_id),
    },
    org: {
      id: String(org.id),
      name: String(org.name),
      plan: org.plan as PlanId,
      market: org.market as WorkspaceOrg["market"],
      stripeCustomerId: org.stripe_customer_id
        ? String(org.stripe_customer_id)
        : undefined,
      stripeSubscriptionId: org.stripe_subscription_id
        ? String(org.stripe_subscription_id)
        : undefined,
      subscriptionStatus: org.subscription_status ? String(org.subscription_status) : undefined,
      currentPeriodEnd: org.current_period_end ? String(org.current_period_end) : undefined,
      cancelAtPeriodEnd: Boolean(org.cancel_at_period_end),
      trialEndsAt: org.trial_ends_at ? String(org.trial_ends_at) : undefined,
      lastPaymentStatus: org.last_payment_status ? String(org.last_payment_status) : undefined,
      lastPaymentAt: org.last_payment_at ? String(org.last_payment_at) : undefined,
    },
  };
}

// silence unused helper in some builds
void newId;

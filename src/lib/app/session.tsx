"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Automation,
  AutomationRun,
  AutomationTrigger,
  CallLog,
  Contact,
  ConversationMessage,
  Lead,
  LeadActivity,
  LeadPatch,
  LeadTask,
  Listing,
  MessageSequence,
  OrgMember,
  PlanId,
  Role,
  SequenceEnrollment,
  SocialAccount,
  SocialPost,
  TransactionDeal,
  WebsiteSite,
  LeadRoutingSettings,
} from "@/types";
import { isSupabaseConfigured, createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { getActiveBrand } from "@/lib/brand/config";
import { buildPhoneContactMethod } from "@/lib/utils";
import type { WorkspaceRepository } from "@/lib/data/repository";
import {
  createLocalRepository,
  findLocalWorkspaceByEmail,
  getLocalAuth,
} from "@/lib/data/local-repository";
import {
  createSupabaseRepository,
  hydrateSupabaseSession,
} from "@/lib/data/supabase-repository";
import {
  createEmptyWorkspace,
  createLocalIdentity,
} from "@/lib/data/bootstrap";
import {
  DEV_SEED_ACCOUNTS,
  DEV_SEED_ORG,
  findDevSeedAccount,
  isDevSeedEnabled,
} from "@/lib/dev/seed-accounts";
import { setTenantPlan } from "@/lib/admin/registry";
import { syncWorkspaceToPlatformRegistry } from "@/lib/admin/sync-workspace";
import { prepareNewLead, hydrateLeadRouting, ownerId } from "@/lib/crm/routing";
import { scoreLead } from "@/lib/crm/scoring";
import { syncListingToPortals } from "@/lib/portals/adapters";
import {
  loadPortalConnections,
  mergeConnectionsWithDefaults,
  upsertPortalConnection,
} from "@/lib/portals/connections";
import type { PortalConnection } from "@/types";
import {
  loadWorkspace,
  newId,
  saveWorkspace,
  type WorkspaceOrg,
  type WorkspaceSnapshot,
  type WorkspaceUser,
} from "@/lib/data/workspace-store";

function buildDevSeedWorkspace(
  account: NonNullable<ReturnType<typeof findDevSeedAccount>>,
  market: "uk" | "us",
): WorkspaceSnapshot {
  const existing = loadWorkspace(DEV_SEED_ORG.id);
  const members: OrgMember[] = DEV_SEED_ACCOUNTS.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role,
    avatarInitials: a.avatarInitials,
  }));

  const user: WorkspaceUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    orgId: DEV_SEED_ORG.id,
  };
  const org: WorkspaceOrg = {
    id: DEV_SEED_ORG.id,
    name: DEV_SEED_ORG.name,
    plan: DEV_SEED_ORG.plan,
    market,
  };

  if (existing) {
    return {
      ...existing,
      user,
      org: { ...existing.org, ...org },
      members,
    };
  }

  const fresh = createEmptyWorkspace({ user, org });
  return { ...fresh, members };
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AppOrg {
  id: string;
  name: string;
  plan: PlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string;
  lastPaymentStatus?: string;
  lastPaymentAt?: string;
  leadRouting?: LeadRoutingSettings;
}

interface AppState {
  user: AppUser | null;
  org: AppOrg | null;
  members: OrgMember[];
  leads: Lead[];
  contacts: Contact[];
  listings: Listing[];
  deals: TransactionDeal[];
  messages: ConversationMessage[];
  callLogs: CallLog[];
  sequences: MessageSequence[];
  automations: Automation[];
  enrollments: SequenceEnrollment[];
  tasks: LeadTask[];
  website: WebsiteSite | null;
  socialAccounts: SocialAccount[];
  socialPosts: SocialPost[];
  loading: boolean;
  authMode: "local" | "supabase";
  persistence: "local" | "supabase";
  signIn: (email: string, name?: string, password?: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password?: string;
    orgName: string;
    plan: PlanId;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  setPlan: (plan: PlanId) => Promise<void>;
  refresh: () => Promise<void>;
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  assignLead: (id: string, assignedTo: string) => Promise<void>;
  saveLeadRouting: (settings: LeadRoutingSettings) => Promise<void>;
  updateLeadStage: (id: string, stage: Lead["stage"]) => Promise<void>;
  updateLead: (id: string, patch: LeadPatch) => Promise<Lead>;
  addContact: (
    contact: Omit<Contact, "id" | "createdAt" | "updatedAt" | "market">,
  ) => Promise<void>;
  updateContact: (
    id: string,
    patch: Partial<
      Pick<
        Contact,
        | "name"
        | "email"
        | "phone"
        | "company"
        | "category"
        | "tags"
        | "notes"
        | "leadId"
        | "assignedTo"
        | "lastContactedAt"
      >
    >,
  ) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  promoteContactToLead: (
    contactId: string,
    input: { type: Lead["type"]; source?: string },
  ) => Promise<void>;
  addListing: (
    listing: Omit<Listing, "id" | "createdAt" | "portals" | "imageUrl" | "market" | "currency"> & {
      imageUrl?: string;
    },
  ) => Promise<void>;
  updateListingStatus: (id: string, status: Listing["status"]) => Promise<void>;
  queuePortalSync: (listingId: string) => Promise<string>;
  listPortalConnections: () => PortalConnection[];
  savePortalConnection: (connection: PortalConnection) => void;
  createDealFromListing: (listingId: string) => Promise<void>;
  updateDealChecklistItem: (
    dealId: string,
    checklistId: string,
    done: boolean,
  ) => Promise<void>;
  updateDealMeta: (
    dealId: string,
    patch: Partial<
      Pick<
        TransactionDeal,
        "stage" | "eSignStatus" | "ledgerStatus" | "complianceStatus" | "notes"
      >
    >,
  ) => Promise<void>;
  sendSms: (input: {
    leadId: string;
    body: string;
  }) => Promise<{ mode: "live" | "simulated" }>;
  sendEmail: (input: {
    leadId: string;
    subject: string;
    body: string;
  }) => Promise<{ mode: "live" | "simulated" }>;
  /** Simulate or record an inbound SMS from the lead (in-app testing). */
  receiveInboundSms: (input: {
    leadId: string;
    body: string;
  }) => Promise<{ mode: "simulated" }>;
  logCall: (input: {
    leadId: string;
    outcome: CallLog["outcome"];
    notes?: string;
  }) => Promise<void>;
  setLeadWorkflow: (input: {
    leadId: string;
    followUp: boolean;
    nurture: boolean;
  }) => Promise<void>;
  createAutomation: (
    automation: Omit<Automation, "id" | "createdAt" | "updatedAt" | "orgId">,
  ) => Promise<void>;
  updateAutomation: (
    id: string,
    patch: Partial<
      Pick<
        Automation,
        | "name"
        | "description"
        | "trigger"
        | "triggerStage"
        | "status"
        | "steps"
      >
    >,
  ) => Promise<void>;
  deleteAutomation: (id: string) => Promise<void>;
  /** Start a `manual` workflow for one lead and execute it immediately. */
  runAutomationNow: (input: {
    leadId: string;
    automationId: string;
  }) => Promise<{ enqueued?: number; failed?: number } | null>;
  /** Advance parked `wait` steps for this org. */
  runDueAutomations: () => Promise<{ processed?: number } | null>;
  listAutomationRuns: (leadId?: string) => Promise<AutomationRun[]>;
  listLeadActivities: (leadId: string) => Promise<LeadActivity[]>;
  resolveTask: (taskId: string) => Promise<void>;
  saveWebsite: (site: WebsiteSite) => Promise<void>;
  upsertSocialAccount: (
    account: Omit<SocialAccount, "id" | "orgId"> & { id?: string },
  ) => Promise<void>;
  deleteSocialAccount: (id: string) => Promise<void>;
  createSocialPost: (
    post: Omit<SocialPost, "id" | "createdAt" | "orgId">,
  ) => Promise<string | undefined>;
  /** Bearer token for the browser session; used by /api/social/* routes. Null outside Supabase mode. */
  getAuthToken: () => Promise<string | null>;
  /** Calls /api/social/publish for a post that already exists. Supabase mode only. */
  publishSocialPostNow: (postId: string) => Promise<{ ok: boolean; message: string }>;
  updateSocialPost: (
    id: string,
    patch: Partial<
      Pick<
        SocialPost,
        | "caption"
        | "status"
        | "scheduledFor"
        | "publishedAt"
        | "accountIds"
        | "media"
        | "linkUrl"
        | "listingId"
      >
    >,
  ) => Promise<void>;
  deleteSocialPost: (id: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

function toAppUser(user: WorkspaceUser): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function toAppOrg(org: WorkspaceOrg): AppOrg {
  return {
    id: org.id,
    name: org.name,
    plan: org.plan,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd,
    cancelAtPeriodEnd: org.cancelAtPeriodEnd,
    trialEndsAt: org.trialEndsAt,
    lastPaymentStatus: org.lastPaymentStatus,
    lastPaymentAt: org.lastPaymentAt,
    leadRouting: org.leadRouting,
  };
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [org, setOrg] = useState<AppOrg | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [deals, setDeals] = useState<TransactionDeal[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [sequences, setSequences] = useState<MessageSequence[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [website, setWebsite] = useState<WebsiteSite | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const repoRef = useRef<WorkspaceRepository | null>(null);
  const authMode: AppState["authMode"] = isSupabaseConfigured()
    ? "supabase"
    : "local";
  const brand = getActiveBrand();

  const applySnapshot = useCallback(async (repo: WorkspaceRepository) => {
    const snap = await repo.getSnapshot();
    if (!snap) {
      setUser(null);
      setOrg(null);
      setMembers([]);
      setLeads([]);
      setContacts([]);
      setListings([]);
      setDeals([]);
      setMessages([]);
      setCallLogs([]);
      setSequences([]);
      setAutomations([]);
      setEnrollments([]);
      setTasks([]);
      setWebsite(null);
      setSocialAccounts([]);
      setSocialPosts([]);
      return;
    }
    setUser(toAppUser(snap.user));
    setOrg(toAppOrg(snap.org));
    setMembers(snap.members);
    setLeads(snap.leads);
    setContacts(snap.contacts || []);
    setListings(snap.listings);
    setDeals(snap.deals);
    setMessages(snap.messages);
    setCallLogs(snap.callLogs);
    setSequences(snap.sequences);
    setAutomations(snap.automations || []);
    setEnrollments(snap.enrollments);
    setTasks(snap.tasks);
    setWebsite(snap.website || null);
    setSocialAccounts(snap.socialAccounts || []);
    setSocialPosts(snap.socialPosts || []);
    try {
      syncWorkspaceToPlatformRegistry(
        snap,
        snap.org.id === "org_dev_northbridge" ? "seed" : "signup",
      );
    } catch {
      // admin registry sync must never break product session
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!repoRef.current) return;
    await applySnapshot(repoRef.current);
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function boot() {
      try {
        if (authMode === "supabase") {
          const supabase = createBrowserSupabaseClient();
          const hydrated = await hydrateSupabaseSession();
          if (cancelled) return;
          if (hydrated) {
            const repo = createSupabaseRepository(hydrated);
            repoRef.current = repo;
            await applySnapshot(repo);
          }

          // Register session expiry & refresh listener.
          //
          // Two hard rules here (both were violated before and caused the
          // Social planner freezes):
          // 1. Never call other supabase-js methods inside this callback —
          //    it runs while the auth client holds its internal lock, so a
          //    nested getUser()/getSession() (which hydrateSupabaseSession
          //    does) can deadlock every future auth call in the tab. Any work
          //    is deferred out of the callback with setTimeout.
          // 2. Never re-hydrate + refetch the entire workspace on
          //    TOKEN_REFRESHED or on every SIGNED_IN — supabase-js fires
          //    SIGNED_IN on every tab focus, and a refreshed token is picked
          //    up transparently by the (singleton) client. Only hydrate when
          //    we don't have a repository yet.
          const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
              repoRef.current = null;
              setUser(null);
              setOrg(null);
              toast.error("Session expired. Please sign in again.");
              return;
            }
            const needsHydration =
              (event === "SIGNED_IN" || event === "USER_UPDATED") &&
              session?.user &&
              !repoRef.current;
            if (needsHydration) {
              setTimeout(() => {
                void (async () => {
                  if (cancelled || repoRef.current) return;
                  const refreshed = await hydrateSupabaseSession();
                  if (cancelled || !refreshed) return;
                  const repo = createSupabaseRepository(refreshed);
                  repoRef.current = repo;
                  await applySnapshot(repo);
                })();
              }, 0);
            }
          });
          authSubscription = data.subscription;
        } else {
          const auth = getLocalAuth();
          if (auth) {
            const existing = loadWorkspace(auth.org.id);
            if (existing) {
              const repo = createLocalRepository(existing);
              repoRef.current = repo;
              await applySnapshot(repo);
            }
          }
        }
      } catch (err) {
        toast.error("Failed to load workspace session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [authMode, applySnapshot]);

  const signIn = useCallback(
    async (email: string, name?: string, password?: string) => {
      if (authMode === "supabase") {
        const supabase = createBrowserSupabaseClient();
        if (password) {
          // Password-based sign in
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          // Hydrate workspace after password login
          console.log("[signIn] signInWithPassword succeeded, hydrating...");
          const hydrated = await hydrateSupabaseSession();
          console.log("[signIn] hydrated result:", hydrated);
          if (hydrated) {
            const repo = createSupabaseRepository(hydrated);
            repoRef.current = repo;
            await applySnapshot(repo);
            console.log("[signIn] applySnapshot done, user should now be set");
          } else {
            console.error("[signIn] hydrateSupabaseSession returned null — profile row missing?");
            throw new Error("Login succeeded but your workspace profile was not found. Please contact support.");
          }
        } else {
          // Magic-link fallback
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/app`,
            },
          });
          if (error) throw error;
        }
        return;
      }

      // DEV-ONLY seed accounts (remove before deployment)
      if (isDevSeedEnabled()) {
        const seed = findDevSeedAccount(email, password);
        if (seed) {
          const workspace = buildDevSeedWorkspace(seed, brand.market);
          saveWorkspace(workspace);
          const repo = createLocalRepository(workspace);
          repoRef.current = repo;
          await applySnapshot(repo);
          return;
        }
        // Wrong password for a known seed email
        if (
          DEV_SEED_ACCOUNTS.some(
            (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
          )
        ) {
          throw new Error("Invalid password for seed account");
        }
      }

      const existingByEmail = findLocalWorkspaceByEmail(email);
      if (existingByEmail) {
        const repo = createLocalRepository(existingByEmail);
        repoRef.current = repo;
        await applySnapshot(repo);
        return;
      }

      const auth = getLocalAuth();
      if (auth && auth.user.email.toLowerCase() === email.toLowerCase()) {
        const existing = loadWorkspace(auth.org.id);
        if (existing) {
          const repo = createLocalRepository(existing);
          repoRef.current = repo;
          await applySnapshot(repo);
          return;
        }
      }

      // Product path: signing in without an existing workspace creates a real empty org.
      const identity = createLocalIdentity({
        email,
        name,
        market: brand.market,
        plan: "solo",
        orgName: `${(name || email.split("@")[0]).replace(/\b\w/g, (c) => c.toUpperCase())} Realty`,
        role: "owner",
      });
      const workspace = createEmptyWorkspace({
        user: identity.user,
        org: identity.org,
      });
      saveWorkspace(workspace);
      const repo = createLocalRepository(workspace);
      repoRef.current = repo;
      await applySnapshot(repo);
    },
    [authMode, applySnapshot, brand.market],
  );

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password?: string;
      orgName: string;
      plan: PlanId;
    }) => {
      if (authMode === "supabase") {
        const supabase = createBrowserSupabaseClient();
        if (input.password) {
          // Password-based signup (instant, no email confirmation needed)
          const { error } = await supabase.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
              data: {
                name: input.name,
                org_name: input.orgName,
                brand: brand.id,
                market: brand.market,
                plan: input.plan,
              },
            },
          });
          if (error) throw error;
          // Wait for the DB trigger (handle_new_user) to create profile + org rows
          let hydrated = null;
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 500));
            hydrated = await hydrateSupabaseSession();
            if (hydrated) break;
          }
          if (hydrated) {
            const repo = createSupabaseRepository(hydrated);
            repoRef.current = repo;
            await applySnapshot(repo);
          } else {
            throw new Error("Account created but workspace setup timed out. Please sign in again.");
          }
        } else {
          // Magic-link fallback
          const { error } = await supabase.auth.signInWithOtp({
            email: input.email,
            options: {
              emailRedirectTo: `${window.location.origin}/app`,
              data: {
                name: input.name,
                org_name: input.orgName,
                brand: brand.id,
                market: brand.market,
                plan: input.plan,
              },
            },
          });
          if (error) throw error;
        }
        return;
      }

      const identity = createLocalIdentity({
        email: input.email,
        name: input.name,
        orgName: input.orgName,
        plan: input.plan,
        market: brand.market,
        role: "owner",
      });
      const workspace = createEmptyWorkspace({
        user: identity.user,
        org: identity.org,
      });
      saveWorkspace(workspace);
      const repo = createLocalRepository(workspace);
      repoRef.current = repo;
      await applySnapshot(repo);
    },
    [authMode, applySnapshot, brand.id, brand.market],
  );

  const signOut = useCallback(async () => {
    if (repoRef.current) {
      await repoRef.current.clearAuth();
    }
    repoRef.current = null;
    setUser(null);
    setOrg(null);
    setMembers([]);
    setLeads([]);
    setContacts([]);
    setListings([]);
    setDeals([]);
    setMessages([]);
    setCallLogs([]);
    setSequences([]);
    setAutomations([]);
    setEnrollments([]);
    setTasks([]);
    setWebsite(null);
    setSocialAccounts([]);
    setSocialPosts([]);
  }, []);

  const setPlan = useCallback(
    async (plan: PlanId) => {
      if (!repoRef.current) return;
      const next = await repoRef.current.setPlan(plan);
      setOrg(toAppOrg(next));
      try {
        const snap = await repoRef.current.getSnapshot();
        if (snap) {
          setTenantPlan(snap.org.id, plan, snap.user.email);
          syncWorkspaceToPlatformRegistry(snap, "signup");
        }
      } catch {
        // ignore registry sync errors
      }
    },
    [],
  );

  const getAuthToken = useCallback(async () => {
    if (authMode !== "supabase") return null;
    const supabase = createBrowserSupabaseClient();
    // getSession() waits on the shared auth lock. If that lock is ever stuck
    // (e.g. another tab hung mid-refresh), fail after 10s so callers surface
    // an error instead of leaving the UI frozen on "Uploading…"/"Saving…".
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!result) return null;
    return result.data.session?.access_token || null;
  }, [authMode]);

  // The automation engine runs server-side against the service role, so local
  // workspace mode has no runtime — triggers are a no-op there. Failures never
  // block the user action that fired them.
  const fireAutomationTrigger = useCallback(
    async (input: {
      leadId: string;
      trigger: AutomationTrigger;
      stage?: Lead["stage"];
      automationId?: string;
    }) => {
      if (authMode !== "supabase") return null;
      try {
        const token = await getAuthToken();
        if (!token) return null;
        const res = await fetch("/api/automations/trigger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        });
        if (!res.ok) return null;
        return (await res.json()) as {
          enqueued?: number;
          completed?: number;
          waiting?: number;
          failed?: number;
        };
      } catch {
        return null;
      }
    },
    [authMode, getAuthToken],
  );

  const addLead = useCallback(
    async (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => {
      if (!repoRef.current || !org || !user) return;
      const phones =
        lead.phone && !lead.phones?.length
          ? [
              buildPhoneContactMethod({
                number: lead.phone,
                source: "manual",
                consent: "unknown",
                verification: "unverified",
              }),
            ]
          : lead.phones;
      const prepared = prepareNewLead(
        { ...lead, phones },
        {
          plan: org.plan,
          settings: hydrateLeadRouting(org.leadRouting),
          members,
          existingLeads: leads,
          creatorId: user.id,
          fallbackId: ownerId(members) || user.id,
          territory: lead.territory,
          explicitAssignee: lead.assignedTo || undefined,
        },
      );
      const created = await repoRef.current.createLead({
        ...lead,
        market: brand.market,
        phones,
        score: prepared.score,
        assignedTo: prepared.assignedTo,
      });
      if (created?.id) {
        await fireAutomationTrigger({
          leadId: created.id,
          trigger: "lead_created",
          stage: created.stage,
        });
      }
      await refresh();
    },
    [brand.market, fireAutomationTrigger, leads, members, org, refresh, user],
  );

  const assignLead = useCallback(
    async (id: string, assignedTo: string) => {
      if (!repoRef.current) return;
      await repoRef.current.updateLead(id, { assignedTo });
      await refresh();
    },
    [refresh],
  );

  const saveLeadRouting = useCallback(
    async (settings: LeadRoutingSettings) => {
      if (!repoRef.current) return;
      const next = await repoRef.current.saveLeadRouting(settings);
      setOrg(toAppOrg(next));
    },
    [],
  );

  const updateLeadStage = useCallback(
    async (id: string, stage: Lead["stage"]) => {
      if (!repoRef.current) return;
      await repoRef.current.updateLeadStage(id, stage);
      await fireAutomationTrigger({
        leadId: id,
        trigger: "stage_changed",
        stage,
      });
      await refresh();
    },
    [fireAutomationTrigger, refresh],
  );

  const updateLead = useCallback(
    async (id: string, patch: LeadPatch) => {
      if (!repoRef.current) throw new Error("Workspace is not loaded");
      const current = leads.find((l) => l.id === id);
      if (!current) throw new Error("Lead not found");

      let nextPatch = patch;
      if (patch.phone !== undefined) {
        const number = patch.phone.trim();
        const existing =
          current.phones?.find((p) => p.preferred) || current.phones?.[0];
        if (!number) {
          nextPatch = { ...patch, phone: "", phones: [] };
        } else if (existing && existing.number === number) {
          nextPatch = { ...patch, phones: current.phones };
        } else {
          nextPatch = {
            ...patch,
            phone: number,
            phones: [
              buildPhoneContactMethod({
                number,
                source: existing?.source || "manual",
                consent: existing?.consent || "unknown",
                verification: "unverified",
              }),
            ],
          };
        }
      }

      const merged = { ...current, ...nextPatch };
      const { score } = scoreLead(merged);
      const saved = await repoRef.current.updateLead(id, { ...nextPatch, score });
      if (nextPatch.stage && nextPatch.stage !== current.stage) {
        await fireAutomationTrigger({
          leadId: id,
          trigger: "stage_changed",
          stage: nextPatch.stage,
        });
      }
      await refresh();
      return saved;
    },
    [fireAutomationTrigger, leads, refresh],
  );

  const runAutomationNow = useCallback(
    async (input: { leadId: string; automationId: string }) => {
      const result = await fireAutomationTrigger({
        leadId: input.leadId,
        trigger: "manual",
        automationId: input.automationId,
      });
      await refresh();
      return result;
    },
    [fireAutomationTrigger, refresh],
  );

  /** Advance parked `wait` steps without relying on cron cadence. */
  const runDueAutomations = useCallback(async () => {
    if (authMode !== "supabase") return null;
    try {
      const token = await getAuthToken();
      if (!token) return null;
      const res = await fetch("/api/automations/run-due", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { processed?: number };
      if (json.processed) await refresh();
      return json;
    } catch {
      return null;
    }
  }, [authMode, getAuthToken, refresh]);

  const listAutomationRuns = useCallback(async (leadId?: string) => {
    if (!repoRef.current) return [];
    return repoRef.current.listAutomationRuns(leadId);
  }, []);

  const listLeadActivities = useCallback(async (leadId: string) => {
    if (!repoRef.current) return [];
    return repoRef.current.listLeadActivities(leadId);
  }, []);

  const addContact = useCallback(
    async (contact: Omit<Contact, "id" | "createdAt" | "updatedAt" | "market">) => {
      if (!repoRef.current) return;
      await repoRef.current.createContact({
        ...contact,
        market: brand.market,
      });
      await refresh();
    },
    [brand.market, refresh],
  );

  const updateContact = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          Contact,
          | "name"
          | "email"
          | "phone"
          | "company"
          | "category"
          | "tags"
          | "notes"
          | "leadId"
          | "assignedTo"
          | "lastContactedAt"
        >
      >,
    ) => {
      if (!repoRef.current) return;
      await repoRef.current.updateContact(id, patch);
      
      const snap = await repoRef.current.getSnapshot();
      if (snap) {
        const contact = snap.contacts.find((c) => c.id === id);
        const targetLeadId = patch.leadId || contact?.leadId;
        if (targetLeadId) {
          const leadPatch: any = {};
          if (patch.name !== undefined) leadPatch.name = patch.name;
          if (patch.email !== undefined) leadPatch.email = patch.email;
          if (patch.phone !== undefined) {
            leadPatch.phone = patch.phone;
            const lead = snap.leads.find((l) => l.id === targetLeadId);
            if (lead?.phones?.length) {
              leadPatch.phones = [
                { ...lead.phones[0], number: patch.phone || "" },
                ...lead.phones.slice(1),
              ];
            }
          }
          if (Object.keys(leadPatch).length > 0) {
            await repoRef.current.updateLead(targetLeadId, leadPatch);
          }
        }
      }

      await refresh();
    },
    [refresh],
  );

  const deleteContact = useCallback(
    async (id: string) => {
      if (!repoRef.current) return;
      await repoRef.current.deleteContact(id);
      await refresh();
    },
    [refresh],
  );

  const promoteContactToLead = useCallback(
    async (contactId: string, input: { type: Lead["type"]; source?: string }) => {
      if (!repoRef.current) return;
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) return;
      const prepared = prepareNewLead(
        {
          email: contact.email || "",
          phone: contact.phone || contact.phones?.[0]?.number || "",
          phones: contact.phones,
          type: input.type,
          source: input.source || "referral",
          notes: contact.notes,
          assignedTo: contact.assignedTo,
        },
        {
          plan: org?.plan || "solo",
          settings: hydrateLeadRouting(org?.leadRouting),
          members,
          existingLeads: leads,
          creatorId: user?.id,
          fallbackId: ownerId(members) || contact.assignedTo || user?.id || "",
        },
      );
      const created = await repoRef.current.createLead({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || contact.phones?.[0]?.number || "",
        phones: contact.phones,
        type: input.type,
        stage: "new",
        score: prepared.score,
        assignedTo: prepared.assignedTo,
        market: contact.market,
        source: input.source || "referral",
        notes: contact.notes,
      });
      await repoRef.current.updateContact(contactId, {
        category: "lead",
        leadId: created.id,
      });
      if (created?.id) {
        await fireAutomationTrigger({
          leadId: created.id,
          trigger: "lead_created",
          stage: created.stage,
        });
      }
      await refresh();
    },
    [contacts, fireAutomationTrigger, leads, members, org, refresh, user],
  );

  const addListing = useCallback(
    async (
      listing: Omit<
        Listing,
        "id" | "createdAt" | "portals" | "imageUrl" | "market" | "currency"
      > & {
        imageUrl?: string;
      },
    ) => {
      if (!repoRef.current || !user) return;
      const market = brand.market;
      await repoRef.current.createListing({
        ...listing,
        market,
        currency: market === "uk" ? "GBP" : "USD",
        imageUrl:
          listing.imageUrl ||
          "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80",
        agentId: listing.agentId || user.id,
        portals:
          market === "uk"
            ? [
                { portal: "rightmove", status: "pending" },
                { portal: "zoopla", status: "not_connected" },
                { portal: "onthemarket", status: "not_connected" },
              ]
            : [{ portal: "mls", status: "pending" }],
        syncReadiness: 40,
        nextMilestone: "Complete listing pack",
        complianceIssues: [],
        createdAt: new Date().toISOString(),
      });
      await refresh();
    },
    [brand.market, refresh, user],
  );

  const updateListingStatus = useCallback(
    async (id: string, status: Listing["status"]) => {
      if (!repoRef.current) return;
      await repoRef.current.updateListingStatus(id, status);
      // Auto-create deal shell when moving to under_offer if none exists
      if (status === "under_offer") {
        const snap = await repoRef.current.getSnapshot();
        const listing = snap?.listings.find((l) => l.id === id);
        const existing = snap?.deals.find((d) => d.listingId === id);
        if (listing && !existing) {
          await repoRef.current.createDeal({
            listingId: listing.id,
            listingTitle: listing.title,
            parties: ["Buyer TBD", `Seller liaison: ${user?.name || "Agent"}`],
            stage: "Under offer",
            checklist:
              listing.market === "uk"
                ? [
                    { id: newId("chk"), label: "Memorandum of sale", done: false },
                    { id: newId("chk"), label: "AML checks", done: false },
                    { id: newId("chk"), label: "Conveyancer instructed", done: false },
                    { id: newId("chk"), label: "E-sign sale contract", done: false },
                    { id: newId("chk"), label: "Client money ledger entry", done: false },
                  ]
                : [
                    { id: newId("chk"), label: "Purchase agreement", done: false },
                    { id: newId("chk"), label: "Disclosures packet", done: false },
                    { id: newId("chk"), label: "Title company opened", done: false },
                    { id: newId("chk"), label: "Inspection contingency", done: false },
                    { id: newId("chk"), label: "E-sign addenda", done: false },
                  ],
            eSignStatus: "not_started",
            market: listing.market,
            value: listing.price,
            currency: listing.currency,
            coordinator: user?.name,
            riskLevel: "medium",
            ledgerStatus: "not_started",
            complianceStatus: "attention",
            notes: "Auto-created from listing under offer.",
          });
        }
      }
      await refresh();
    },
    [refresh, user?.name],
  );

  const queuePortalSync = useCallback(
    async (listingId: string) => {
      if (!repoRef.current) return "Repository unavailable";
      const snap = await repoRef.current.getSnapshot();
      const listing = snap?.listings.find((l) => l.id === listingId);
      if (!listing) return "Listing not found";
      if (!org?.id) return "Workspace unavailable";

      const connections = loadPortalConnections(org.id);
      const { portals, results, readiness, summary } = syncListingToPortals(
        listing,
        connections,
      );

      const allErrors = results
        .filter((r) => r.status === "error")
        .flatMap((r) => (r.message ? r.message.split("; ") : []));

      await repoRef.current.updateListing(listingId, {
        portals,
        complianceIssues: allErrors,
        syncReadiness: readiness.score,
        lastSyncAt: new Date().toISOString(),
        nextMilestone:
          results.find((r) => r.nextAction)?.nextAction || readiness.nextMilestone,
        status: listing.status === "draft" && results.some((r) => r.status === "synced")
          ? "active"
          : listing.status,
      });
      await refresh();
      return summary;
    },
    [refresh, org?.id],
  );

  const listPortalConnections = useCallback((): PortalConnection[] => {
    if (!org) return [];
    return mergeConnectionsWithDefaults(brand.market, loadPortalConnections(org.id));
  }, [org, brand.market]);

  const savePortalConnection = useCallback(
    (connection: PortalConnection) => {
      if (!org) return;
      upsertPortalConnection(org.id, connection);
    },
    [org],
  );

  const createDealFromListing = useCallback(
    async (listingId: string) => {
      await updateListingStatus(listingId, "under_offer");
    },
    [updateListingStatus],
  );

  const updateDealChecklistItem = useCallback(
    async (dealId: string, checklistId: string, done: boolean) => {
      if (!repoRef.current) return;
      await repoRef.current.updateDealChecklistItem(dealId, checklistId, done);
      await refresh();
    },
    [refresh],
  );

  const updateDealMeta = useCallback(
    async (
      dealId: string,
      patch: Partial<
        Pick<
          TransactionDeal,
          "stage" | "eSignStatus" | "ledgerStatus" | "complianceStatus" | "notes"
        >
      >,
    ) => {
      if (!repoRef.current) return;
      await repoRef.current.updateDealMeta(dealId, patch);
      await refresh();
    },
    [refresh],
  );

  const sendSms = useCallback(
    async (input: { leadId: string; body: string }) => {
      if (!repoRef.current || !org) {
        return { mode: "simulated" as const };
      }
      const lead = leads.find((l) => l.id === input.leadId);
      if (!lead) throw new Error("Lead not found");
      const phone = lead.phones?.find((p) => p.preferred) || lead.phones?.[0];
      const to = phone?.number || lead.phone;
      if (!to) throw new Error("Lead has no phone number");
      if (phone?.consent === "opted_out") {
        throw new Error("Cannot send SMS: contact opted out");
      }

      const res = await fetch("/api/twilio/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          leadId: lead.id,
          to,
          body: input.body,
          consent: phone?.consent || "unknown",
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: "live" | "simulated";
        sid?: string;
        status?: string;
        threadId?: string;
        sentAt?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to send SMS");

      // Local workspace persists here; Supabase persistence is handled by the API/service role.
      if (repoRef.current.mode === "local") {
        await repoRef.current.appendMessage({
          orgId: org.id,
          threadId: json.threadId || "",
          leadId: lead.id,
          direction: "outbound",
          body: input.body,
          status: "sent",
          providerSid: json.sid,
          sentAt: json.sentAt || new Date().toISOString(),
        });
      }
      await refresh();
      return { mode: json.mode || "simulated" };
    },
    [leads, org, refresh],
  );

  const sendEmail = useCallback(
    async (input: { leadId: string; subject: string; body: string }) => {
      if (!repoRef.current || !org) {
        return { mode: "simulated" as const };
      }
      const lead = leads.find((l) => l.id === input.leadId);
      if (!lead) throw new Error("Lead not found");
      const to = (lead.email || "").trim();
      if (!to) throw new Error("Lead has no email address");

      const token = authMode === "supabase" ? await getAuthToken() : null;
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          leadId: lead.id,
          to,
          subject: input.subject,
          body: input.body,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        mode?: "live" | "simulated";
        sid?: string;
        threadId?: string;
        sentAt?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to send email");

      if (repoRef.current.mode === "local") {
        await repoRef.current.appendMessage({
          orgId: org.id,
          threadId: json.threadId || "",
          leadId: lead.id,
          direction: "outbound",
          body: input.body,
          subject: input.subject,
          channel: "email",
          status: "sent",
          providerSid: json.sid,
          sentAt: json.sentAt || new Date().toISOString(),
        });
      }
      await refresh();
      return { mode: json.mode || "simulated" };
    },
    [authMode, getAuthToken, leads, org, refresh],
  );

  const logCall = useCallback(
    async (input: {
      leadId: string;
      outcome: CallLog["outcome"];
      notes?: string;
    }) => {
      if (!repoRef.current || !org) return;
      const lead = leads.find((l) => l.id === input.leadId);
      if (!lead) return;
      await repoRef.current.logCall({
        orgId: org.id,
        leadId: lead.id,
        direction: "outbound",
        phoneNumber: lead.phones?.[0]?.number || lead.phone,
        outcome: input.outcome,
        notes: input.notes,
        durationSeconds: 0,
      });
      await refresh();
    },
    [leads, org, refresh],
  );

  const setLeadWorkflow = useCallback(
    async (input: { leadId: string; followUp: boolean; nurture: boolean }) => {
      if (!repoRef.current || !org) return;
      const seqs = await repoRef.current.listSequences();
      const primary = seqs[0];
      if (!primary) return;
      await repoRef.current.upsertEnrollment({
        orgId: org.id,
        sequenceId: primary.id,
        leadId: input.leadId,
        status: "active",
        followUp: input.followUp,
        nurture: input.nurture,
      });
      await refresh();
    },
    [org, refresh],
  );

  const createAutomation = useCallback(
    async (
      automation: Omit<Automation, "id" | "createdAt" | "updatedAt" | "orgId">,
    ) => {
      if (!repoRef.current || !org) return;
      await repoRef.current.createAutomation({
        ...automation,
        orgId: org.id,
      });
      await refresh();
    },
    [org, refresh],
  );

  const updateAutomation = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          Automation,
          | "name"
          | "description"
          | "trigger"
          | "triggerStage"
          | "status"
          | "steps"
        >
      >,
    ) => {
      if (!repoRef.current) return;
      await repoRef.current.updateAutomation(id, patch);
      await refresh();
    },
    [refresh],
  );

  const deleteAutomation = useCallback(
    async (id: string) => {
      if (!repoRef.current) return;
      await repoRef.current.deleteAutomation(id);
      await refresh();
    },
    [refresh],
  );

  const resolveTask = useCallback(
    async (taskId: string) => {
      if (!repoRef.current) return;
      await repoRef.current.resolveTask(taskId);
      await refresh();
    },
    [refresh],
  );

  const saveWebsite = useCallback(
    async (site: WebsiteSite) => {
      if (!repoRef.current) return;
      await repoRef.current.saveWebsite(site);
      await refresh();
    },
    [refresh],
  );

  const upsertSocialAccount = useCallback(
    async (account: Omit<SocialAccount, "id" | "orgId"> & { id?: string }) => {
      if (!repoRef.current || !org) return;
      await repoRef.current.upsertSocialAccount({
        ...account,
        orgId: org.id,
      });
      await refresh();
    },
    [org, refresh],
  );

  const deleteSocialAccount = useCallback(
    async (id: string) => {
      if (!repoRef.current) return;
      await repoRef.current.deleteSocialAccount(id);
      await refresh();
    },
    [refresh],
  );

  const createSocialPost = useCallback(
    async (post: Omit<SocialPost, "id" | "createdAt" | "orgId">) => {
      if (!repoRef.current || !org) {
        throw new Error("Workspace is not loaded. Refresh and try again.");
      }
      const created = await repoRef.current.createSocialPost({
        ...post,
        orgId: org.id,
      });
      await refresh();
      return created.id;
    },
    [org, refresh],
  );

  const receiveInboundSms = useCallback(
    async (input: { leadId: string; body: string }) => {
      if (!repoRef.current || !org) {
        throw new Error("Workspace not loaded");
      }
      const lead = leads.find((l) => l.id === input.leadId);
      if (!lead) throw new Error("Lead not found");

      if (repoRef.current.mode === "local") {
        await repoRef.current.appendMessage({
          orgId: org.id,
          threadId: "",
          leadId: lead.id,
          direction: "inbound",
          body: input.body,
          status: "received",
          providerSid: `sim_in_${Date.now()}`,
          sentAt: new Date().toISOString(),
        });
        await refresh();
        return { mode: "simulated" as const };
      }

      const token = await getAuthToken();
      if (!token) throw new Error("Sign in required to simulate inbound SMS");

      const res = await fetch("/api/messaging/inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leadId: input.leadId,
          body: input.body,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to record inbound SMS");
      await refresh();
      return { mode: "simulated" as const };
    },
    [getAuthToken, leads, org, refresh],
  );

  const publishSocialPostNow = useCallback(
    async (postId: string) => {
      if (authMode === "local") {
        if (!repoRef.current) return { ok: false, message: "Workspace not loaded." };
        await repoRef.current.updateSocialPost(postId, {
          status: "published",
          publishedAt: new Date().toISOString(),
          lastError: undefined,
        });
        await refresh();
        return {
          ok: true,
          message: "Post published to simulated social media accounts (Dev Mode).",
        };
      }

      const token = await getAuthToken();
      if (!token) {
        return { ok: false, message: "Authentication token required for server publishing." };
      }
      try {
        // The publish route polls Instagram's container status and can run up
        // to its 60s maxDuration — but the client must never wait forever if
        // the connection stalls, or the Compose buttons stay disabled.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);
        let res: Response;
        try {
          res = await fetch("/api/social/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ postId }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          error?: string;
        };
        await refresh();
        return { ok: Boolean(json.ok), message: json.message || json.error || "Publish failed" };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return {
            ok: false,
            message:
              "Publishing timed out. It may still complete on the server — check the queue in a minute before retrying.",
          };
        }
        return { ok: false, message: err instanceof Error ? err.message : "Publish failed" };
      }
    },
    [authMode, getAuthToken, refresh],
  );

  const updateSocialPost = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          SocialPost,
          | "caption"
          | "status"
          | "scheduledFor"
          | "publishedAt"
          | "accountIds"
          | "media"
          | "linkUrl"
          | "listingId"
          | "lastError"
        >
      >,
    ) => {
      if (!repoRef.current) return;
      await repoRef.current.updateSocialPost(id, patch);
      await refresh();
    },
    [refresh],
  );

  const deleteSocialPost = useCallback(
    async (id: string) => {
      if (!repoRef.current) return;
      await repoRef.current.deleteSocialPost(id);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      user,
      org,
      members,
      leads,
      contacts,
      listings,
      deals,
      messages,
      callLogs,
      sequences,
      automations,
      enrollments,
      tasks,
      website,
      socialAccounts,
      socialPosts,
      loading,
      authMode,
      persistence: (repoRef.current?.mode || authMode) as "local" | "supabase",
      signIn,
      signUp,
      signOut,
      setPlan,
      refresh,
      addLead,
      assignLead,
      saveLeadRouting,
      updateLeadStage,
      updateLead,
      addContact,
      updateContact,
      deleteContact,
      promoteContactToLead,
      addListing,
      updateListingStatus,
      queuePortalSync,
      listPortalConnections,
      savePortalConnection,
      createDealFromListing,
      updateDealChecklistItem,
      updateDealMeta,
      sendSms,
      sendEmail,
      receiveInboundSms,
      logCall,
      setLeadWorkflow,
      createAutomation,
      updateAutomation,
      deleteAutomation,
      runAutomationNow,
      runDueAutomations,
      listAutomationRuns,
      listLeadActivities,
      resolveTask,
      saveWebsite,
      upsertSocialAccount,
      deleteSocialAccount,
      createSocialPost,
      getAuthToken,
      publishSocialPostNow,
      updateSocialPost,
      deleteSocialPost,
    }),
    [
      user,
      org,
      members,
      leads,
      contacts,
      listings,
      deals,
      messages,
      callLogs,
      sequences,
      automations,
      enrollments,
      tasks,
      website,
      socialAccounts,
      socialPosts,
      loading,
      authMode,
      signIn,
      signUp,
      signOut,
      setPlan,
      refresh,
      addLead,
      assignLead,
      saveLeadRouting,
      updateLeadStage,
      updateLead,
      addContact,
      updateContact,
      deleteContact,
      promoteContactToLead,
      addListing,
      updateListingStatus,
      queuePortalSync,
      listPortalConnections,
      savePortalConnection,
      createDealFromListing,
      updateDealChecklistItem,
      updateDealMeta,
      sendSms,
      sendEmail,
      receiveInboundSms,
      logCall,
      setLeadWorkflow,
      createAutomation,
      updateAutomation,
      deleteAutomation,
      runAutomationNow,
      runDueAutomations,
      listAutomationRuns,
      listLeadActivities,
      resolveTask,
      saveWebsite,
      upsertSocialAccount,
      deleteSocialAccount,
      createSocialPost,
      getAuthToken,
      publishSocialPostNow,
      updateSocialPost,
      deleteSocialPost,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppSession() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppSession must be used within AppSessionProvider");
  return { ...ctx, brand: getActiveBrand(), market: getActiveBrand().market };
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminCanEditNotes,
  adminCanImpersonate,
  adminCanManageBilling,
  adminCanManageUsers,
  adminCanSuspendTenants,
} from "@/lib/admin/accounts";
import type {
  PlatformAdminUser,
  PlatformAuditEvent,
  PlatformRegistry,
  SubscriptionStatus,
  TenantLifecycleStatus,
  TenantRecord,
} from "@/lib/admin/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MemberAction } from "@/lib/admin/member-actions";
import {
  applyTenantMemberAction,
  applyTenantSubscriptionAction,
  clearPlatformAdminAuth,
  getPlatformMetrics,
  loadPlatformRegistry,
  setTenantLifecycle,
  setTenantPlan,
  setTenantSubscriptionStatus,
  updateTenantNotes,
  updateTenantName,
} from "@/lib/admin/registry";
import type { SubscriptionAction } from "@/lib/admin/subscription-actions";
import type { PlanId, Role } from "@/types";

interface AdminState {
  admin: PlatformAdminUser | null;
  loading: boolean;
  registry: PlatformRegistry;
  registryError: string | null;
  metrics: ReturnType<typeof getPlatformMetrics>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
  canManageBilling: boolean;
  canSuspend: boolean;
  canEditNotes: boolean;
  updatePlan: (orgId: string, plan: PlanId) => void;
  updateSubscriptionStatus: (
    orgId: string,
    status: SubscriptionStatus,
    reason?: string,
  ) => void;
  manageSubscription: (
    orgId: string,
    action: SubscriptionAction,
    plan?: PlanId,
  ) => Promise<string>;
  updateLifecycle: (
    orgId: string,
    status: TenantLifecycleStatus,
    notes?: string,
  ) => Promise<void>;
  saveNotes: (orgId: string, notes: string) => void;
  renameTenant: (orgId: string, name: string) => void;
  canImpersonate: boolean;
  canManageUsers: boolean;
  manageMember: (
    orgId: string,
    memberId: string,
    action: MemberAction,
    role?: Role,
  ) => Promise<string>;
  getTenant: (id: string) => TenantRecord | undefined;
  recentAudit: PlatformAuditEvent[];
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdminUser | null>(null);
  const [registry, setRegistry] = useState<PlatformRegistry>({
    version: 1,
    tenants: [],
    audit: [],
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return (async () => {
      try {
        const res = await fetch("/api/admin/registry");
        const json = (await res.json().catch(() => null)) as {
          source?: string;
          registry?: PlatformRegistry;
          error?: string;
        } | null;
        if (res.ok && json?.source === "supabase" && json.registry) {
          setRegistry(json.registry);
          setRegistryError(null);
          return;
        }
        if (res.ok && json?.source === "local") {
          setRegistry(loadPlatformRegistry());
          setRegistryError(null);
          return;
        }
        // Keep whatever registry we already have; surface the failure
        // instead of silently showing zero tenants.
        setRegistryError(
          json?.error || `Could not load tenants (HTTP ${res.status})`,
        );
      } catch {
        setRegistryError("Could not reach the registry service");
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let signedIn = false;
      try {
        const res = await fetch("/api/admin/session");
        if (res.ok) {
          const json = (await res.json()) as { admin?: PlatformAdminUser | null };
          if (json.admin) {
            signedIn = true;
            if (!cancelled) setAdmin(json.admin);
          }
        }
      } catch {
        // Stay signed out if the session check fails.
      }
      if (cancelled) return;
      if (signedIn) {
        await refresh();
      } else {
        setRegistryError(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => null)) as {
      admin?: PlatformAdminUser;
      error?: string;
    } | null;
    if (!res.ok || !json?.admin) {
      throw new Error(json?.error || "Invalid admin credentials");
    }
    // One principal per browser: admin login ends any brokerage session.
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Org session cleanup is best-effort.
    }
    // Load tenants before the console shell mounts. Setting the admin first
    // painted the previous signed-out failure ("Unauthorized") for a few
    // seconds, until this refresh replaced it.
    setRegistryError(null);
    await refresh();
    setAdmin(json.admin);
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Cookie clear is best-effort.
    }
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Org session cleanup is best-effort.
    }
    clearPlatformAdminAuth();
    setAdmin(null);
    setRegistryError(null);
  }, []);

  const persistTenant = useCallback(
    async (
      orgId: string,
      body: Record<string, unknown>,
      localFallback: () => void,
    ) => {
      const res = await fetch(`/api/admin/tenants/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        source?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.error || "Update failed");
      }
      if (json?.source === "local") localFallback();
      await refresh();
    },
    [refresh],
  );

  const updatePlan = useCallback(
    (orgId: string, plan: PlanId) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageBilling(admin.role)) {
        throw new Error("Billing permission required");
      }
      void persistTenant(orgId, { plan }, () => {
        setTenantPlan(orgId, plan, admin.email);
      });
    },
    [admin, persistTenant],
  );

  const updateSubscriptionStatus = useCallback(
    (orgId: string, status: SubscriptionStatus, reason?: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageBilling(admin.role)) {
        throw new Error("Billing permission required");
      }
      void persistTenant(orgId, { subscriptionStatus: status }, () => {
        setTenantSubscriptionStatus(orgId, status, admin.email, reason);
      });
    },
    [admin, persistTenant],
  );

  const manageSubscription = useCallback(
    async (orgId: string, action: SubscriptionAction, plan?: PlanId) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageBilling(admin.role)) {
        throw new Error("Billing permission required");
      }
      const res = await fetch(`/api/admin/subscriptions/${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, plan }),
      });
      const json = (await res.json().catch(() => null)) as {
        source?: string;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.error || "Could not update the subscription");
      }
      if (json?.source === "local") {
        const applied = applyTenantSubscriptionAction(orgId, action, admin.email, plan);
        refresh();
        return applied.message;
      }
      refresh();
      return json?.message || "Subscription updated.";
    },
    [admin, refresh],
  );

  const updateLifecycle = useCallback(
    (orgId: string, status: TenantLifecycleStatus, notes?: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanSuspendTenants(admin.role) && status === "suspended") {
        throw new Error("Suspend permission required");
      }
      return persistTenant(
        orgId,
        { lifecycleStatus: status, notes },
        () => setTenantLifecycle(orgId, status, admin.email, notes),
      );
    },
    [admin, persistTenant],
  );

  const saveNotes = useCallback(
    (orgId: string, notes: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanEditNotes(admin.role)) {
        throw new Error("Notes permission required");
      }
      void persistTenant(orgId, { notes }, () => {
        updateTenantNotes(orgId, notes, admin.email);
      });
    },
    [admin, persistTenant],
  );

  const manageMember = useCallback(
    async (orgId: string, memberId: string, action: MemberAction, role?: Role) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageUsers(admin.role)) {
        throw new Error("User management permission required");
      }
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, memberId, action, role }),
      });
      const json = (await res.json().catch(() => null)) as {
        source?: string;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.error || "Could not update this user");
      }
      if (json?.source === "local") {
        const applied = applyTenantMemberAction(orgId, memberId, action, admin.email, role);
        await refresh();
        return applied.message;
      }
      await refresh();
      return json?.message || "User updated.";
    },
    [admin, refresh],
  );

  const renameTenant = useCallback(
    (orgId: string, name: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanEditNotes(admin.role)) {
        throw new Error("Rename permission required");
      }
      void persistTenant(orgId, { name }, () => {
        updateTenantName(orgId, name, admin.email);
      });
    },
    [admin, persistTenant],
  );

  const value = useMemo<AdminState>(
    () => ({
      admin,
      loading,
      registry,
      registryError,
      metrics: getPlatformMetrics(registry),
      signIn,
      signOut,
      refresh,
      canManageBilling: admin ? adminCanManageBilling(admin.role) : false,
      canSuspend: admin ? adminCanSuspendTenants(admin.role) : false,
      canEditNotes: admin ? adminCanEditNotes(admin.role) : false,
      canImpersonate: admin ? adminCanImpersonate(admin.role) : false,
      canManageUsers: admin ? adminCanManageUsers(admin.role) : false,
      manageMember,
      updatePlan,
      updateSubscriptionStatus,
      manageSubscription,
      updateLifecycle,
      saveNotes,
      renameTenant,
      getTenant: (id) => registry.tenants.find((t) => t.id === id),
      recentAudit: registry.audit.slice(0, 50),
    }),
    [
      admin,
      loading,
      registry,
      registryError,
      signIn,
      signOut,
      refresh,
      updatePlan,
      updateSubscriptionStatus,
      manageSubscription,
      manageMember,
      updateLifecycle,
      saveNotes,
      renameTenant,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdminSession() {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return ctx;
}

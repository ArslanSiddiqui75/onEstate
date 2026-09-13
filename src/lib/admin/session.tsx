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
import {
  clearPlatformAdminAuth,
  getPlatformMetrics,
  loadPlatformRegistry,
  setTenantLifecycle,
  setTenantPlan,
  setTenantSubscriptionStatus,
  updateTenantNotes,
  updateTenantName,
} from "@/lib/admin/registry";
import type { PlanId } from "@/types";

interface AdminState {
  admin: PlatformAdminUser | null;
  loading: boolean;
  registry: PlatformRegistry;
  registryError: string | null;
  metrics: ReturnType<typeof getPlatformMetrics>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
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
  updateLifecycle: (
    orgId: string,
    status: TenantLifecycleStatus,
    notes?: string,
  ) => void;
  saveNotes: (orgId: string, notes: string) => void;
  renameTenant: (orgId: string, name: string) => void;
  canImpersonate: boolean;
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
    void (async () => {
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
    void (async () => {
      try {
        const res = await fetch("/api/admin/session");
        if (res.ok) {
          const json = (await res.json()) as { admin?: PlatformAdminUser | null };
          if (json.admin) setAdmin(json.admin);
        }
      } catch {
        // Stay signed out if the session check fails.
      } finally {
        refresh();
        setLoading(false);
      }
    })();
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
    setAdmin(json.admin);
    refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    void fetch("/api/admin/logout", { method: "POST" });
    // Session isolation: ending the admin session also ends any brokerage
    // (Supabase) session active in this browser.
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) void supabase.auth.signOut();
    } catch {
      // Org session cleanup is best-effort.
    }
    clearPlatformAdminAuth();
    setAdmin(null);
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
      refresh();
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

  const updateLifecycle = useCallback(
    (orgId: string, status: TenantLifecycleStatus, notes?: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanSuspendTenants(admin.role) && status === "suspended") {
        throw new Error("Suspend permission required");
      }
      void persistTenant(
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
      updatePlan,
      updateSubscriptionStatus,
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

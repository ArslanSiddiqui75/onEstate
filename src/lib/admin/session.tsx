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
  adminCanManageBilling,
  adminCanSuspendTenants,
  findPlatformAdmin,
  type PlatformAdminAccount,
} from "@/lib/admin/accounts";
import {
  clearPlatformAdminAuth,
  getPlatformMetrics,
  loadPlatformRegistry,
  readPlatformAdminAuth,
  setTenantLifecycle,
  setTenantPlan,
  setTenantSubscriptionStatus,
  updateTenantNotes,
  writePlatformAdminAuth,
} from "@/lib/admin/registry";
import type {
  PlatformAuditEvent,
  PlatformRegistry,
  SubscriptionStatus,
  TenantLifecycleStatus,
  TenantRecord,
} from "@/lib/admin/types";
import type { PlanId } from "@/types";

interface AdminState {
  admin: Omit<PlatformAdminAccount, "password"> | null;
  loading: boolean;
  registry: PlatformRegistry;
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
  getTenant: (id: string) => TenantRecord | undefined;
  recentAudit: PlatformAuditEvent[];
}

const AdminContext = createContext<AdminState | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Omit<PlatformAdminAccount, "password"> | null>(
    null,
  );
  const [registry, setRegistry] = useState<PlatformRegistry>({
    version: 1,
    tenants: [],
    audit: [],
    updatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setRegistry(loadPlatformRegistry());
  }, []);

  useEffect(() => {
    const existing = readPlatformAdminAuth();
    if (existing) setAdmin(existing);
    setRegistry(loadPlatformRegistry());
    setLoading(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const found = findPlatformAdmin(email, password);
    if (!found) throw new Error("Invalid admin credentials");
    const next = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
    };
    writePlatformAdminAuth(next);
    setAdmin(next);
    setRegistry(loadPlatformRegistry());
  }, []);

  const signOut = useCallback(() => {
    clearPlatformAdminAuth();
    setAdmin(null);
  }, []);

  const updatePlan = useCallback(
    (orgId: string, plan: PlanId) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageBilling(admin.role)) {
        throw new Error("Billing permission required");
      }
      setTenantPlan(orgId, plan, admin.email);
      refresh();
    },
    [admin, refresh],
  );

  const updateSubscriptionStatus = useCallback(
    (orgId: string, status: SubscriptionStatus, reason?: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanManageBilling(admin.role)) {
        throw new Error("Billing permission required");
      }
      setTenantSubscriptionStatus(orgId, status, admin.email, reason);
      refresh();
    },
    [admin, refresh],
  );

  const updateLifecycle = useCallback(
    (orgId: string, status: TenantLifecycleStatus, notes?: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanSuspendTenants(admin.role) && status === "suspended") {
        throw new Error("Suspend permission required");
      }
      setTenantLifecycle(orgId, status, admin.email, notes);
      refresh();
    },
    [admin, refresh],
  );

  const saveNotes = useCallback(
    (orgId: string, notes: string) => {
      if (!admin) throw new Error("Not authenticated");
      if (!adminCanEditNotes(admin.role)) {
        throw new Error("Notes permission required");
      }
      updateTenantNotes(orgId, notes, admin.email);
      refresh();
    },
    [admin, refresh],
  );

  const value = useMemo<AdminState>(
    () => ({
      admin,
      loading,
      registry,
      metrics: getPlatformMetrics(registry),
      signIn,
      signOut,
      refresh,
      canManageBilling: admin ? adminCanManageBilling(admin.role) : false,
      canSuspend: admin ? adminCanSuspendTenants(admin.role) : false,
      canEditNotes: admin ? adminCanEditNotes(admin.role) : false,
      updatePlan,
      updateSubscriptionStatus,
      updateLifecycle,
      saveNotes,
      getTenant: (id) => registry.tenants.find((t) => t.id === id),
      recentAudit: registry.audit.slice(0, 50),
    }),
    [
      admin,
      loading,
      registry,
      signIn,
      signOut,
      refresh,
      updatePlan,
      updateSubscriptionStatus,
      updateLifecycle,
      saveNotes,
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

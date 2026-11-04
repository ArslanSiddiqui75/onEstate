import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminGateMap,
  adminGateSlugForRole,
  resolveAdminGate,
} from "@/lib/admin/gates";

describe("admin login gates", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps configured opaque slugs to roles", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "w7bfw9");
    vi.stubEnv("PLATFORM_ADMIN_GATE_BILLING", "h4c9rm2");
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPPORT", "n8q2vxp");
    expect(resolveAdminGate("w7bfw9")).toBe("super_admin");
    expect(resolveAdminGate("/H4C9RM2")).toBe("billing_admin");
    expect(resolveAdminGate("n8q2vxp")).toBe("support_admin");
    expect(adminGateSlugForRole("billing_admin")).toBe("h4c9rm2");
  });

  it("ignores reserved path segments", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "admin");
    vi.stubEnv("PLATFORM_ADMIN_GATE_BILLING", "app");
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPPORT", "okgate1");
    expect(adminGateMap()).toEqual({ okgate1: "support_admin" });
  });

  it("returns null for unknown slugs", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "w7bfw9");
    expect(resolveAdminGate("not-a-gate")).toBeNull();
  });
});

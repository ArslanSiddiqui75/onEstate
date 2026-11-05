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
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "w7bfw9devlocal");
    vi.stubEnv("PLATFORM_ADMIN_GATE_BILLING", "h4c9rm2devlocal");
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPPORT", "n8q2vxpdevlocal");
    expect(resolveAdminGate("w7bfw9devlocal")).toBe("super_admin");
    expect(resolveAdminGate("/H4C9RM2DEVLOCAL")).toBe("billing_admin");
    expect(resolveAdminGate("n8q2vxpdevlocal")).toBe("support_admin");
    expect(adminGateSlugForRole("billing_admin")).toBe("h4c9rm2devlocal");
  });

  it("ignores reserved path segments", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "admin");
    vi.stubEnv("PLATFORM_ADMIN_GATE_BILLING", "app");
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPPORT", "okgate1secure");
    expect(adminGateMap()).toEqual({ okgate1secure: "support_admin" });
  });

  it("rejects short or non-alphanumeric slugs", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "abc");
    vi.stubEnv("PLATFORM_ADMIN_GATE_BILLING", "has.dot");
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPPORT", "goodgate99");
    expect(adminGateMap()).toEqual({ goodgate99: "support_admin" });
  });

  it("returns null for unknown slugs", () => {
    vi.stubEnv("PLATFORM_ADMIN_GATE_SUPER", "w7bfw9devlocal");
    expect(resolveAdminGate("not-a-gate")).toBeNull();
  });
});

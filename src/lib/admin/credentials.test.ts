import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticatePlatformAdmin,
  adminSessionSecret,
} from "@/lib/admin/credentials";
import {
  issueAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/admin/session-token";

const admin = {
  id: "padmin_super",
  name: "Platform Super Admin",
  email: "admin@certified.local",
  role: "super_admin" as const,
};

describe("authenticatePlatformAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts PLATFORM_ADMIN_PASSWORD for a known admin email", () => {
    vi.stubEnv("PLATFORM_ADMIN_PASSWORD", "RotateMeNow!");
    expect(
      authenticatePlatformAdmin("admin@certified.local", "RotateMeNow!"),
    ).toMatchObject({ email: "admin@certified.local", role: "super_admin" });
  });

  it("rejects a wrong password", () => {
    vi.stubEnv("PLATFORM_ADMIN_PASSWORD", "RotateMeNow!");
    expect(
      authenticatePlatformAdmin("admin@certified.local", "nope"),
    ).toBeNull();
  });

  it("rejects unknown emails", () => {
    vi.stubEnv("PLATFORM_ADMIN_PASSWORD", "RotateMeNow!");
    expect(authenticatePlatformAdmin("nobody@x.com", "RotateMeNow!")).toBeNull();
  });
});

describe("admin session tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a signed token", () => {
    vi.stubEnv("PLATFORM_ADMIN_SESSION_SECRET", "session-secret-value");
    expect(adminSessionSecret()).toBe("session-secret-value");
    const token = issueAdminSessionToken(admin);
    expect(token).toBeTruthy();
    expect(verifyAdminSessionToken(token)).toEqual(admin);
  });

  it("rejects a tampered token", () => {
    vi.stubEnv("PLATFORM_ADMIN_SESSION_SECRET", "session-secret-value");
    const token = issueAdminSessionToken(admin);
    expect(verifyAdminSessionToken(`${token}x`)).toBeNull();
    expect(verifyAdminSessionToken("not-a-token")).toBeNull();
    expect(verifyAdminSessionToken(null)).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminMfaConfigured,
  issueAdminMfaPendingToken,
  pendingAdminFromChallenge,
  verifyAdminMfaCode,
  verifyAdminMfaPendingToken,
} from "@/lib/admin/mfa";
import { generateTotp } from "@/lib/admin/totp";

const admin = {
  id: "padmin_super",
  name: "Platform Super Admin",
  email: "admin@certified.local",
  role: "super_admin" as const,
};

describe("admin mfa pending challenge", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues and verifies a pending challenge, then accepts TOTP", () => {
    vi.stubEnv("PLATFORM_ADMIN_SESSION_SECRET", "session-secret-value-32chars!!");
    vi.stubEnv("PLATFORM_ADMIN_TOTP_SUPER", "JBSWY3DPEHPK3PXP");
    expect(adminMfaConfigured("super_admin")).toBe(true);

    const token = issueAdminMfaPendingToken(admin);
    expect(token).toBeTruthy();
    const pending = verifyAdminMfaPendingToken(token);
    expect(pending).toMatchObject({
      email: admin.email,
      role: "super_admin",
      channel: "totp",
    });
    expect(pendingAdminFromChallenge(pending!)).toEqual(admin);

    const code = generateTotp("JBSWY3DPEHPK3PXP");
    expect(verifyAdminMfaCode(pending!, code)).toBe(true);
    expect(verifyAdminMfaCode(pending!, "000000")).toBe(false);
  });

  it("rejects a tampered pending token", () => {
    vi.stubEnv("PLATFORM_ADMIN_SESSION_SECRET", "session-secret-value-32chars!!");
    vi.stubEnv("PLATFORM_ADMIN_TOTP_SUPER", "JBSWY3DPEHPK3PXP");
    const token = issueAdminMfaPendingToken(admin);
    expect(verifyAdminMfaPendingToken(`${token}x`)).toBeNull();
  });
});

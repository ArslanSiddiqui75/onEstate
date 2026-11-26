import { afterEach, describe, expect, it } from "vitest";
import {
  MAINTENANCE_MESSAGE,
  isRoleUnderMaintenance,
  loadLocalMaintenance,
  normalizeMaintenanceSettings,
  saveLocalMaintenance,
} from "@/lib/admin/maintenance";

describe("role maintenance settings", () => {
  afterEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("normalises roles and ignores unknown values", () => {
    const settings = normalizeMaintenanceSettings({
      enabled: true,
      roles: ["owner", "agent", "not-a-role", "owner"],
      updatedAt: "2026-11-26T00:00:00.000Z",
      updatedBy: "admin@certified.local",
    });
    expect(settings.enabled).toBe(true);
    expect(settings.roles).toEqual(["owner", "agent"]);
    expect(settings.updatedBy).toBe("admin@certified.local");
  });

  it("only blocks a role when the master switch is on", () => {
    expect(
      isRoleUnderMaintenance(
        { enabled: false, roles: ["owner"], updatedAt: "" },
        "owner",
      ),
    ).toBe(false);
    expect(
      isRoleUnderMaintenance(
        { enabled: true, roles: ["owner", "agent"], updatedAt: "" },
        "broker",
      ),
    ).toBe(false);
    expect(
      isRoleUnderMaintenance(
        { enabled: true, roles: ["owner", "agent"], updatedAt: "" },
        "agent",
      ),
    ).toBe(true);
  });

  it("keeps the sign-in copy fixed and stores settings when window exists", () => {
    expect(MAINTENANCE_MESSAGE).toBe(
      "Maintenance mode is on. Please try again later.",
    );
    if (typeof window === "undefined" || !window.localStorage) return;
    saveLocalMaintenance({
      enabled: true,
      roles: ["assistant"],
      updatedAt: "2026-11-26T00:00:00.000Z",
      updatedBy: "admin@certified.local",
    });
    expect(loadLocalMaintenance()).toMatchObject({
      enabled: true,
      roles: ["assistant"],
      updatedBy: "admin@certified.local",
    });
  });
});

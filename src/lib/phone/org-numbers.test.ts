import { describe, expect, it } from "vitest";
import { MAX_ORG_PHONE_NUMBERS } from "@/lib/phone/org-numbers";
import {
  defaultFromNumber,
  resolveOwnedNumbers,
} from "@/components/crm/from-number-select";

describe("org phone numbers", () => {
  it("caps how many numbers one workspace can hold", () => {
    expect(MAX_ORG_PHONE_NUMBERS).toBeGreaterThanOrEqual(2);
    expect(MAX_ORG_PHONE_NUMBERS).toBeLessThanOrEqual(20);
  });

  it("falls back to the legacy single org number", () => {
    expect(resolveOwnedNumbers({ phoneNumber: "+447700900123" })).toEqual([
      { id: "legacy", phoneNumber: "+447700900123", isDefault: true },
    ]);
  });

  it("prefers the flagged default when choosing From", () => {
    expect(
      defaultFromNumber([
        { id: "a", phoneNumber: "+15551111111", isDefault: false },
        { id: "b", phoneNumber: "+15552222222", isDefault: true },
      ]),
    ).toBe("+15552222222");
  });
});

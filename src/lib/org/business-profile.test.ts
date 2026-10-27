import { describe, expect, it } from "vitest";
import {
  businessProfileFilled,
  readBusinessProfile,
  validateBusinessProfile,
} from "@/lib/org/business-profile";

describe("business profile", () => {
  it("requires a trading name and normalises the website", () => {
    const missing = validateBusinessProfile({ tradingName: " " });
    expect(missing.ok).toBe(false);

    const saved = validateBusinessProfile({
      tradingName: "  Northbridge Realty  ",
      website: "northbridge.co.uk",
      email: "Hello@Northbridge.co.uk",
      phone: "+441613334444",
      postcode: " m1 2ab ",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.tradingName).toBe("Northbridge Realty");
    expect(saved.value.website).toBe("https://northbridge.co.uk");
    expect(saved.value.email).toBe("hello@northbridge.co.uk");
    expect(saved.value.postcode).toBe("m1 2ab");
  });

  it("rejects a phone or website that is not usable", () => {
    expect(
      validateBusinessProfile({ tradingName: "Northbridge", phone: "0161" }).ok,
    ).toBe(false);
    expect(
      validateBusinessProfile({ tradingName: "Northbridge", website: "not a site" }).ok,
    ).toBe(false);
  });

  it("reads a stored blob only when something was filled in", () => {
    expect(readBusinessProfile({})).toBeUndefined();
    expect(readBusinessProfile(null)).toBeUndefined();
    const profile = readBusinessProfile({ tradingName: "Northbridge", city: "Manchester" });
    expect(businessProfileFilled(profile)).toBe(true);
    expect(profile?.city).toBe("Manchester");
  });
});

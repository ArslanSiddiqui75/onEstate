import { describe, expect, it } from "vitest";
import {
  businessProfileFilled,
  normalizeBusinessProfile,
  readBusinessProfile,
  resolveUnsubscribeFooter,
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

  it("normalises legal, regions, representative, and compliance settings", () => {
    const profile = normalizeBusinessProfile({
      tradingName: "Harbour Homes",
      brandedDomain: "https://Harbour.Example.com/path",
      niche: "real_estate",
      currency: "GBP",
      businessType: "ltd",
      industry: "real_estate",
      registrationIdType: "uk_company_number",
      registrationNumber: " 12345678 ",
      regionsOfOperation: ["europe", "usa_canada", "europe", "mars" as never],
      platformLanguage: "en-GB",
      outboundLanguage: "en-US",
      authorizedRep: {
        firstName: " Ada ",
        lastName: " Broker ",
        email: "Ada@Harbour.Example.com",
        jobPosition: "owner",
        phone: "+447700900123",
      },
      compliance: {
        mergeMessengerContacts: true,
        mergeLeadFormContacts: false,
        disableContactTimezone: true,
        botDetection: true,
        verifyEmailOnFirstSend: true,
        emailUnsubscribeCompliant: true,
        unsubscribeFooter: "  Reply to leave this list.  ",
      },
    });

    expect(profile.brandedDomain).toBe("harbour.example.com");
    expect(profile.regionsOfOperation).toEqual(["europe", "usa_canada"]);
    expect(profile.authorizedRep.email).toBe("ada@harbour.example.com");
    expect(profile.compliance.unsubscribeFooter).toBe("Reply to leave this list.");
    expect(profile.notRegistered).toBe(false);
  });

  it("clears registration fields when the business is not registered", () => {
    const saved = validateBusinessProfile({
      tradingName: "Harbour Homes",
      notRegistered: true,
      registrationIdType: "uk_company_number",
      registrationNumber: "12345678",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.registrationNumber).toBe("");
    expect(saved.value.registrationIdType).toBe("");
  });

  it("builds an unsubscribe footer with the trading name when missing", () => {
    const profile = normalizeBusinessProfile({
      tradingName: "Harbour Homes",
      compliance: {
        emailUnsubscribeCompliant: true,
        unsubscribeFooter: "If you no longer wish to receive these emails you may unsubscribe.",
        mergeMessengerContacts: false,
        mergeLeadFormContacts: false,
        disableContactTimezone: false,
        botDetection: false,
        verifyEmailOnFirstSend: false,
      },
    });
    expect(resolveUnsubscribeFooter(profile)).toContain("Harbour Homes");
    expect(
      resolveUnsubscribeFooter({
        ...profile,
        compliance: { ...profile.compliance, emailUnsubscribeCompliant: false },
      }),
    ).toBe("");
  });
});

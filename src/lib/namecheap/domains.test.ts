import { describe, expect, it } from "vitest";
import {
  domainCandidates,
  mergeWebsiteHosts,
  namecheapPhone,
  quotesFromCheckXml,
  registrantFromProfile,
  registrationParams,
  splitRegistrableDomain,
  ukExtendedAttributes,
  publicNamecheapError,
} from "@/lib/namecheap/domains";
import { hostsFromGetXml, registerPriceFromXml } from "@/lib/namecheap/domains";
import { parseNamecheapXml } from "@/lib/namecheap/xml";

const CHECK_XML = `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK">
  <Errors/>
  <CommandResponse Type="namecheap.domains.check">
    <DomainCheckResult Domain="northbridge.co.uk" Available="true" IsPremiumName="false" PremiumRegistrationPrice="0"/>
    <DomainCheckResult Domain="taken.com" Available="false" IsPremiumName="false" PremiumRegistrationPrice="0"/>
    <DomainCheckResult Domain="rare.com" Available="true" IsPremiumName="true" PremiumRegistrationPrice="640.0000"/>
  </CommandResponse>
</ApiResponse>`;

describe("Namecheap domains", () => {
  it("builds a short list of names from a label", () => {
    expect(domainCandidates("Northbridge", "uk")).toEqual([
      "northbridge.co.uk",
      "northbridge.uk",
      "northbridge.com",
    ]);
    expect(domainCandidates("www.northbridge.co.uk", "uk")).toEqual(["northbridge.co.uk"]);
    expect(domainCandidates("blog.northbridge.com", "us")).toEqual([]);
    expect(splitRegistrableDomain("northbridge.co.uk")).toEqual({
      sld: "northbridge",
      tld: "co.uk",
      domain: "northbridge.co.uk",
    });
  });

  it("formats registrant phones and UK attributes", () => {
    expect(namecheapPhone("+441614962000")).toBe("+44.1614962000");
    expect(namecheapPhone("+1 512 555 0100")).toBe("+1.5125550100");
    expect(ukExtendedAttributes("co.uk", "LTD", "Northbridge Realty", "12345678")).toMatchObject({
      COUKLegalType: "LTD",
      COUKCompanyID: "12345678",
      COUKRegisteredfor: "Northbridge Realty",
    });
    expect(ukExtendedAttributes("uk", "IND", "Ava North")).toMatchObject({
      UKLegalType: "IND",
      UKRegisteredfor: "Ava North",
    });
    expect(ukExtendedAttributes("com", "IND", "Ava North")).toEqual({});
  });

  it("reads availability and keeps mail records when connecting a site", () => {
    const quotes = quotesFromCheckXml(
      CHECK_XML,
      new Map([["co.uk", { amount: 6.48, currency: "USD" }]]),
    );
    expect(quotes[0]).toMatchObject({ domain: "northbridge.co.uk", available: true, price: 6.48 });
    expect(quotes[1].available).toBe(false);
    expect(quotes[2]).toMatchObject({ premium: true, price: 640 });

    const hosts = hostsFromGetXml(`<ApiResponse Status="OK"><CommandResponse>
      <DomainDNSGetHostsResult Domain="northbridge.co.uk" IsUsingOurDNS="true">
        <Host Name="@" Type="A" Address="1.2.3.4" MXPref="10" TTL="1800" />
        <Host Name="@" Type="MX" Address="mail.example.com" MXPref="10" TTL="1800" />
        <Host Name="www" Type="CNAME" Address="parking.example" MXPref="10" TTL="1800" />
      </DomainDNSGetHostsResult>
    </CommandResponse></ApiResponse>`);
    expect(hosts.ourDns).toBe(true);
    const merged = mergeWebsiteHosts(hosts.hosts);
    expect(merged.find((row) => row.type === "MX")?.address).toBe("mail.example.com");
    expect(merged.find((row) => row.name === "www" && row.type === "CNAME")?.address).not.toBe(
      "parking.example",
    );
    expect(merged.some((row) => row.name === "@" && row.type === "A")).toBe(true);
  });

  it("builds a registration request from the business profile", () => {
    const contact = registrantFromProfile({
      fullName: "Ava North",
      organization: "Northbridge Realty Group",
      address: "18 King Street",
      city: "Manchester",
      postcode: "M2 4WQ",
      phone: "+441614962000",
      email: "hello@northbridge.co.uk",
      country: "GB",
    });
    const params = registrationParams(contact, "northbridge.co.uk", { legalType: "IND" });
    expect(params.DomainName).toBe("northbridge.co.uk");
    expect(params.RegistrantPhone).toBe("+44.1614962000");
    expect(params.RegistrantCity).toBe("Manchester");
    expect(params.AddFreeWhoisguard).toBe("yes");
    expect(params.COUKLegalType).toBe("IND");
    expect(params.TechEmailAddress).toBe("hello@northbridge.co.uk");
  });

  it("hides registrar setup failures from the workspace", () => {
    expect(parseNamecheapXml(`<ApiResponse Status="ERROR"><Errors><Error Number="1">Invalid request IP</Error></Errors></ApiResponse>`).errors).toEqual([
      "Invalid request IP",
    ]);
    expect(publicNamecheapError("Invalid request IP: API key rejected")).toBe(
      "Domain buying isn’t available yet.",
    );
    const priced = registerPriceFromXml(
      `<Product Name="com"><Price Duration="1" DurationType="YEAR" YourPrice="9.06" Currency="USD" /></Product>`,
      "com",
    );
    expect(priced).toEqual({ amount: 9.06, currency: "USD" });
  });
});

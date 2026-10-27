import { describe, expect, it } from "vitest";
import { missingDns, normalizeDomain, recordsForDomain } from "@/lib/email/domain-model";

describe("email domain", () => {
  it("rejects a domain that is not a hostname", () => {
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("https://Northbridge.co.uk/path")).toBe("northbridge.co.uk");
  });

  it("asks for a mail CNAME, DKIM CNAME, SPF, and DMARC", () => {
    const records = recordsForDomain("northbridge.co.uk", "mail.onestreet.app");
    expect(records.map((row) => `${row.type} ${row.host}`)).toEqual([
      "CNAME mail.northbridge.co.uk",
      "CNAME s1._domainkey.northbridge.co.uk",
      "TXT northbridge.co.uk",
      "TXT _dmarc.northbridge.co.uk",
    ]);
    expect(records[0]?.value).toBe("mail.onestreet.app");
  });

  it("treats the domain as ready when the required records match", () => {
    const found = {
      cname: {
        "mail.northbridge.co.uk": ["mail.onestreet.app."],
        "s1._domainkey.northbridge.co.uk": ["s1._domainkey.mail.onestreet.app"],
      },
      txt: {
        "northbridge.co.uk": ["v=spf1 include:mail.onestreet.app ~all"],
      },
    };
    expect(missingDns("northbridge.co.uk", found, "mail.onestreet.app")).toEqual([]);
    expect(
      missingDns("northbridge.co.uk", { cname: {}, txt: {} }, "mail.onestreet.app"),
    ).toContain("mail.northbridge.co.uk");
  });
});

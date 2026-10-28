import { describe, expect, it } from "vitest";
import { orgIdsForInboundDomains, recipientDomains } from "@/lib/email/inbound";

describe("inbound email org matching", () => {
  const rows = [
    {
      id: "org-a",
      emailDomain: { domain: "northbridge.test", fromLocal: "office", fromName: "Northbridge", status: "verified" },
    },
    {
      id: "org-b",
      emailDomain: { domain: "harbour.test", fromLocal: "office", fromName: "Harbour", status: "pending" },
    },
  ];

  it("reads the domain from a display address", () => {
    expect(recipientDomains(["Office <hello@northbridge.test>"])).toEqual(["northbridge.test"]);
  });

  it("matches only a verified domain", () => {
    expect(orgIdsForInboundDomains(rows, ["northbridge.test"])).toEqual(["org-a"]);
    expect(orgIdsForInboundDomains(rows, ["harbour.test"])).toEqual([]);
  });

  it("returns every brokerage that shares a verified domain", () => {
    const shared = [
      ...rows,
      {
        id: "org-c",
        emailDomain: { domain: "northbridge.test", fromLocal: "hello", fromName: "Other", status: "verified" },
      },
    ];
    expect(orgIdsForInboundDomains(shared, ["northbridge.test"]).sort()).toEqual(["org-a", "org-c"]);
  });
});

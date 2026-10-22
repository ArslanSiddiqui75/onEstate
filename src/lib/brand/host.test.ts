import { describe, expect, it } from "vitest";
import { alternateRegionHref, marketFromHost, marketFromPath } from "@/lib/brand/host";

describe("region hosts", () => {
  it("maps the two public domains", () => {
    expect(marketFromHost("0nestreet.co.uk")).toBe("uk");
    expect(marketFromHost("www.0nestreet.com:443")).toBe("us");
    expect(marketFromHost("localhost:43123")).toBeNull();
  });

  it("maps the local homepages", () => {
    expect(marketFromPath("/UK")).toBe("uk");
    expect(marketFromPath("/US/pricing")).toBe("us");
    expect(marketFromPath("/")).toBeNull();
  });

  it("sends a local visitor to the other homepage path", () => {
    expect(alternateRegionHref("uk", "127.0.0.1:43123")).toBe("/US");
    expect(alternateRegionHref("us", "0nestreet.com")).toBe("https://0nestreet.co.uk");
  });
});

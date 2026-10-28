import { describe, expect, it } from "vitest";
import { getRequestOrigin, safeReturnTo } from "@/lib/social/oauth-service";

describe("safeReturnTo", () => {
  it("keeps an in-app path", () => {
    expect(safeReturnTo("/app/social")).toBe("/app/social");
  });

  it("rejects off-site and protocol-relative paths", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/app/settings/social");
    expect(safeReturnTo("//evil.example")).toBe("/app/settings/social");
    expect(safeReturnTo("/\\evil.example")).toBe("/app/settings/social");
  });
});

describe("getRequestOrigin", () => {
  it("ignores a forged forwarded host", () => {
    const request = new Request("https://0nestreet.co.uk/api/social/oauth/callback/meta", {
      headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    });
    expect(getRequestOrigin(request)).toBe("https://0nestreet.co.uk");
  });
});

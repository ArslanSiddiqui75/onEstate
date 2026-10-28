import { describe, expect, it } from "vitest";
import { appRedirectUrl, sameOriginUrl } from "@/lib/http/same-origin";

const origin = "https://0nestreet.co.uk";
const fallback = `${origin}/app/settings/billing`;

describe("sameOriginUrl", () => {
  it("keeps a same-origin return path", () => {
    expect(sameOriginUrl(`${origin}/app/settings/billing?checkout=success`, fallback, origin)).toBe(
      `${origin}/app/settings/billing?checkout=success`,
    );
  });

  it("rejects an off-site return URL", () => {
    expect(sameOriginUrl("https://evil.example/phish", fallback, origin)).toBe(fallback);
  });

  it("rejects a missing or malformed URL", () => {
    expect(sameOriginUrl(undefined, fallback, origin)).toBe(fallback);
    expect(sameOriginUrl("not a url", fallback, origin)).toBe(fallback);
  });
});

describe("appRedirectUrl", () => {
  it("stays on the request when the forwarded host is someone else's site", () => {
    const request = new Request("https://0nestreet.co.uk/api/waitlist", {
      headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
    });
    expect(appRedirectUrl(request, "/").origin).toBe("https://0nestreet.co.uk");
  });

  it("follows the public host when it matches the request", () => {
    const request = new Request("http://internal:3000/api/waitlist", {
      headers: {
        host: "0nestreet.co.uk",
        "x-forwarded-host": "0nestreet.co.uk",
        "x-forwarded-proto": "https",
      },
    });
    expect(appRedirectUrl(request, "/report/abc").href).toBe("https://0nestreet.co.uk/report/abc");
  });
});

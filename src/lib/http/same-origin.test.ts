import { describe, expect, it } from "vitest";
import { sameOriginUrl } from "@/lib/http/same-origin";

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

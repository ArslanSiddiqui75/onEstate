import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/http/client-ip";

describe("clientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientIp(req)).toBe("198.51.100.7");
  });

  it("returns unknown when no proxy headers exist", () => {
    expect(clientIp(new Request("https://example.com"))).toBe("unknown");
  });
});

import { describe, expect, it } from "vitest";
import { demoInboxEnabled } from "@/lib/server/demo-inbox";

describe("demoInboxEnabled", () => {
  it("stays open outside production", () => {
    expect(demoInboxEnabled({ NODE_ENV: "test" })).toBe(true);
  });

  it("stays closed in production unless explicitly enabled", () => {
    expect(demoInboxEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(demoInboxEnabled({ NODE_ENV: "production", DEMO_PUBLIC_INBOX: "1" })).toBe(true);
  });
});

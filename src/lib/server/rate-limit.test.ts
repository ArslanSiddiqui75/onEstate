import { describe, expect, it } from "vitest";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";

describe("createSlidingWindowLimiter", () => {
  it("allows up to max hits then blocks", () => {
    const limited = createSlidingWindowLimiter({ windowMs: 1_000, max: 3 });
    const t = 1_000_000;
    expect(limited("ip", t)).toBe(false);
    expect(limited("ip", t + 1)).toBe(false);
    expect(limited("ip", t + 2)).toBe(false);
    expect(limited("ip", t + 3)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limited = createSlidingWindowLimiter({ windowMs: 1_000, max: 1 });
    const t = 1_000_000;
    expect(limited("a", t)).toBe(false);
    expect(limited("a", t + 1)).toBe(true);
    expect(limited("b", t + 1)).toBe(false);
  });

  it("expires hits outside the window", () => {
    const limited = createSlidingWindowLimiter({ windowMs: 100, max: 1 });
    const t = 1_000_000;
    expect(limited("ip", t)).toBe(false);
    expect(limited("ip", t + 101)).toBe(false);
  });
});

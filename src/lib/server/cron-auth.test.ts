import { afterEach, describe, expect, it, vi } from "vitest";
import { unauthorizedCronResponse } from "@/lib/server/cron-auth";

function requestWith(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers });
}

describe("unauthorizedCronResponse", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows unauthenticated access in non-production when no secrets are set", () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.CRON_SECRET;
    const denied = unauthorizedCronResponse(
      requestWith("https://example.com/api/cron"),
      [],
    );
    expect(denied).toBeNull();
  });

  it("fails closed in production when no secrets are configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.CRON_SECRET;
    const denied = unauthorizedCronResponse(
      requestWith("https://example.com/api/cron"),
      [],
    );
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(401);
    const body = await denied?.json();
    expect(body).toEqual({ error: "Cron secret is not configured" });
  });

  it("accepts a matching Bearer token", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const denied = unauthorizedCronResponse(
      requestWith("https://example.com/api/cron", {
        authorization: "Bearer cron-secret",
      }),
      [],
    );
    expect(denied).toBeNull();
  });

  it("accepts X-Cron-Secret or ?secret=", () => {
    vi.stubEnv("CRON_SECRET", "shared");
    expect(
      unauthorizedCronResponse(
        requestWith("https://example.com/api/cron", {
          "x-cron-secret": "shared",
        }),
        [],
      ),
    ).toBeNull();
    expect(
      unauthorizedCronResponse(
        requestWith("https://example.com/api/cron?secret=shared"),
        [],
      ),
    ).toBeNull();
  });

  it("rejects a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "shared");
    const denied = unauthorizedCronResponse(
      requestWith("https://example.com/api/cron", {
        authorization: "Bearer nope",
      }),
      [],
    );
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ error: "Unauthorized" });
  });

  it("does not treat x-vercel-cron as enough on its own", async () => {
    vi.stubEnv("CRON_SECRET", "shared");
    const denied = unauthorizedCronResponse(
      requestWith("https://example.com/api/cron", {
        "x-vercel-cron": "1",
      }),
      [],
    );
    expect(denied?.status).toBe(401);
  });
});

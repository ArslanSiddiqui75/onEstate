import { afterEach, describe, expect, it } from "vitest";
import {
  isAccessTokenUsable,
  readStoredAccessToken,
  rememberAccessToken,
  rememberedAccessToken,
} from "@/lib/supabase/access-token";

function tokenWithExp(expSeconds: number) {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
  return `header.${payload}.sig`;
}

describe("access tokens for API calls", () => {
  afterEach(() => {
    rememberAccessToken(null);
  });

  it("treats a token as usable until shortly before it expires", () => {
    const now = 1_700_000_000_000;
    const fresh = tokenWithExp(Math.floor(now / 1000) + 3600);
    const almostDue = tokenWithExp(Math.floor(now / 1000) + 10);
    expect(isAccessTokenUsable(fresh, now)).toBe(true);
    expect(isAccessTokenUsable(almostDue, now)).toBe(false);
    expect(isAccessTokenUsable("", now)).toBe(false);
  });

  it("remembers a live token and ignores one that has already expired", () => {
    const fresh = tokenWithExp(Math.floor(Date.now() / 1000) + 3600);
    rememberAccessToken(fresh);
    expect(rememberedAccessToken()).toBe(fresh);
    rememberAccessToken(null);
    expect(rememberedAccessToken()).toBeNull();

    const expired = tokenWithExp(Math.floor(Date.now() / 1000) - 60);
    rememberAccessToken(expired);
    expect(rememberedAccessToken()).toBeNull();
  });

  it("reads the session Supabase stores for this project", () => {
    const now = 1_700_000_000_000;
    const fresh = tokenWithExp(Math.floor(now / 1000) + 3600);
    const storage = {
      getItem(key: string) {
        if (key !== "sb-abc-auth-token") return null;
        return JSON.stringify({ access_token: fresh });
      },
    };
    expect(
      readStoredAccessToken(storage, "https://abc.supabase.co", now),
    ).toBe(fresh);
    expect(
      readStoredAccessToken({ getItem: () => null }, "https://abc.supabase.co", now),
    ).toBeNull();
  });
});

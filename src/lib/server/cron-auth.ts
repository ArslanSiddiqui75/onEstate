import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function matchesSecret(provided: string | null, expected: string[]): boolean {
  if (!provided || expected.length === 0) return false;
  const left = Buffer.from(provided);
  return expected.some((secret) => {
    const right = Buffer.from(secret);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  });
}

/**
 * Cron routes must not be open when secrets are missing in production.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * External schedulers can send `X-Cron-Secret` or `?secret=`.
 *
 * Returns a 401 response when unauthorized, or null when the request may proceed.
 */
export function unauthorizedCronResponse(
  request: Request,
  extraSecrets: Array<string | undefined> = [],
): NextResponse | null {
  const vercelCronSecret = process.env.CRON_SECRET;
  const expected = [...extraSecrets, vercelCronSecret].filter(
    (value): value is string => Boolean(value),
  );
  const production = process.env.NODE_ENV === "production";

  if (expected.length === 0) {
    if (production) {
      return NextResponse.json(
        { error: "Cron secret is not configured" },
        { status: 401 },
      );
    }
    return null;
  }

  const url = new URL(request.url);
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = url.searchParams.get("secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  const ok =
    matchesSecret(headerSecret, expected) ||
    matchesSecret(querySecret, expected) ||
    matchesSecret(bearer, expected);

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

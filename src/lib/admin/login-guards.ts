import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";

export const adminLoginIpLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 5,
});

export const adminLoginGateLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 5,
});

export const adminMfaCodeLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 8,
});

export function adminClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

export function adminSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return false;
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function adminAbortWithDelay(status: number, error: string) {
  await new Promise((r) => setTimeout(r, randomInt(180, 520)));
  return NextResponse.json({ error }, { status });
}

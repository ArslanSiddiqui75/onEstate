import { NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "crypto";
import { authenticatePlatformAdmin } from "@/lib/admin/credentials";
import { resolveAdminGate } from "@/lib/admin/gates";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  issueAdminSessionToken,
} from "@/lib/admin/session-token";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  /** Opaque public gate slug from the address bar — maps to one role server-side. */
  gate: z
    .string()
    .min(6)
    .max(64)
    .regex(/^[a-zA-Z0-9]+$/),
});

/** Per IP — coarse ceiling. */
const ipLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 5,
});

/** Per IP + gate — stops spraying one gate from a shared NAT. */
const gateLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 5,
});

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host) return false;
  // Same-origin fetch always sends Origin. Reject cross-site POSTs.
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function abortWithDelay(status: number, error: string) {
  // Jitter slows credential stuffing without a fixed timing oracle.
  await new Promise((r) => setTimeout(r, randomInt(180, 520)));
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  if (!sameOrigin(request)) {
    return abortWithDelay(403, "Invalid credentials");
  }

  if (ipLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return abortWithDelay(400, "Invalid credentials");
  }

  if (gateLimited(`${ip}:${parsed.data.gate.toLowerCase()}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const requiredRole = resolveAdminGate(parsed.data.gate);
  if (!requiredRole) {
    return abortWithDelay(401, "Invalid credentials");
  }

  const admin = authenticatePlatformAdmin(
    parsed.data.email,
    parsed.data.password,
    requiredRole,
  );
  if (!admin) {
    return abortWithDelay(401, "Invalid credentials");
  }

  const token = issueAdminSessionToken(admin);
  if (!token) {
    return NextResponse.json(
      { error: "Admin session is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, admin });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

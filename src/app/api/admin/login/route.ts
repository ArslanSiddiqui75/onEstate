import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePlatformAdmin } from "@/lib/admin/credentials";
import { resolveAdminGate } from "@/lib/admin/gates";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  issueAdminSessionToken,
} from "@/lib/admin/session-token";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Opaque public gate slug from the address bar — maps to one role server-side. */
  gate: z.string().min(4).max(64),
});

const isRateLimited = createSlidingWindowLimiter({
  windowMs: 15 * 60_000,
  max: 8,
});

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

export async function POST(request: Request) {
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const requiredRole = resolveAdminGate(parsed.data.gate);
  if (!requiredRole) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const admin = authenticatePlatformAdmin(
    parsed.data.email,
    parsed.data.password,
    requiredRole,
  );
  if (!admin) {
    return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
  }

  const token = issueAdminSessionToken(admin);
  if (!token) {
    return NextResponse.json(
      { error: "PLATFORM_ADMIN_PASSWORD is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, admin });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

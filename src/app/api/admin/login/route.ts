import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePlatformAdmin } from "@/lib/admin/credentials";
import { resolveAdminGate } from "@/lib/admin/gates";
import {
  ADMIN_MFA_PENDING_COOKIE,
  adminMfaConfigured,
  adminMfaPendingCookieOptions,
  devTotpHint,
  issueAdminMfaPendingToken,
} from "@/lib/admin/mfa";
import {
  adminAbortWithDelay,
  adminClientIp,
  adminLoginGateLimited,
  adminLoginIpLimited,
  adminSameOrigin,
} from "@/lib/admin/login-guards";

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

export async function POST(request: Request) {
  const ip = adminClientIp(request);

  if (!adminSameOrigin(request)) {
    return adminAbortWithDelay(403, "Invalid credentials");
  }

  if (adminLoginIpLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return adminAbortWithDelay(400, "Invalid credentials");
  }

  if (adminLoginGateLimited(`${ip}:${parsed.data.gate.toLowerCase()}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  const requiredRole = resolveAdminGate(parsed.data.gate);
  if (!requiredRole) {
    return adminAbortWithDelay(401, "Invalid credentials");
  }

  const admin = authenticatePlatformAdmin(
    parsed.data.email,
    parsed.data.password,
    requiredRole,
  );
  if (!admin) {
    return adminAbortWithDelay(401, "Invalid credentials");
  }

  if (!adminMfaConfigured(admin.role)) {
    return NextResponse.json(
      {
        error:
          "Admin 2FA is not configured for this role. Set PLATFORM_ADMIN_TOTP_* secrets.",
      },
      { status: 503 },
    );
  }

  const pending = issueAdminMfaPendingToken(admin);
  if (!pending) {
    return NextResponse.json(
      { error: "Admin 2FA challenge could not be started" },
      { status: 503 },
    );
  }

  // Password alone never grants a console session — MFA must complete.
  const body: Record<string, unknown> = {
    ok: true,
    mfaRequired: true,
    channel: "totp",
  };
  const hint = devTotpHint(admin.role);
  if (hint) body.devCode = hint;

  const response = NextResponse.json(body);
  response.cookies.set(
    ADMIN_MFA_PENDING_COOKIE,
    pending,
    adminMfaPendingCookieOptions(),
  );
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

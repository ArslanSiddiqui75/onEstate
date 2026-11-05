import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_MFA_PENDING_COOKIE,
  adminMfaPendingCookieOptions,
  pendingAdminFromChallenge,
  verifyAdminMfaCode,
  verifyAdminMfaPendingToken,
} from "@/lib/admin/mfa";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  issueAdminSessionToken,
} from "@/lib/admin/session-token";
import {
  adminAbortWithDelay,
  adminClientIp,
  adminMfaCodeLimited,
  adminSameOrigin,
} from "@/lib/admin/login-guards";

const bodySchema = z.object({
  code: z.string().min(6).max(12),
});

export async function POST(request: Request) {
  const ip = adminClientIp(request);

  if (!adminSameOrigin(request)) {
    return adminAbortWithDelay(403, "Invalid credentials");
  }

  if (adminMfaCodeLimited(ip)) {
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

  const jar = await cookies();
  const pending = verifyAdminMfaPendingToken(
    jar.get(ADMIN_MFA_PENDING_COOKIE)?.value,
  );
  if (!pending) {
    return adminAbortWithDelay(401, "Verification expired. Sign in again.");
  }

  if (pending.channel === "email" || pending.channel === "sms") {
    return NextResponse.json(
      {
        error:
          "Email/SMS admin 2FA is reserved for domain integration and is not active yet.",
      },
      { status: 503 },
    );
  }

  if (!verifyAdminMfaCode(pending, parsed.data.code)) {
    return adminAbortWithDelay(401, "Invalid verification code");
  }

  const admin = pendingAdminFromChallenge(pending);
  const token = issueAdminSessionToken(admin);
  if (!token) {
    return NextResponse.json(
      { error: "Admin session is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true, admin });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());
  response.cookies.set(ADMIN_MFA_PENDING_COOKIE, "", {
    ...adminMfaPendingCookieOptions(),
    maxAge: 0,
  });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

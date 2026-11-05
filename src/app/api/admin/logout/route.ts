import { NextResponse } from "next/server";
import {
  ADMIN_MFA_PENDING_COOKIE,
  adminMfaPendingCookieOptions,
} from "@/lib/admin/mfa";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from "@/lib/admin/session-token";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set(ADMIN_MFA_PENDING_COOKIE, "", {
    ...adminMfaPendingCookieOptions(),
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

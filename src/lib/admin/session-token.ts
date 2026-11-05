import { createHmac, timingSafeEqual } from "crypto";
import type { PlatformAdminUser } from "@/lib/admin/types";
import { adminSessionSecret } from "@/lib/admin/credentials";
import { PLATFORM_ADMIN_ROLES } from "@/lib/admin/types";

const isProd = process.env.NODE_ENV === "production";

/** Host-only cookie in production — Secure + Path=/ + no Domain. */
const COOKIE = isProd
  ? "__Host-platform_admin_session"
  : "platform_admin_session";

/** Short-lived operator sessions. */
const TTL_SECONDS = 60 * 60 * 4;

export const ADMIN_SESSION_COOKIE = COOKIE;

interface TokenPayload extends PlatformAdminUser {
  exp: number;
  iat: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isKnownRole(role: string): role is PlatformAdminUser["role"] {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

export function issueAdminSessionToken(admin: PlatformAdminUser): string | null {
  const secret = adminSessionSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    ...admin,
    iat: now,
    exp: now + TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
): PlatformAdminUser | null {
  if (!token) return null;
  const secret = adminSessionSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!signaturesMatch(signature, sign(encoded, secret))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (!payload?.id || !payload.email || !payload.role || !payload.exp) {
      return null;
    }
    if (!isKnownRole(payload.role)) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

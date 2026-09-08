import { createHmac, timingSafeEqual } from "crypto";
import type { PlatformAdminUser } from "@/lib/admin/types";
import { adminSessionSecret } from "@/lib/admin/credentials";

const COOKIE = "platform_admin_session";
const TTL_SECONDS = 60 * 60 * 12;

export const ADMIN_SESSION_COOKIE = COOKIE;

interface TokenPayload extends PlatformAdminUser {
  exp: number;
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

export function issueAdminSessionToken(admin: PlatformAdminUser): string | null {
  const secret = adminSessionSecret();
  if (!secret) return null;
  const payload: TokenPayload = {
    ...admin,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

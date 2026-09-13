import { createHmac, timingSafeEqual } from "crypto";
import { adminSessionSecret } from "@/lib/admin/credentials";

export const IMPERSONATION_COOKIE = "platform_impersonation";
const TTL_SECONDS = 60 * 30;

export interface ImpersonationPayload {
  adminId: string;
  adminEmail: string;
  adminName: string;
  targetUserId: string;
  targetEmail: string;
  targetName: string;
  orgId: string;
  orgName: string;
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

export function issueImpersonationToken(
  payload: Omit<ImpersonationPayload, "exp">,
): string | null {
  const secret = adminSessionSecret();
  if (!secret) return null;
  const full: ImpersonationPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyImpersonationToken(
  token: string | undefined | null,
): ImpersonationPayload | null {
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
    ) as ImpersonationPayload;
    if (!payload?.targetUserId || !payload.adminEmail || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function impersonationCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}

export function adminCanImpersonateRole(role: string) {
  return role === "super_admin" || role === "support_admin";
}

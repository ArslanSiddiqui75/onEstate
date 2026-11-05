/**
 * Platform-admin MFA.
 *
 * Live channel today: TOTP (authenticator apps). Email/SMS delivery is
 * stubbed for when domain + messaging are integrated — the login UI and
 * challenge cookie already assume a second factor after password.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { PlatformAdminRole, PlatformAdminUser } from "@/lib/admin/types";
import { PLATFORM_ADMIN_ROLES } from "@/lib/admin/types";
import { adminSessionSecret } from "@/lib/admin/credentials";
import { encodeBase32, generateTotp, verifyTotp } from "@/lib/admin/totp";

const isProd = process.env.NODE_ENV === "production";

/** Pending MFA cookie — never grants /admin access by itself. */
export const ADMIN_MFA_PENDING_COOKIE = isProd
  ? "__Host-platform_admin_mfa"
  : "platform_admin_mfa_pending";

const PENDING_TTL_SECONDS = 5 * 60;

/** Channels the challenge API understands. Email/SMS land later. */
export type AdminMfaChannel = "totp" | "email" | "sms";

/** Local-only default secrets so the 2FA step is real in development. */
const DEV_TOTP_SECRETS: Record<PlatformAdminRole, string> = {
  // Fixed base32 for local authenticator enrollment / tests.
  super_admin: "JBSWY3DPEHPK3PXP",
  billing_admin: "KRSXG5CTMVRXEZLU",
  support_admin: "MFWGS3TLEBUW4IDN",
};

interface PendingPayload {
  id: string;
  email: string;
  name: string;
  role: PlatformAdminRole;
  channel: AdminMfaChannel;
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

export function totpSecretForRole(role: PlatformAdminRole): string | null {
  const fromEnv = {
    super_admin: process.env.PLATFORM_ADMIN_TOTP_SUPER,
    billing_admin: process.env.PLATFORM_ADMIN_TOTP_BILLING,
    support_admin: process.env.PLATFORM_ADMIN_TOTP_SUPPORT,
  }[role]?.trim();
  if (fromEnv) return fromEnv.replace(/\s+/g, "").toUpperCase();
  if (isProd) return null;
  return DEV_TOTP_SECRETS[role];
}

/**
 * Preferred delivery channel. Defaults to totp. Email/SMS require domain
 * wiring and return 503 from the verify path until implemented.
 */
export function adminMfaChannel(): AdminMfaChannel {
  const raw = (process.env.PLATFORM_ADMIN_MFA_CHANNEL || "totp")
    .trim()
    .toLowerCase();
  if (raw === "email" || raw === "sms" || raw === "totp") return raw;
  return "totp";
}

export function adminMfaConfigured(role: PlatformAdminRole): boolean {
  const channel = adminMfaChannel();
  if (channel === "totp") return Boolean(totpSecretForRole(role));
  // Email/SMS stubs — not deliverable until domain integration.
  return false;
}

export function issueAdminMfaPendingToken(
  admin: PlatformAdminUser,
): string | null {
  const secret = adminSessionSecret();
  if (!secret) return null;
  const channel = adminMfaChannel();
  if (channel !== "totp" || !totpSecretForRole(admin.role)) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: PendingPayload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    channel: "totp",
    iat: now,
    exp: now + PENDING_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyAdminMfaPendingToken(
  token: string | undefined | null,
): PendingPayload | null {
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
    ) as PendingPayload;
    if (
      !payload?.id ||
      !payload.email ||
      !payload.role ||
      !payload.exp ||
      !payload.channel
    ) {
      return null;
    }
    if (!(PLATFORM_ADMIN_ROLES as readonly string[]).includes(payload.role)) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function pendingAdminFromChallenge(
  pending: PendingPayload,
): PlatformAdminUser {
  return {
    id: pending.id,
    email: pending.email,
    name: pending.name,
    role: pending.role,
  };
}

export function verifyAdminMfaCode(
  pending: PendingPayload,
  code: string,
): boolean {
  if (pending.channel === "totp") {
    const secret = totpSecretForRole(pending.role);
    if (!secret) return false;
    try {
      return verifyTotp(secret, code);
    } catch {
      return false;
    }
  }
  // email / sms — reserved for domain + messaging integration.
  return false;
}

/** Never returned in production responses. */
export function devTotpHint(role: PlatformAdminRole): string | undefined {
  if (isProd) return undefined;
  const secret = totpSecretForRole(role);
  if (!secret) return undefined;
  try {
    return generateTotp(secret);
  } catch {
    return undefined;
  }
}

export function adminMfaPendingCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
    maxAge: PENDING_TTL_SECONDS,
  };
}

/** Helper for rotating secrets in ops scripts / docs. */
export function generateTotpSecretBytes(byteLength = 20): string {
  return encodeBase32(randomBytes(byteLength));
}

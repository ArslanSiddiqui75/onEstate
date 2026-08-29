import { createHmac, timingSafeEqual } from "crypto";

const MAX_SKEW_SECONDS = 300;

function decodeSigningKey(secret: string): Buffer {
  const raw = secret.trim();
  const b64 = raw.startsWith("whsec_") ? raw.slice("whsec_".length) : raw;
  return Buffer.from(b64, "base64");
}

function signaturesMatch(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Resend webhooks are Svix-signed. Use the raw body — re-serializing JSON
 * breaks the signature.
 */
export function verifyResendWebhook(input: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
}): boolean {
  const id = input.id?.trim() || "";
  const timestamp = input.timestamp?.trim() || "";
  const signatureHeader = input.signature?.trim() || "";
  if (!id || !timestamp || !signatureHeader || !input.secret.trim()) {
    return false;
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", decodeSigningKey(input.secret))
    .update(`${id}.${timestamp}.${input.payload}`)
    .digest("base64");

  const candidates = signatureHeader.split(/\s+/).map((part) => {
    const comma = part.indexOf(",");
    return comma >= 0 ? part.slice(comma + 1) : part;
  });

  return candidates.some((candidate) => signaturesMatch(candidate, expected));
}

export function resendWebhookSecret(): string {
  return (process.env.RESEND_WEBHOOK_SECRET || "").trim();
}

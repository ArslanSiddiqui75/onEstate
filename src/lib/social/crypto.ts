import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Server-only. Encrypts OAuth access/refresh tokens before they're written to
// Supabase, so a database leak alone can't hand over live social credentials.
// The secret is hashed to 32 bytes so any reasonably long passphrase works as
// SOCIAL_TOKEN_ENCRYPTION_KEY, not just a hex/base64-formatted key.

function getKey(): Buffer {
  const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "SOCIAL_TOKEN_ENCRYPTION_KEY is not set. Add a long random secret to your environment before connecting real social accounts.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

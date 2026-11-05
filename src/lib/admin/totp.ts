/**
 * RFC 6238 TOTP (SHA-1, 30s step, 6 digits) — no third-party dependency.
 * Used for platform-admin second factor until email/SMS channels are wired.
 */
import { createHmac, timingSafeEqual } from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(input: string): Buffer {
  const cleaned = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = "";
  for (const ch of cleaned) {
    const val = BASE32.indexOf(ch);
    if (val < 0) throw new Error("Invalid base32");
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function encodeBase32(buf: Buffer): string {
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += BASE32[parseInt(chunk, 2)];
  }
  return out;
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter & 0xffffffff, 4);
  const digest = createHmac("sha1", secret).update(msg).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotp(
  secretBase32: string,
  atMs = Date.now(),
  stepSeconds = 30,
): string {
  const secret = decodeBase32(secretBase32);
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  return hotp(secret, counter);
}

/** Accept current step ±1 window. */
export function verifyTotp(
  secretBase32: string,
  code: string,
  atMs = Date.now(),
  stepSeconds = 30,
): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const secret = decodeBase32(secretBase32);
  const counter = Math.floor(atMs / 1000 / stepSeconds);
  const provided = Buffer.from(normalized);
  for (const delta of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, counter + delta));
    if (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    ) {
      return true;
    }
  }
  return false;
}

export function totpProvisioningUri(input: {
  secretBase32: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = encodeURIComponent(input.issuer || "0neStreet Admin");
  const account = encodeURIComponent(input.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${input.secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

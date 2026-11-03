import { randomBytes } from "crypto";

export function newInviteToken() {
  return randomBytes(24).toString("hex");
}

export const TERMS_VERSION = "2026-11-04";

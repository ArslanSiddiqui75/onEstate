/** Shared brokerage-name rules for signup, onboarding, and Settings. */
export function normalizeOrgName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateOrgName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeOrgName(raw);
  if (name.length < 3) {
    return { ok: false, error: "Brokerage name must be at least 3 characters" };
  }
  if (name.length > 200) {
    return { ok: false, error: "Brokerage name is too long" };
  }
  if (/^\d+$/.test(name)) {
    return { ok: false, error: "Enter your brokerage name, not a number" };
  }
  if (/^(tp|xx|n\/a|na)$/i.test(name)) {
    return { ok: false, error: "Enter your real brokerage name" };
  }
  return { ok: true, name };
}

import type { Market } from "@/types";

export const DIAL_CODES = [
  { code: "+44", label: "UK +44" },
  { code: "+1", label: "US/CA +1" },
  { code: "+92", label: "Pakistan +92" },
  { code: "+353", label: "Ireland +353" },
  { code: "+61", label: "Australia +61" },
  { code: "+971", label: "UAE +971" },
  { code: "+966", label: "Saudi +966" },
  { code: "+91", label: "India +91" },
  { code: "+49", label: "Germany +49" },
  { code: "+33", label: "France +33" },
] as const;

const CODES_LONGEST_FIRST = [...DIAL_CODES].sort(
  (a, b) => b.code.length - a.code.length,
);

export function defaultDialCode(market: Market): string {
  return market === "us" ? "+1" : "+44";
}

/** Twilio needs + and country code. Local 0333… is not a sendable address. */
export function isE164(input: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(input.trim());
}

export function splitE164(raw: string): { dialCode: string; national: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { dialCode: "", national: "" };
  const e164 = trimmed.startsWith("+")
    ? `+${trimmed.slice(1).replace(/\D/g, "")}`
    : "";
  if (e164) {
    const match = CODES_LONGEST_FIRST.find((row) => e164.startsWith(row.code));
    if (match) {
      return { dialCode: match.code, national: e164.slice(match.code.length) };
    }
    return { dialCode: "", national: e164.slice(1) };
  }
  return { dialCode: "", national: trimmed.replace(/\D/g, "") };
}

/**
 * Compose a sendable number. A leading 0 is treated as a local trunk prefix
 * (0333… + Pakistan → +92333…). An already-international + or 00 wins over the picker.
 */
export function toE164(raw: string, dialCode: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00") && digits.length > 4) {
    return `+${digits.slice(2)}`;
  }
  const code = dialCode.startsWith("+") ? dialCode : `+${dialCode.replace(/\D/g, "")}`;
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  if (!national) return "";
  return `${code}${national}`;
}

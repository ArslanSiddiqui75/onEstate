export type EmailMode = "auto" | "simulated" | "resend";

export interface EmailCapabilities {
  mode: "live" | "simulated";
  outbound: "resend" | "simulated";
  resendConfigured: boolean;
  from: string;
  /** Present when the operator set a key but forgot the sender (or vice versa). */
  configError?: string;
}

function readEmailMode(): EmailMode {
  const raw = (process.env.EMAIL_MODE || "auto").toLowerCase().trim();
  // Docs show `auto|simulated|resend` — people paste that as the value.
  if (raw.includes("|")) return "auto";
  if (raw === "simulated" || raw === "resend") return raw;
  return "auto";
}

function fromLooksUnverified(from: string) {
  const host = from.toLowerCase();
  return (
    host.includes("@example.com") ||
    host.includes("@example.org") ||
    host.includes("@example.net")
  );
}

export function emailFromAddress(): string {
  return (process.env.EMAIL_FROM || "").trim();
}

export function isResendConfigured() {
  const from = emailFromAddress();
  return Boolean(process.env.RESEND_API_KEY && from && !fromLooksUnverified(from));
}

export function emailConfigError(): string | undefined {
  const setting = readEmailMode();
  if (setting === "simulated") return undefined;
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const from = emailFromAddress();
  const hasFrom = Boolean(from);
  if (hasKey && !hasFrom) {
    return "EMAIL_FROM is missing. For tests use 0nEstate <onboarding@resend.dev> (your Resend account email only). To email leads, verify a domain at resend.com/domains and use that address.";
  }
  if (hasFrom && fromLooksUnverified(from)) {
    return "EMAIL_FROM cannot use example.com. Use 0nEstate <onboarding@resend.dev> for tests, or a sender on a domain you verified at resend.com/domains.";
  }
  if (setting === "resend" && !hasKey) {
    return "RESEND_API_KEY is not set.";
  }
  if (setting === "resend" && !hasFrom) {
    return "EMAIL_FROM is not set.";
  }
  return undefined;
}

export function getEmailCapabilities(): EmailCapabilities {
  const configured = isResendConfigured();
  const setting = readEmailMode();
  const configError = emailConfigError();
  const useResend =
    !configError && (setting === "resend" || (setting === "auto" && configured));

  return {
    mode: useResend ? "live" : "simulated",
    outbound: useResend ? "resend" : "simulated",
    resendConfigured: configured,
    from: emailFromAddress(),
    configError,
  };
}

export function shouldUseResendOutbound(): boolean {
  return getEmailCapabilities().outbound === "resend";
}
